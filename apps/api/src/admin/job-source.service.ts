import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { setPoliteStore } from '../common/polite-crawl.util';
import { JobSource, JobSourceKind } from '../database/entities/job-source.entity';
import { JobImport } from '../database/entities/job-import.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { JobImportService, normalizeSourceUrl } from './job-import.service';
import { ADAPTERS, adapterById, detectSource, fetchHtml, sleep } from '../common/job-sources.util';
import { normalizeSearchText } from '../common/search-text.util';

// Đợt 147 — quét "Nguồn theo dõi". Mỗi lần chạy (cron ngoài / nút Quét ngay / bộ hẹn giờ trong máy chủ):
//   1) Đọc danh sách: vòng đầu đọc hết các trang; các vòng sau (mỗi ~20 giờ) dừng sớm khi gặp trang toàn tin cũ.
//   2) Tin mới → hàng đợi `queue` (đã loại trùng với Hộp nhập tin và tin đã đăng).
//   3) Lấy tối đa BATCH tin từ hàng đợi → "Hộp nhập tin từ link" (Chờ xem). Phần còn lại để lần sau — chạy được trên Render miễn phí.
const EVERY_MS = 10 * 60 * 1000;
const REDISCOVER_MS = 20 * 60 * 60 * 1000;
// Đợt 157 — lấy ÍT mỗi lần, chia nhiều đợt: mỗi lượt chạy (10 phút) tối đa 2 trang danh sách + 10 tin; khoảng giãn cách giữa các lần tải do cổng lịch sự lo.
const PAGES_PER_RUN = 2;
const BATCH = 10;
const PAGE_DELAY_MS = 0;
const JOB_DELAY_MS = 0;
const STEP_MAX_ITEMS = 15;
const RUN_BUDGET_MS = 110_000;
const MAX_QUEUE = 3000;

