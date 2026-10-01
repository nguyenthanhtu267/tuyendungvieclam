import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { timingSafeEqual } from 'crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { AdminSetting } from '../database/entities/admin-setting.entity';
import { JobImportService } from './job-import.service';

// Đợt 120 — chặng 3: tự đọc hộp thư (IMAP) có email thông báo việc làm, gom link tin tuyển dụng, cho vào "Hộp nhập tin từ link".
// KHÔNG tự đăng — chỉ đưa vào hàng chờ để Admin xem lại. Thông tin đăng nhập hộp thư nằm trong biến môi trường trên Render
// (MAIL_IMAP_USER, MAIL_IMAP_PASS = "Mật khẩu ứng dụng" Gmail), không lưu trong CSDL, không hiển thị trên web.
const SETTING_ID = 'singleton';
const EVERY_MS = 30 * 60 * 1000;
const MAX_MAILS = 40;
const MAX_LINKS_PER_MAIL = 15;
const CONCURRENCY = 4;
const FIRST_RUN_DAYS = 3;
const MAX_LINKS_PER_SCAN = 150;

// Tên miền các trang tuyển dụng phổ biến — link tới đây luôn được thử.
const JOB_HOSTS = /(careerviet|vietnamworks|topcv|itviec|glints|jobsgo|timviec365|vieclam24h|123job|mywork|joboko|careerlink|vieclamtot|indeed|linkedin|jobstreet|navigos|ybox|topdev|viectotnhat|timviecnhanh|vieclam\.|lamthem|tuyendung)/i;
// Đường dẫn trông giống trang chi tiết tin.
const JOB_PATH = /(viec-lam|tuyen-dung|vieclam|\/jobs?\/|\/job-|\/careers?\/|\/position|\/vacanc|\/recruit|\/jd\/|\/v\/|-jd\d|\/tim-viec)/i;
// Host kiểu link theo dõi của dịch vụ gửi email — phải đi theo chuyển hướng mới biết đích.
const TRACKING_HOST = /^(click|clicks|track|tracking|links?|email|e|mail|url|go|r|t|em|mkt|ctrk|trk)\d*\./i;
const JUNK = /(unsubscribe|huy-dang-ky|huydangky|optout|opt-out|preferences?|privacy|terms|dieu-khoan|facebook\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|zalo\.me|play\.google|apps\.apple|mailto:|tel:|\.(png|jpe?g|gif|svg|webp|css|js)(\?|$))/i;

