import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createHmac } from 'crypto';
import * as nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

// Đợt 150 — "Hộp thư" cho Admin: hộp thư hỗ trợ (đọc IMAP + trả lời ngay trên web), mẫu email sửa được,
// danh sách email và chiến dịch giới thiệu (soạn → duyệt → gửi thử → gửi theo lô).
// Thông tin đăng nhập hộp thư nằm ở biến môi trường trên Render (KHÔNG lưu CSDL, KHÔNG hiện trên web):
//   SUPPORT_MAIL_USER (địa chỉ hộp thư), SUPPORT_MAIL_PASS,
//   SUPPORT_IMAP_HOST, SUPPORT_IMAP_PORT (993), SUPPORT_SMTP_HOST, SUPPORT_SMTP_PORT (465),
//   SUPPORT_MAIL_NAME (tên hiển thị người gửi, tuỳ chọn).
const MAX_FETCH = 40;
const SEND_BATCH = 40;
const SEND_DELAY_MS = 700;

type Row = Record<string, any>;

// Mẫu mặc định (Admin sửa được trên web). Biến: {{ten}}, {{cong_ty}}, {{tieu_de}}, {{web}}.
const DEFAULT_TEMPLATES: { id: string; kind: 'reply' | 'system' | 'promo'; name: string; subject: string; body: string }[] = [
  {
    id: 'da-nhan-yeu-cau',
    kind: 'reply',
    name: 'Xác nhận đã nhận yêu cầu',
    subject: 'Đã tiếp nhận yêu cầu của {{ten}}',
    body: 'Kính gửi {{ten}},\n\nChúng tôi đã tiếp nhận yêu cầu của quý vị và sẽ phản hồi trong thời gian sớm nhất (tối đa 01 ngày làm việc).\n\nTrân trọng,\nBộ phận Hỗ trợ',
  },
  {
    id: 'tra-loi-chung',
    kind: 'reply',
    name: 'Trả lời chung',
    subject: 'Phản hồi: {{tieu_de}}',
    body: 'Kính gửi {{ten}},\n\nCảm ơn quý vị đã liên hệ. [Nội dung trả lời].\n\nNếu cần hỗ trợ thêm, quý vị vui lòng phản hồi email này.\n\nTrân trọng,\nBộ phận Hỗ trợ',
  },
  {
    id: 'huong-dan-dang-tin',
    kind: 'reply',
    name: 'Hướng dẫn đăng tin tuyển dụng',
    subject: 'Hướng dẫn đăng tin tuyển dụng',
    body: 'Kính gửi {{ten}},\n\nĐể đăng tin tuyển dụng, quý vị thực hiện các bước sau:\n1. Đăng nhập tài khoản nhà tuyển dụng tại {{web}}.\n2. Hoàn thiện hồ sơ công ty.\n3. Chọn "Đăng tin mới", điền thông tin và gửi duyệt.\n\nTin sẽ được duyệt và hiển thị sau khi kiểm tra.\n\nTrân trọng,\nBộ phận Hỗ trợ',
  },
  {
    id: 'huong-dan-ung-vien',
    kind: 'reply',
    name: 'Hướng dẫn ứng viên',
    subject: 'Hướng dẫn tạo hồ sơ và ứng tuyển',
    body: 'Kính gửi {{ten}},\n\nQuý vị có thể tạo hồ sơ và ứng tuyển tại {{web}}. Với lao động phổ thông, chỉ cần để lại họ tên và số điện thoại, nhà tuyển dụng sẽ liên hệ.\n\nTrân trọng,\nBộ phận Hỗ trợ',
  },
  {
    id: 'tin-tu-choi',
    kind: 'reply',
    name: 'Thông báo tin chưa được duyệt',
    subject: 'Tin tuyển dụng chưa được duyệt',
    body: 'Kính gửi {{ten}},\n\nTin tuyển dụng "{{tieu_de}}" của {{cong_ty}} hiện chưa đáp ứng quy định đăng tin. Quý vị vui lòng bổ sung hoặc chỉnh sửa thông tin rồi gửi duyệt lại.\n\nTrân trọng,\nBộ phận Hỗ trợ',
  },
  {
    id: 'gioi-thieu-nha-tuyen-dung',
    kind: 'promo',
    name: 'Giới thiệu dành cho nhà tuyển dụng',
    subject: 'Đăng tin tuyển dụng miễn phí tại Việc Làm Ngay',
    body: 'Kính gửi {{ten}},\n\nViệc Làm Ngay là website tuyển dụng giúp doanh nghiệp đăng tin, nhận hồ sơ và liên hệ ứng viên nhanh chóng, miễn phí đăng tin cơ bản.\n\nQuý vị có thể tạo tài khoản nhà tuyển dụng tại {{web}}.\n\nTrân trọng,\nViệc Làm Ngay',
  },
  {
    id: 'gioi-thieu-ung-vien',
    kind: 'promo',
    name: 'Giới thiệu dành cho người tìm việc',
    subject: 'Việc làm mới mỗi ngày tại Việc Làm Ngay',
    body: 'Kính gửi {{ten}},\n\nViệc Làm Ngay cập nhật việc làm mới mỗi ngày, ứng tuyển nhanh chỉ với một lần tạo hồ sơ. Mời quý vị xem tại {{web}}.\n\nTrân trọng,\nViệc Làm Ngay',
  },
];