@Injectable()
export class JobSourceService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(JobSourceService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private runningId: string | null = null;

  constructor(
    @InjectRepository(JobSource) private readonly repo: Repository<JobSource>,
    @InjectRepository(JobImport) private readonly impRepo: Repository<JobImport>,
    @InjectRepository(JobPosting) private readonly jobRepo: Repository<JobPosting>,
    private readonly imports: JobImportService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    setPoliteStore(this.ds).catch(() => undefined);
    this.timer = setInterval(() => {
      this.runDue().catch(() => undefined);
    }, EVERY_MS);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  sites() {
    return ADAPTERS.map((a) => ({ id: a.id, name: a.name, canSearch: !!a.searchUrl }));
  }

  async list() {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    return {
      running: this.running,
      runningId: this.runningId,
      cronKeySet: !!process.env.MAIL_CRON_KEY,
      items: rows.map((r) => ({ ...r, queue: undefined, queued: (r.queue ?? []).length })),
    };
  }

  // Đọc thử một link (chưa lưu): cho Admin thấy đọc được bao nhiêu tin trước khi thêm.
  async preview(raw: string) {
    const d = this.detect(raw);
    const { html, finalUrl } = await this.fetchOrFail(d.listingUrl);
    const p = d.adapter.parseList(html, finalUrl);
    return {
      site: d.site,
      siteName: d.adapter.name,
      kind: d.kind,
      listingUrl: d.listingUrl,
      label: this.labelFor(d.kind, p.title, d.label),
      found: p.jobs.length,
      total: p.total ?? null,
      lastPage: p.lastPage ?? null,
      sample: p.jobs.slice(0, 5),
      trusted: d.site !== 'generic',
      warning: p.jobs.length ? undefined : 'Không thấy link tin nào trong trang này — có thể trang chặn truy cập tự động hoặc cần bộ đọc riêng cho trang này.',
    };
  }

  // Lỗi tải trang nguồn → báo 400 kèm lý do tiếng Việt (không để lộ thành lỗi máy chủ 500).
  private async fetchOrFail(url: string) {
    try {
      return await fetchHtml(url);
    } catch (e) {
      throw new BadRequestException((e as Error).message || 'Không tải được trang nguồn');
    }
  }

  private detect(raw: string) {
    try {
      return detectSource(raw);
    } catch {
      throw new BadRequestException('Link không hợp lệ');
    }
  }

  private labelFor(kind: JobSourceKind, title?: string, hint?: string): string {
    const t = (title || hint || '').replace(/\s+/g, ' ').trim();
    const prefix = kind === 'company' ? 'Công ty' : kind === 'category' ? 'Ngành' : kind === 'keyword' ? 'Từ khoá' : 'Danh sách';
    return (t ? `${prefix}: ${t}` : prefix).slice(0, 200);
  }

  async add(raw: string, opts: { autoPublish?: boolean; label?: string; maxPages?: number } = {}) {
    const d = this.detect(raw);
    // Đọc trang 1 để kiểm tra đọc được + lấy tên + tổng số tin; không đọc được thì vẫn cho thêm nhưng báo cảnh báo.
    let title: string | undefined;
    let total: number | undefined;
    let warning: string | undefined;
    try {
      const { html, finalUrl } = await fetchHtml(d.listingUrl);
      const p = d.adapter.parseList(html, finalUrl);
      title = p.title;
      total = p.total;
      if (!p.jobs.length) warning = 'Đã lưu nhưng chưa thấy link tin nào trong trang này.';
    } catch (e) {
      warning = `Đã lưu nhưng lần đọc thử bị lỗi: ${(e as Error).message}`;
    }
    const url = d.listingUrl;
    const exist = await this.repo.findOne({ where: { url } });
    if (exist) throw new BadRequestException(`Nguồn này đã có: ${exist.label}`);
    const row = await this.repo.save(
      this.repo.create({
        kind: d.kind,
        site: d.site,
        label: (opts.label?.trim() || this.labelFor(d.kind, title, d.label)).slice(0, 200),
        url,
        originalUrl: raw.trim() === url ? null : raw.trim(),
        autoPublish: !!opts.autoPublish,
        maxPages: Math.min(200, Math.max(1, Math.floor(opts.maxPages || 40))),
        siteTotal: total ?? null,
        queue: [],
        cursorPage: 1,
        discoveredAt: new Date(),
        lastError: warning ?? null,
      }),
    );
    return { item: row, warning };
  }

  async update(id: string, patch: { enabled?: boolean; autoPublish?: boolean; label?: string; maxPages?: number }) {
    const r = await this.get(id);
    if (typeof patch.enabled === 'boolean') r.enabled = patch.enabled;
    if (typeof patch.autoPublish === 'boolean') r.autoPublish = patch.autoPublish;
    if (patch.label?.trim()) r.label = patch.label.trim().slice(0, 200);
    if (patch.maxPages) r.maxPages = Math.min(200, Math.max(1, Math.floor(patch.maxPages)));
    return this.repo.save(r);
  }

  async setSiteEnabled(site: string, enabled: boolean) {
    // `site` để trống = áp dụng cho tất cả nguồn.
    if (!site) {
      const r = await this.repo.createQueryBuilder().update(JobSource).set({ enabled }).execute();
      return { updated: r.affected ?? 0 };
    }
    const res = await this.repo.update({ site }, { enabled });
    return { updated: res.affected ?? 0 };
  }

  async remove(id: string) {
    const r = await this.get(id);
    await this.repo.delete(r.id);
    return { ok: true };
  }

  private async get(id: string) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Không tìm thấy nguồn theo dõi');
    return r;
  }

  // Tìm công ty theo tên trên MỌI trang nguồn có hỗ trợ tìm kiếm (không cần chọn trang): trả về các công ty khớp để
  // Admin bấm chọn (không tự chọn thay Admin). `site` để trống = tìm ở tất cả các trang.
  async searchCompany(site: string, q: string) {
    const name = (q || '').trim();
    if (name.length < 2) throw new BadRequestException('Nhập ít nhất 2 ký tự tên công ty');
    const ads = site ? [adapterById(site)] : ADAPTERS.filter((a) => !!a.searchUrl);
    if (!ads.length || ads.some((a) => !a.searchUrl)) throw new BadRequestException('Chưa có trang nào hỗ trợ tìm theo tên — hãy dán link công ty.');
    const tokens = normalizeSearchText(name).split(/\s+/).filter((t) => t.length > 1);
    const score = (n: string) => {
      const x = normalizeSearchText(n);
      return tokens.filter((t) => x.includes(t)).length;
    };
    const items: { name: string; url: string; listingUrl: string; score: number }[] = [];
    let lastErr = '';
    for (const ad of ads) {
      try {
        const { html, finalUrl } = await fetchHtml(ad.searchUrl!(name));
        const p = ad.parseList(html, finalUrl);
        for (const e of p.employers) {
          const sc = score(e.name);
          if (sc <= 0) continue;
          const d = this.detect(e.url);
          if (!items.some((x) => x.listingUrl === d.listingUrl)) items.push({ name: e.name, url: e.url, listingUrl: d.listingUrl, score: sc });
        }
      } catch (e) {
        lastErr = (e as Error).message || 'Không tải được trang nguồn';
      }
    }
    if (!items.length && lastErr) throw new BadRequestException(lastErr);
    items.sort((a, b) => b.score - a.score);
    return {
      items: items.slice(0, 10).map(({ name, url, listingUrl }) => ({ name, url, listingUrl })),
      note: items.length ? undefined : 'Không thấy công ty nào khớp tên này (công ty có thể chưa đăng tin). Thử tên ngắn hơn, hoặc dán link công ty.',
    };
  }

  // ---- Quét ----
  async known(urls: string[]): Promise<Set<string>> {
    if (!urls.length) return new Set();
    const out = new Set<string>();
    const imp: { u: string }[] = await this.impRepo.query(
      // Tin đã đăng nhưng sau đó bị xoá (job_id không còn) thì KHÔNG tính là "đã có" → cho phép đưa lại (kèm cảnh báo).
      `SELECT i.source_url AS u FROM job_imports i WHERE i.source_url = ANY($1) AND NOT (i.status IN ('published','accepted') AND NOT EXISTS (SELECT 1 FROM job_postings j WHERE j.id = i.job_id))
       UNION SELECT i.data->>'rawUrl' AS u FROM job_imports i WHERE i.data->>'rawUrl' = ANY($1) AND NOT (i.status IN ('published','accepted') AND NOT EXISTS (SELECT 1 FROM job_postings j WHERE j.id = i.job_id))`,
      [urls],
    );
    for (const r of imp) out.add(r.u);
    const jobs: { u: string }[] = await this.jobRepo.query(`SELECT source_url AS u FROM job_postings WHERE source_url = ANY($1)`, [urls]);
    for (const r of jobs) out.add(r.u);
    return out;
  }

  private norm(u: string): string {
    try {
      return normalizeSourceUrl(u);
    } catch {
      return u;
    }
  }

  /** Quét một nguồn: đọc danh sách (tối đa PAGES_PER_RUN trang) rồi nhập một lô từ hàng đợi. */
  async runSource(id: string, deadline = Date.now() + RUN_BUDGET_MS, force = false): Promise<{ id: string; found: number; added: number; queued: number; error?: string }> {
    const src = await this.get(id);
    const ad = adapterById(src.site);
    let found = 0;
    let added = 0;
    let error: string | undefined;
    const queue = new Set<string>(src.queue ?? []);
    try {
      // Bắt đầu vòng đọc mới khi đã xong vòng trước và quá ~20 giờ.
      if (src.cursorPage === 0 && (force || !src.discoveredAt || Date.now() - src.discoveredAt.getTime() >= REDISCOVER_MS)) {
        src.cursorPage = 1;
        src.discoveredAt = new Date();
      }
      let pages = 0;
      let nextLinks = new Map<number, string>();
      while (src.cursorPage > 0 && pages < PAGES_PER_RUN && Date.now() < deadline) {
        const page = src.cursorPage;
        const pageUrl = nextLinks.get(page) ?? ad.pageUrl(src.url, page);
        const { html, finalUrl } = await fetchHtml(pageUrl);
        const p = ad.parseList(html, finalUrl);
        pages++;
        for (const [n, l] of p.pageLinks) nextLinks.set(n, l);
        if (p.total) src.siteTotal = p.total;
        const urls = Array.from(new Set(p.jobs.map((u) => this.norm(u))));
        const known = await this.known(urls);
        const fresh = urls.filter((u) => !known.has(u) && !queue.has(u));
        found += urls.length;
        for (const u of fresh) if (queue.size < MAX_QUEUE) queue.add(u);
        src.totalFound += fresh.length;
        const noJobs = urls.length === 0;
        const allOld = fresh.length === 0 && src.cyclesDone > 0; // vòng sau: gặp trang toàn tin cũ → dừng sớm (danh sách xếp mới nhất trước)
        const lastKnown = p.lastPage ? page >= p.lastPage && !nextLinks.has(page + 1) : false;
        if (noJobs || allOld || lastKnown || page >= src.maxPages) {
          src.cursorPage = 0;
          src.cyclesDone += 1;
        } else {
          src.cursorPage = page + 1;
        }
        src.queue = Array.from(queue);
        await this.repo.save(src); // lưu tiến độ ngay sau MỖI trang: dừng/khởi động lại vẫn làm tiếp đúng chỗ
        if (src.cursorPage > 0 && PAGE_DELAY_MS) await sleep(PAGE_DELAY_MS);
      }

      // Nhập một lô từ hàng đợi.
      let done = 0;
      const batch = Array.from(queue).slice(0, BATCH);
      for (const u of batch) {
        if (Date.now() >= deadline) break;
        queue.delete(u);
        try {
          const r = await this.imports.addOne(u, {
            quiet: true,
            note: `Nguồn theo dõi: ${src.label}`,
            meta: { sourceId: src.id, ...(src.autoPublish ? {} : { noAuto: true }) },
          });
          if (r.result === 'new') added++;
          if (r.result === 'failed' && /tạm nghỉ|giới hạn/.test(r.message ?? '')) {
            // Trang nguồn đang nghỉ / hết lượt hôm nay: giữ lại tin này, dừng lô, làm tiếp ở lượt sau.
            queue.add(u);
            error = r.message;
            break;
          }
        } catch {
          /* bỏ qua tin lỗi, vòng đọc sau sẽ thấy lại nếu còn */
        }
        // Lưu hàng đợi sau mỗi 3 tin: đã nhập đến đâu nhớ đến đó.
        if (++done % 3 === 0) {
          src.queue = Array.from(queue);
          await this.repo.save(src);
        }
      }
      src.lastError = error ? error.slice(0, 500) : null;
    } catch (e) {
      error = (e as Error).message;
      src.lastError = error.slice(0, 500);
    }
    src.queue = Array.from(queue);
    src.lastAdded = added;
    src.totalAdded += added;
    src.lastScanAt = new Date();
    await this.repo.save(src);
    return { id: src.id, found, added, queued: src.queue.length, error };
  }

  /**
   * Đợt 150 — quét THỦ CÔNG từng trang: đọc đúng 1 trang (manualPage), nhập ngay các tin mới của trang đó,
   * rồi nhớ trang kế. Admin bấm "Quét trang tiếp" để đi tiếp; `reset` đưa về trang 1.
   */
  async stepSource(id: string, opts: { reset?: boolean; page?: number } = {}) {
    if (this.running) throw new BadRequestException('Đang quét, vui lòng chờ xong rồi bấm tiếp.');
    const src = await this.get(id);
    if (opts.reset) {
      src.manualPage = 1;
      await this.repo.save(src);
      return { page: 1, found: 0, added: 0, hasNext: true, reset: true };
    }
    const ad = adapterById(src.site);
    const page = Math.max(1, Math.floor(opts.page || src.manualPage || 1));
    this.running = true;
    this.runningId = id;
    try {
      let pageUrl = ad.pageUrl(src.url, page);
      if (page > 1) {
        // Ưu tiên link trang mà chính trang nguồn đưa ra (mẫu đường dẫn mỗi trang một khác).
        try {
          const first = await fetchHtml(src.url);
          const l = ad.parseList(first.html, first.finalUrl).pageLinks.get(page);
          if (l) pageUrl = l;
        } catch {
          /* dùng mẫu mặc định */
        }
      }
      const { html, finalUrl } = await this.fetchOrFail(pageUrl);
      const p = ad.parseList(html, finalUrl);
      if (p.total) src.siteTotal = p.total;
      const urls = Array.from(new Set(p.jobs.map((u) => this.norm(u))));
      const known = await this.known(urls);
      const fresh = urls.filter((u) => !known.has(u));
      let added = 0;
      // Lấy ÍT mỗi lần bấm (nhẹ cho trang nguồn): tối đa STEP_MAX_ITEMS tin; còn dư thì bấm tiếp vẫn ở trang này.
      const todo = fresh.slice(0, STEP_MAX_ITEMS);
      let stopMsg: string | undefined;
      for (const u of todo) {
        try {
          const r = await this.imports.addOne(u, {
            quiet: true,
            note: `Nguồn theo dõi: ${src.label} (trang ${page})`,
            meta: { sourceId: src.id, ...(src.autoPublish ? {} : { noAuto: true }) },
          });
          if (r.result === 'new') added++;
          if (r.result === 'failed' && /tạm nghỉ|giới hạn/.test(r.message ?? '')) {
            stopMsg = r.message;
            break;
          }
        } catch {
          /* bỏ qua tin lỗi */
        }
      }
      const remaining = Math.max(0, fresh.length - todo.length);
      const hasNext = urls.length > 0 && !(p.lastPage && page >= p.lastPage && !Array.from(p.pageLinks.keys()).some((n) => n > page));
      src.manualPage = remaining > 0 || stopMsg ? page : hasNext ? page + 1 : 1;
      src.totalFound += fresh.length;
      src.totalAdded += added;
      src.lastAdded = added;
      src.lastScanAt = new Date();
      src.lastError = null;
      await this.repo.save(src);
      return { page, found: urls.length, added, hasNext: hasNext || remaining > 0, already: urls.length - fresh.length, remaining, ...(stopMsg ? { note: stopMsg } : {}) };
    } finally {
      this.running = false;
      this.runningId = null;
    }
  }

  /** Nguồn nào cần chạy: đang đọc dở, còn hàng đợi, hoặc đã quá ~20 giờ kể từ vòng đọc trước. */
  private async dueIds(): Promise<string[]> {
    const rows = await this.repo.find({ where: { enabled: true }, order: { lastScanAt: 'ASC' } });
    return rows
      .filter((r) => r.cursorPage > 0 || (r.queue ?? []).length > 0 || !r.discoveredAt || Date.now() - r.discoveredAt.getTime() >= REDISCOVER_MS)
      .map((r) => r.id);
  }

  async runDue(): Promise<{ sources: number; added: number }> {
    if (this.running) return { sources: 0, added: 0 };
    this.running = true;
    const deadline = Date.now() + RUN_BUDGET_MS;
    let n = 0;
    let added = 0;
    try {
      for (const id of await this.dueIds()) {
        if (Date.now() >= deadline) break;
        this.runningId = id;
        const r = await this.runSource(id, deadline).catch((e) => ({ added: 0, error: String(e) }));
        added += r.added ?? 0;
        n++;
      }
    } finally {
      this.running = false;
      this.runningId = null;
    }
    return { sources: n, added };
  }

  /** Chạy nền (trả về ngay). `id` có giá trị thì chỉ quét nguồn đó, kể cả khi chưa tới hạn. */
  start(id?: string): { started: boolean; reason?: string } {
    if (this.running) return { started: false, reason: 'Đang quét, vui lòng chờ.' };
    if (id) {
      this.running = true;
      this.runningId = id;
      this.runSource(id, Date.now() + RUN_BUDGET_MS, true)
        .catch(() => undefined)
        .finally(() => {
          this.running = false;
          this.runningId = null;
        });
      return { started: true };
    }
    this.runDue().catch(() => undefined);
    return { started: true };
  }
}