export function pickJobLinks(html: string, text: string): string[] {
  const urls = new Set<string>();
  for (const m of (html || '').matchAll(/href\s*=\s*["']([^"']+)["']/gi)) urls.add(m[1].replace(/&amp;/g, '&').trim());
  for (const m of (text || '').matchAll(/https?:\/\/[^\s<>"')\]\[]+/gi)) urls.add(m[0].replace(/[.,;]+$/, ''));
  const out: string[] = [];
  for (const raw of urls) {
    if (!/^https?:\/\//i.test(raw) || JUNK.test(raw)) continue;
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    const keep = JOB_HOSTS.test(u.hostname) || JOB_PATH.test(u.pathname) || TRACKING_HOST.test(u.hostname);
    if (keep) out.push(raw);
    if (out.length >= MAX_LINKS_PER_MAIL) break;
  }
  return out;
}

export interface MailScanSummary {
  at: string;
  mails: number;
  links: number;
  added: number;
  duplicates: number;
  skipped: number;
  error?: string;
}

@Injectable()
export class MailScanService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MailScanService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    @InjectRepository(AdminSetting) private readonly settings: Repository<AdminSetting>,
    private readonly imports: JobImportService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.autoTick().catch(() => undefined);
    }, EVERY_MS);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  configured(): boolean {
    return !!(process.env.MAIL_IMAP_USER && process.env.MAIL_IMAP_PASS);
  }

  private async row(): Promise<AdminSetting> {
    let s = await this.settings.findOne({ where: { id: SETTING_ID } });
    if (!s) s = await this.settings.save(this.settings.create({ id: SETTING_ID }));
    return s;
  }

  private envLabels(): string[] {
    const v = (process.env.MAIL_LABEL || 'INBOX').split(',').map((x) => x.trim()).filter(Boolean);
    return v.length ? v : ['INBOX'];
  }

  private selectedLabels(s: AdminSetting): string[] {
    try {
      const arr = s.mailScanLabels ? (JSON.parse(s.mailScanLabels) as string[]) : [];
      if (Array.isArray(arr) && arr.length) return arr.map(String);
    } catch {
      /* dùng mặc định */
    }
    return this.envLabels();
  }

  private newClient() {
    const c = new ImapFlow({
      host: process.env.MAIL_IMAP_HOST || 'imap.gmail.com',
      port: Number(process.env.MAIL_IMAP_PORT) || 993,
      secure: process.env.MAIL_IMAP_SECURE !== 'false',
      auth: { user: process.env.MAIL_IMAP_USER as string, pass: process.env.MAIL_IMAP_PASS as string },
      logger: false,
    });
    c.on('error', () => undefined);
    return c;
  }

  // Danh sách nhãn (thư mục) trong hộp thư để Admin tick chọn — bỏ các thư mục hệ thống của Gmail ([Gmail]/…).
  async labels(): Promise<{ path: string; selected: boolean }[]> {
    if (!this.configured()) return [];
    const sel = new Set(this.selectedLabels(await this.row()));
    const client = this.newClient();
    try {
      await client.connect();
      const list = await client.list();
      await client.logout().catch(() => undefined);
      return list
        .filter((m) => !m.flags?.has('\\Noselect') && !m.path.startsWith('[Gmail]') && !m.path.startsWith('[Google Mail]'))
        .map((m) => ({ path: m.path, selected: sel.has(m.path) }))
        .sort((a, b) => a.path.localeCompare(b.path, 'vi'));
    } catch {
      try {
        await client.logout();
      } catch {
        /* bỏ qua */
      }
      return [];
    }
  }

  async setLabels(labels: string[]) {
    const s = await this.row();
    const clean = (labels || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 30);
    s.mailScanLabels = clean.length ? JSON.stringify(clean) : null;
    await this.settings.save(s);
    return this.status();
  }

  async status() {
    const s = await this.row();
    let last: MailScanSummary | null = null;
    try {
      last = s.mailScanLastResult ? (JSON.parse(s.mailScanLastResult) as MailScanSummary) : null;
    } catch {
      last = null;
    }
    return {
      configured: this.configured(),
      cronKeySet: !!process.env.MAIL_CRON_KEY,
      user: process.env.MAIL_IMAP_USER ? process.env.MAIL_IMAP_USER.replace(/^(.).*(@.*)$/, '$1***$2') : null,
      labels: this.selectedLabels(s),
      senders: (process.env.MAIL_SENDERS || '').split(',').map((x) => x.trim()).filter(Boolean),
      enabled: s.mailScanEnabled,
      running: this.running,
      lastAt: s.mailScanLastAt ?? null,
      last,
    };
  }

  async setEnabled(enabled: boolean) {
    const s = await this.row();
    s.mailScanEnabled = enabled;
    await this.settings.save(s);
    return this.status();
  }

  private async autoTick() {
    if (!this.configured()) return;
    const s = await this.row();
    if (s.mailScanEnabled) await this.scan();
  }

  // So khoá bí mật (dùng cho dịch vụ gọi định kỳ bên ngoài, giúp đánh thức Render miễn phí) — so sánh an toàn thời gian.
  checkCronKey(key?: string): boolean {
    const want = process.env.MAIL_CRON_KEY;
    if (!want || !key) return false;
    const a = Buffer.from(key);
    const b = Buffer.from(want);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  // Chạy nền: trả về ngay, kết quả xem ở status().
  start(days?: number): { started: boolean; reason?: string } {
    if (!this.configured()) return { started: false, reason: 'Chưa cấu hình hộp thư (thiếu MAIL_IMAP_USER / MAIL_IMAP_PASS trên Render).' };
    if (this.running) return { started: false, reason: 'Đang quét, vui lòng chờ.' };
    this.scan(days).catch(() => undefined);
    return { started: true };
  }

  async scan(days?: number): Promise<MailScanSummary> {
    const sum: MailScanSummary = { at: new Date().toISOString(), mails: 0, links: 0, added: 0, duplicates: 0, skipped: 0 };
    if (this.running) return sum;
    this.running = true;
    const setting = await this.row();
    const lookback = days && days > 0 ? Math.min(30, Math.floor(days)) : 0;
    const since = lookback ? new Date(Date.now() - lookback * 86400000) : setting.mailScanLastAt ? new Date(setting.mailScanLastAt.getTime() - 10 * 60 * 1000) : new Date(Date.now() - FIRST_RUN_DAYS * 86400000);
    const client = this.newClient();
    const senders = (process.env.MAIL_SENDERS || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
    try {
      await client.connect();
      const jobs: { url: string; note: string }[] = [];
      for (const label of this.selectedLabels(setting)) {
        let lock;
        try {
          lock = await client.getMailboxLock(label, { readOnly: true });
        } catch {
          continue; // nhãn không còn tồn tại
        }
        try {
          const uids = (await client.search({ since }, { uid: true })) || [];
          // Thư mới nhất trước — nếu quá nhiều link thì phần cũ để lần quét sau ("quét lùi ngày").
          for (const uid of uids.slice(-MAX_MAILS).reverse()) {
            if (jobs.length >= MAX_LINKS_PER_SCAN) break;
            const msg = await client.fetchOne(String(uid), { source: true, internalDate: true }, { uid: true });
            if (!msg || !msg.source) continue;
            if (msg.internalDate && new Date(msg.internalDate as Date).getTime() < since.getTime()) continue;
            const mail = await simpleParser(msg.source);
            const from = (mail.from?.text || '').toLowerCase();
            if (senders.length && !senders.some((x) => from.includes(x))) continue;
            sum.mails++;
            const note = `Từ email: ${(mail.subject || '').slice(0, 120)}`;
            for (const url of pickJobLinks(typeof mail.html === 'string' ? mail.html : '', mail.text || '')) {
              if (jobs.length < MAX_LINKS_PER_SCAN) jobs.push({ url, note });
            }
          }
        } finally {
          lock.release();
        }
      }
      await client.logout().catch(() => undefined);

      sum.links = jobs.length;
      let i = 0;
      const worker = async () => {
        while (i < jobs.length) {
          const j = jobs[i++];
          try {
            const r = await this.imports.addOne(j.url, { quiet: true, note: j.note });
            if (r.result === 'new') sum.added++;
            else if (r.result === 'duplicate') sum.duplicates++;
            else sum.skipped++;
          } catch {
            sum.skipped++;
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    } catch (e) {
      sum.error = (e as Error).message?.slice(0, 200) || 'Lỗi không rõ';
      this.log.warn(`Quét email lỗi: ${sum.error}`);
      try {
        await client.logout();
      } catch {
        /* bỏ qua */
      }
    } finally {
      this.running = false;
    }
    const s = await this.row();
    if (!sum.error) s.mailScanLastAt = new Date();
    s.mailScanLastResult = JSON.stringify(sum);
    await this.settings.save(s);
    return sum;
  }
}