@Injectable()
export class SupportMailService implements OnModuleInit {
  private readonly log = new Logger(SupportMailService.name);
  private syncing = false;

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.ensure();
    } catch (e) {
      this.log.warn(`Không khởi tạo bảng hộp thư: ${(e as Error).message}`);
    }
  }

  private async ensure() {
    await this.ds.query(`CREATE TABLE IF NOT EXISTS support_messages (
      id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      uid text UNIQUE,
      message_id text,
      direction varchar(8) NOT NULL DEFAULT 'in',
      from_name text, from_email text, to_email text,
      subject text, body text,
      status varchar(12) NOT NULL DEFAULT 'new',
      received_at timestamp NOT NULL DEFAULT now(),
      replied_at timestamp, parent_id uuid,
      created_at timestamp NOT NULL DEFAULT now())`);
    await this.ds.query(`CREATE TABLE IF NOT EXISTS email_templates (
      id varchar(60) PRIMARY KEY, kind varchar(10) NOT NULL DEFAULT 'reply',
      name text NOT NULL, subject text NOT NULL, body text NOT NULL,
      updated_at timestamp NOT NULL DEFAULT now())`);
    await this.ds.query(`CREATE TABLE IF NOT EXISTS email_contacts (
      id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      email text NOT NULL UNIQUE, name text, company text,
      source varchar(20) NOT NULL DEFAULT 'manual',
      status varchar(14) NOT NULL DEFAULT 'active',
      created_at timestamp NOT NULL DEFAULT now())`);
    await this.ds.query(`CREATE TABLE IF NOT EXISTS email_campaigns (
      id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      name text NOT NULL, subject text NOT NULL, body text NOT NULL,
      source_filter varchar(20), status varchar(10) NOT NULL DEFAULT 'draft',
      sent_count int NOT NULL DEFAULT 0, created_at timestamp NOT NULL DEFAULT now(),
      approved_at timestamp, last_sent_at timestamp)`);
    await this.ds.query(`CREATE TABLE IF NOT EXISTS email_campaign_sends (
      campaign_id uuid NOT NULL, contact_id uuid NOT NULL, sent_at timestamp NOT NULL DEFAULT now(), error text,
      PRIMARY KEY (campaign_id, contact_id))`);
    for (const t of DEFAULT_TEMPLATES) {
      await this.ds.query(
        `INSERT INTO email_templates (id, kind, name, subject, body) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
        [t.id, t.kind, t.name, t.subject, t.body],
      );
    }
  }

  // ---- cấu hình ----
  private get user() {
    return process.env.SUPPORT_MAIL_USER || '';
  }
  imapReady() {
    return !!(this.user && process.env.SUPPORT_MAIL_PASS && process.env.SUPPORT_IMAP_HOST);
  }
  smtpReady() {
    return !!(this.user && process.env.SUPPORT_MAIL_PASS && process.env.SUPPORT_SMTP_HOST);
  }
  private transport() {
    if (!this.smtpReady()) throw new BadRequestException('Chưa cấu hình gửi thư (biến SUPPORT_SMTP_HOST, SUPPORT_MAIL_USER, SUPPORT_MAIL_PASS trên Render).');
    const port = Number(process.env.SUPPORT_SMTP_PORT) || 465;
    return nodemailer.createTransport({
      host: process.env.SUPPORT_SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: this.user, pass: process.env.SUPPORT_MAIL_PASS },
    });
  }
  private fromHeader() {
    return `${process.env.SUPPORT_MAIL_NAME || 'Hỗ trợ Việc Làm Ngay'} <${this.user}>`;
  }
  private webUrl() {
    return (process.env.WEB_URL || 'https://www.vieclamngay.vn').replace(/\/$/, '');
  }
  private apiUrl() {
    return (process.env.API_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
  }
  private secret() {
    return process.env.MAIL_CRON_KEY || process.env.JWT_SECRET || 'tvl-unsub';
  }
  unsubToken(email: string) {
    return createHmac('sha256', this.secret()).update(email.toLowerCase()).digest('hex').slice(0, 24);
  }

  async status() {
    const [m] = await this.ds.query(`SELECT count(*) FILTER (WHERE direction='in' AND status='new')::int AS fresh, count(*) FILTER (WHERE direction='in')::int AS total FROM support_messages`);
    return { address: this.user ? this.user.replace(/^(.{2}).*(@.*)$/, '$1***$2') : null, imapReady: this.imapReady(), smtpReady: this.smtpReady(), fresh: m?.fresh ?? 0, total: m?.total ?? 0, syncing: this.syncing };
  }

  // ---- hộp thư đến ----
  async sync(): Promise<{ fetched: number; error?: string }> {
    if (!this.imapReady()) return { fetched: 0, error: 'Chưa cấu hình đọc thư (SUPPORT_IMAP_HOST, SUPPORT_MAIL_USER, SUPPORT_MAIL_PASS trên Render).' };
    if (this.syncing) return { fetched: 0, error: 'Đang lấy thư, vui lòng chờ.' };
    this.syncing = true;
    const c = new ImapFlow({
      host: process.env.SUPPORT_IMAP_HOST!,
      port: Number(process.env.SUPPORT_IMAP_PORT) || 993,
      secure: process.env.SUPPORT_IMAP_SECURE !== 'false',
      auth: { user: this.user, pass: process.env.SUPPORT_MAIL_PASS! },
      logger: false,
    });
    c.on('error', () => undefined);
    let fetched = 0;
    try {
      await c.connect();
      const lock = await c.getMailboxLock('INBOX');
      try {
        const since = new Date(Date.now() - 14 * 86400_000);
        const uids = ((await c.search({ since })) || []) as number[];
        const mine = this.user.toLowerCase();
        for (const uid of uids.slice(-MAX_FETCH)) {
          const key = `${this.user}:${uid}`;
          const ex = await this.ds.query(`SELECT 1 FROM support_messages WHERE uid=$1`, [key]);
          if (ex.length) continue;
          const msg = await c.fetchOne(String(uid), { source: true }, { uid: true });
          if (!msg || !msg.source) continue;
          const p = await simpleParser(msg.source);
          const from = p.from?.value?.[0];
          if (!from?.address || from.address.toLowerCase() === mine) continue;
          const text = (p.text || '').trim().slice(0, 20000);
          await this.ds.query(
            `INSERT INTO support_messages (uid, message_id, direction, from_name, from_email, to_email, subject, body, received_at)
             VALUES ($1,$2,'in',$3,$4,$5,$6,$7,$8) ON CONFLICT (uid) DO NOTHING`,
            [key, p.messageId ?? null, from.name || null, from.address, this.user, (p.subject || '(không có tiêu đề)').slice(0, 300), text, p.date ?? new Date()],
          );
          fetched++;
        }
      } finally {
        lock.release();
      }
      await c.logout();
      return { fetched };
    } catch (e) {
      const err = e as { authenticationFailed?: boolean; responseText?: string; message?: string };
      return { fetched, error: err.authenticationFailed ? 'Sai tài khoản hoặc mật khẩu hộp thư — kiểm tra biến SUPPORT_MAIL_USER / SUPPORT_MAIL_PASS trên Render.' : err.responseText || err.message || 'Không kết nối được hộp thư' };
    } finally {
      this.syncing = false;
      try {
        c.close();
      } catch {
        /* bỏ qua */
      }
    }
  }

  async inbox(status?: string, q?: string) {
    const where: string[] = ["direction='in'"];
    const args: unknown[] = [];
    if (status && ['new', 'replied', 'closed'].includes(status)) {
      args.push(status);
      where.push(`status=$${args.length}`);
    }
    if (q?.trim()) {
      args.push(`%${q.trim()}%`);
      where.push(`(from_email ILIKE $${args.length} OR coalesce(from_name,'') ILIKE $${args.length} OR subject ILIKE $${args.length} OR body ILIKE $${args.length})`);
    }
    const items: Row[] = await this.ds.query(
      `SELECT id, from_name AS "fromName", from_email AS "fromEmail", subject, left(body, 160) AS preview, status, received_at AS "receivedAt", replied_at AS "repliedAt"
         FROM support_messages WHERE ${where.join(' AND ')} ORDER BY received_at DESC LIMIT 200`,
      args,
    );
    return { items };
  }

  async message(id: string) {
    const [m]: Row[] = await this.ds.query(
      `SELECT id, from_name AS "fromName", from_email AS "fromEmail", subject, body, status, received_at AS "receivedAt", replied_at AS "repliedAt" FROM support_messages WHERE id=$1`,
      [id],
    );
    if (!m) throw new NotFoundException('Không tìm thấy thư');
    const replies: Row[] = await this.ds.query(
      `SELECT id, subject, body, created_at AS "at" FROM support_messages WHERE parent_id=$1 AND direction='out' ORDER BY created_at`,
      [id],
    );
    return { ...m, replies };
  }

  async setStatus(id: string, status: string) {
    if (!['new', 'replied', 'closed'].includes(status)) throw new BadRequestException('Trạng thái không hợp lệ');
    await this.ds.query(`UPDATE support_messages SET status=$2 WHERE id=$1`, [id, status]);
    return { ok: true };
  }

  async removeMessage(id: string) {
    await this.ds.query(`DELETE FROM support_messages WHERE id=$1 OR parent_id=$1`, [id]);
    return { ok: true };
  }

  async reply(id: string, subject: string, body: string) {
    const [m]: Row[] = await this.ds.query(`SELECT from_email, from_name, message_id, subject FROM support_messages WHERE id=$1 AND direction='in'`, [id]);
    if (!m) throw new NotFoundException('Không tìm thấy thư');
    if (!body?.trim()) throw new BadRequestException('Nội dung trả lời đang trống');
    const subj = (subject?.trim() || `Re: ${m.subject}`).slice(0, 300);
    await this.transport().sendMail({
      from: this.fromHeader(),
      to: m.from_email,
      subject: subj,
      text: body,
      html: this.html(body),
      inReplyTo: m.message_id || undefined,
      references: m.message_id || undefined,
    });
    await this.ds.query(
      `INSERT INTO support_messages (direction, from_email, to_email, subject, body, status, parent_id) VALUES ('out',$1,$2,$3,$4,'replied',$5)`,
      [this.user, m.from_email, subj, body, id],
    );
    await this.ds.query(`UPDATE support_messages SET status='replied', replied_at=now() WHERE id=$1`, [id]);
    return { ok: true };
  }

  // ---- mẫu email ----
  async templates() {
    return { items: await this.ds.query(`SELECT id, kind, name, subject, body, updated_at AS "updatedAt" FROM email_templates ORDER BY kind, name`) };
  }
  async saveTemplate(id: string | undefined, b: { kind?: string; name: string; subject: string; body: string }) {
    if (!b?.name?.trim() || !b?.subject?.trim() || !b?.body?.trim()) throw new BadRequestException('Cần đủ tên, tiêu đề và nội dung mẫu');
    const kind = ['reply', 'system', 'promo'].includes(b.kind || '') ? b.kind : 'reply';
    const key = id || `mau-${Date.now().toString(36)}`;
    await this.ds.query(
      `INSERT INTO email_templates (id, kind, name, subject, body, updated_at) VALUES ($1,$2,$3,$4,$5,now())
       ON CONFLICT (id) DO UPDATE SET kind=$2, name=$3, subject=$4, body=$5, updated_at=now()`,
      [key, kind, b.name.trim().slice(0, 120), b.subject.trim().slice(0, 300), b.body],
    );
    return { id: key };
  }
  async removeTemplate(id: string) {
    await this.ds.query(`DELETE FROM email_templates WHERE id=$1`, [id]);
    return { ok: true };
  }
  async resetTemplate(id: string) {
    const d = DEFAULT_TEMPLATES.find((t) => t.id === id);
    if (!d) throw new BadRequestException('Mẫu này không có bản gốc để khôi phục');
    await this.ds.query(`UPDATE email_templates SET kind=$2, name=$3, subject=$4, body=$5, updated_at=now() WHERE id=$1`, [d.id, d.kind, d.name, d.subject, d.body]);
    return { ok: true };
  }

  private fill(s: string, v: Record<string, string>) {
    return s.replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] ?? '');
  }
  private esc(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  private html(body: string, footer = '') {
    const paras = this.esc(body).replace(/\n{2,}/g, '</p><p style="margin:0 0 12px">').replace(/\n/g, '<br>');
    return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0A0E14;line-height:1.6"><p style="margin:0 0 12px">${paras}</p>${footer}</div>`;
  }

  // ---- danh sách email ----
  async contacts(q?: string, status?: string, source?: string) {
    const where: string[] = ['true'];
    const args: unknown[] = [];
    if (q?.trim()) {
      args.push(`%${q.trim()}%`);
      where.push(`(email ILIKE $${args.length} OR coalesce(name,'') ILIKE $${args.length} OR coalesce(company,'') ILIKE $${args.length})`);
    }
    if (status && ['active', 'unsubscribed'].includes(status)) {
      args.push(status);
      where.push(`status=$${args.length}`);
    }
    if (source) {
      args.push(source);
      where.push(`source=$${args.length}`);
    }
    const items = await this.ds.query(`SELECT id, email, name, company, source, status, created_at AS "createdAt" FROM email_contacts WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 500`, args);
    const [t] = await this.ds.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE status='active')::int AS active FROM email_contacts`);
    return { items, total: t.total, active: t.active };
  }

  /** Dán danh sách: mỗi dòng "email, tên, công ty". */
  async addContacts(text: string, source = 'manual') {
    let added = 0;
    let skipped = 0;
    for (const line of String(text || '').split(/\r?\n/)) {
      const m = line.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      if (!m) continue;
      const email = m[0].toLowerCase();
      const rest = line.replace(m[0], '').split(/[,;\t]/).map((x) => x.trim()).filter(Boolean);
      if (this.junkEmail(email)) {
        skipped++;
        continue;
      }
      const r = await this.ds.query(
        `INSERT INTO email_contacts (email, name, company, source) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING RETURNING id`,
        [email, rest[0] || null, rest[1] || null, source],
      );
      if (r.length) added++;
      else skipped++;
    }
    return { added, skipped };
  }
  private junkEmail(e: string) {
    return /@(guest\.local|[^@]*-demo\.vn|example\.(com|org)|[^@]*\.(test|local|invalid))$/i.test(e) || /^(no-?reply|donotreply|mailer-daemon)@/i.test(e);
  }

  /** Gom email từ dữ liệu có sẵn trong hệ thống. kind: employers | job_contacts | imports | candidates_optin */
  async harvest(kind: string) {
    let rows: { email: string; name?: string; company?: string }[] = [];
    if (kind === 'employers') {
      rows = await this.ds.query(`SELECT u.email AS email, c.name AS company FROM users u JOIN company_users cu ON cu.user_id = u.id LEFT JOIN companies c ON c.id = cu.company_id`).catch(() => []);
    } else if (kind === 'job_contacts') {
      rows = await this.ds.query(`SELECT DISTINCT lower(j.contact_email) AS email, j.contact_name AS name FROM job_postings j WHERE j.contact_email ~* '^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$'`);
    } else if (kind === 'imports') {
      rows = await this.ds.query(
        `SELECT DISTINCT lower((regexp_match(data::text, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'))[1]) AS email FROM job_imports WHERE data::text ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'`,
      );
    } else if (kind === 'candidates_optin') {
      rows = await this.ds.query(`SELECT u.email AS email, u.full_name AS name FROM users u JOIN candidate_profiles p ON p.user_id = u.id WHERE p.allow_job_notifications = true`).catch(() => []);
    } else throw new BadRequestException('Nguồn gom không hợp lệ');
    let added = 0;
    for (const r of rows) {
      const email = String(r.email || '').toLowerCase().trim();
      if (!email || this.junkEmail(email)) continue;
      const x = await this.ds.query(
        `INSERT INTO email_contacts (email, name, company, source) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING RETURNING id`,
        [email, r.name || null, r.company || null, kind],
      );
      if (x.length) added++;
    }
    return { scanned: rows.length, added };
  }

  async setContactStatus(id: string, status: string) {
    if (!['active', 'unsubscribed'].includes(status)) throw new BadRequestException('Trạng thái không hợp lệ');
    await this.ds.query(`UPDATE email_contacts SET status=$2 WHERE id=$1`, [id, status]);
    return { ok: true };
  }
  async removeContact(id: string) {
    await this.ds.query(`DELETE FROM email_contacts WHERE id=$1`, [id]);
    return { ok: true };
  }
  async unsubscribe(email: string, token: string) {
    const e = String(email || '').toLowerCase();
    if (!e || token !== this.unsubToken(e)) throw new NotFoundException();
    await this.ds.query(`UPDATE email_contacts SET status='unsubscribed' WHERE email=$1`, [e]);
    await this.ds.query(`INSERT INTO email_contacts (email, source, status) VALUES ($1,'manual','unsubscribed') ON CONFLICT (email) DO UPDATE SET status='unsubscribed'`, [e]);
    return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Arial,sans-serif;max-width:480px;margin:60px auto;padding:0 16px"><h2>Đã hủy nhận thư</h2><p>Địa chỉ ${this.esc(e)} sẽ không nhận thư giới thiệu từ chúng tôi nữa.</p></body>`;
  }

  // ---- chiến dịch ----
  async campaigns() {
    const items: Row[] = await this.ds.query(`SELECT id, name, subject, body, source_filter AS "sourceFilter", status, sent_count AS "sentCount", created_at AS "createdAt", approved_at AS "approvedAt", last_sent_at AS "lastSentAt" FROM email_campaigns ORDER BY created_at DESC LIMIT 100`);
    for (const c of items) {
      const [r] = await this.ds.query(
        `SELECT count(*)::int AS n FROM email_contacts ct WHERE ct.status='active' AND ($2::text IS NULL OR ct.source=$2) AND NOT EXISTS (SELECT 1 FROM email_campaign_sends s WHERE s.campaign_id=$1 AND s.contact_id=ct.id)`,
        [c.id, c.sourceFilter],
      );
      c.remaining = r.n;
    }
    return { items };
  }
  async saveCampaign(id: string | undefined, b: { name: string; subject: string; body: string; sourceFilter?: string | null }) {
    if (!b?.name?.trim() || !b?.subject?.trim() || !b?.body?.trim()) throw new BadRequestException('Cần đủ tên chiến dịch, tiêu đề và nội dung');
    const src = b.sourceFilter || null;
    if (id) {
      const [c] = await this.ds.query(`SELECT status FROM email_campaigns WHERE id=$1`, [id]);
      if (!c) throw new NotFoundException('Không tìm thấy chiến dịch');
      // Sửa nội dung sau khi đã duyệt → quay về "nháp" để duyệt lại.
      await this.ds.query(`UPDATE email_campaigns SET name=$2, subject=$3, body=$4, source_filter=$5, status=CASE WHEN status='sent' THEN status ELSE 'draft' END, approved_at=NULL WHERE id=$1`, [id, b.name.trim(), b.subject.trim(), b.body, src]);
      return { id };
    }
    const [r] = await this.ds.query(`INSERT INTO email_campaigns (name, subject, body, source_filter) VALUES ($1,$2,$3,$4) RETURNING id`, [b.name.trim().slice(0, 150), b.subject.trim().slice(0, 300), b.body, src]);
    return { id: r.id };
  }
  async approveCampaign(id: string, approve: boolean) {
    await this.ds.query(`UPDATE email_campaigns SET status=$2, approved_at=$3 WHERE id=$1 AND status<>'sent'`, [id, approve ? 'approved' : 'draft', approve ? new Date() : null]);
    return { ok: true };
  }
  async removeCampaign(id: string) {
    await this.ds.query(`DELETE FROM email_campaign_sends WHERE campaign_id=$1`, [id]);
    await this.ds.query(`DELETE FROM email_campaigns WHERE id=$1`, [id]);
    return { ok: true };
  }

  private footer(email: string) {
    const api = this.apiUrl();
    const link = api ? `${api}/public/email-unsub?e=${encodeURIComponent(email)}&t=${this.unsubToken(email)}` : '';
    const text = `\n\n—\nThư giới thiệu gửi từ ${this.user}. ${link ? `Không muốn nhận thư nữa, vui lòng bấm: ${link}` : 'Không muốn nhận thư nữa, vui lòng trả lời thư này với nội dung "Hủy nhận".'}`;
    const html = `<hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0"><p style="font-size:12px;color:#6b7280">Thư giới thiệu gửi từ ${this.esc(this.user)}. ${link ? `<a href="${link}">Hủy nhận thư</a>` : 'Không muốn nhận thư nữa, vui lòng trả lời thư này với nội dung "Hủy nhận".'}</p>`;
    return { text, html, link };
  }

  async testCampaign(id: string, to: string) {
    const [c] = await this.ds.query(`SELECT subject, body FROM email_campaigns WHERE id=$1`, [id]);
    if (!c) throw new NotFoundException('Không tìm thấy chiến dịch');
    const addr = (to || '').trim() || this.user;
    const v = { ten: 'Quý khách', cong_ty: 'Công ty mẫu', tieu_de: '', web: this.webUrl() };
    const f = this.footer(addr);
    await this.transport().sendMail({ from: this.fromHeader(), to: addr, subject: `[Gửi thử] ${this.fill(c.subject, v)}`, text: this.fill(c.body, v) + f.text, html: this.html(this.fill(c.body, v), f.html) });
    return { ok: true, to: addr };
  }

  /** Gửi một lô (tối đa SEND_BATCH) — chỉ cho chiến dịch đã duyệt. */
  async sendBatch(id: string) {
    const [c] = await this.ds.query(`SELECT * FROM email_campaigns WHERE id=$1`, [id]);
    if (!c) throw new NotFoundException('Không tìm thấy chiến dịch');
    if (c.status !== 'approved') throw new BadRequestException('Chiến dịch phải được Duyệt trước khi gửi.');
    const tp = this.transport();
    const list: Row[] = await this.ds.query(
      `SELECT ct.id, ct.email, ct.name, ct.company FROM email_contacts ct
        WHERE ct.status='active' AND ($2::text IS NULL OR ct.source=$2)
          AND NOT EXISTS (SELECT 1 FROM email_campaign_sends s WHERE s.campaign_id=$1 AND s.contact_id=ct.id)
        ORDER BY ct.created_at LIMIT ${SEND_BATCH}`,
      [id, c.source_filter],
    );
    let sent = 0;
    let failed = 0;
    for (const r of list) {
      const v = { ten: r.name || 'Quý khách', cong_ty: r.company || '', tieu_de: '', web: this.webUrl() };
      const f = this.footer(r.email);
      try {
        await tp.sendMail({
          from: this.fromHeader(),
          to: r.email,
          subject: this.fill(c.subject, v),
          text: this.fill(c.body, v) + f.text,
          html: this.html(this.fill(c.body, v), f.html),
          headers: f.link ? { 'List-Unsubscribe': `<${f.link}>` } : undefined,
        });
        await this.ds.query(`INSERT INTO email_campaign_sends (campaign_id, contact_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, r.id]);
        sent++;
      } catch (e) {
        failed++;
        await this.ds.query(`INSERT INTO email_campaign_sends (campaign_id, contact_id, error) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [id, r.id, String((e as Error).message).slice(0, 300)]);
      }
      await new Promise((res) => setTimeout(res, SEND_DELAY_MS));
    }
    await this.ds.query(`UPDATE email_campaigns SET sent_count = sent_count + $2, last_sent_at = now() WHERE id=$1`, [id, sent]);
    const [rem] = await this.ds.query(
      `SELECT count(*)::int AS n FROM email_contacts ct WHERE ct.status='active' AND ($2::text IS NULL OR ct.source=$2) AND NOT EXISTS (SELECT 1 FROM email_campaign_sends s WHERE s.campaign_id=$1 AND s.contact_id=ct.id)`,
      [id, c.source_filter],
    );
    if (rem.n === 0) await this.ds.query(`UPDATE email_campaigns SET status='sent' WHERE id=$1`, [id]);
    return { sent, failed, remaining: rem.n };
  }
}
