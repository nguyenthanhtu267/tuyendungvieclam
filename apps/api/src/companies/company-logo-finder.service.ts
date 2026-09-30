import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Not, Repository } from 'typeorm';
import { Company } from '../database/entities/company.entity';
import { assertPublicHttpUrl } from '../common/public-url.util';

// Đợt 67 — Bộ dò logo tự động: với công ty CHƯA có logoUrl nhưng có website, đọc trang chủ, tìm ảnh đại
// diện (apple-touch-icon → icon lớn nhất → og:logo → /apple-touch-icon.png → og:image → /favicon.ico),
// kiểm tra link đó thật sự là ảnh đủ lớn rồi lưu vào autoLogoUrl (chỉ lưu đường link, không tải tệp).
// Chỉ dùng website công ty tự khai — KHÔNG đoán tên miền từ tên công ty (dễ gắn nhầm logo công ty khác).
const TIMEOUT_MS = 6000;
const MAX_HTML = 512 * 1024;
const RUN_EVERY_MS = 6 * 60 * 60 * 1000;
const BATCH = 40;
const RECHECK_DAYS = 14;
const UA = 'Mozilla/5.0 (compatible; TuyenDungLogoBot/1.0)';

interface Cand {
  url: string;
  weight: number;
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined;
}

export function parseLogoCandidates(html: string, base: URL): Cand[] {
  const out: Cand[] = [];
  const add = (href: string | undefined, weight: number) => {
    if (!href || href.startsWith('data:')) return;
    try {
      out.push({ url: new URL(href.trim(), base).toString(), weight });
    } catch {
      /* bỏ qua link hỏng */
    }
  };
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase();
    const href = attr(tag, 'href');
    const size = parseInt((attr(tag, 'sizes') ?? '').split('x')[0], 10) || 0;
    if (rel.includes('apple-touch-icon')) add(href, 900 + Math.min(size, 512));
    else if (rel.includes('icon')) add(href, 500 + Math.min(size, 512));
  }
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, 'property') ?? attr(tag, 'name') ?? '').toLowerCase();
    if (key === 'og:logo') add(attr(tag, 'content'), 1000);
    else if (key === 'og:image' || key === 'twitter:image') add(attr(tag, 'content'), 300);
  }
  add('/apple-touch-icon.png', 450);
  add('/favicon.ico', 100);
  return out.sort((a, b) => b.weight - a.weight).filter((c, i, arr) => arr.findIndex((x) => x.url === c.url) === i);
}

@Injectable()
export class CompanyLogoFinder implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(CompanyLogoFinder.name);
  private timer?: ReturnType<typeof setInterval>;
  private startTimer?: ReturnType<typeof setTimeout>;
  private running = false;

  constructor(@InjectRepository(Company) private readonly repo: Repository<Company>) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.startTimer = setTimeout(() => this.scan().catch(() => undefined), 90_000);
    this.timer = setInterval(() => this.scan().catch(() => undefined), RUN_EVERY_MS);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.startTimer) clearTimeout(this.startTimer);
  }

  private async get(url: string, asImage: boolean): Promise<Response | null> {
    let u = await assertPublicHttpUrl(url).catch(() => null);
    if (!u) return null;
    for (let hop = 0; hop < 4; hop++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(u, { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: asImage ? 'image/*' : 'text/html' } });
      } catch {
        return null;
      } finally {
        clearTimeout(t);
      }
      const loc = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (!loc) return res;
      u = await assertPublicHttpUrl(new URL(loc, u).toString()).catch(() => null);
      if (!u) return null;
    }
    return null;
  }

  // Link có thật là ảnh đủ lớn (≥ 1KB, hoặc SVG) — loại favicon 16px, trang lỗi trả HTML…
  private async isGoodImage(url: string): Promise<boolean> {
    const res = await this.get(url, true);
    if (!res || !res.ok) return false;
    const type = (res.headers.get('content-type') ?? '').toLowerCase();
    if (!type.startsWith('image/')) return false;
    const buf = Buffer.from((await res.arrayBuffer()).slice(0, 2 * 1024 * 1024));
    return type.includes('svg') ? buf.length > 200 : buf.length >= 1000;
  }

  async findForWebsite(website: string): Promise<string | null> {
    const raw = /^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${website.trim()}`;
    const page = await this.get(raw, false);
    let html = '';
    let base: URL;
    try {
      base = new URL(page?.url && page.url !== '' ? page.url : raw);
    } catch {
      return null;
    }
    if (page?.ok) html = Buffer.from((await page.arrayBuffer()).slice(0, MAX_HTML)).toString('utf-8');
    for (const c of parseLogoCandidates(html, base).slice(0, 6)) {
      if (await this.isGoodImage(c.url)) return c.url;
    }
    return null;
  }

  async scan(limit = BATCH): Promise<{ checked: number; found: number }> {
    if (this.running) return { checked: 0, found: 0 };
    this.running = true;
    let found = 0;
    try {
      const since = new Date(Date.now() - RECHECK_DAYS * 86400000);
      const list = await this.repo.find({
        where: [
          { logoUrl: IsNull(), website: Not(IsNull()), logoCheckedAt: IsNull() },
          { logoUrl: IsNull(), website: Not(IsNull()), logoCheckedAt: LessThan(since) },
          { logoUrl: '', website: Not(IsNull()), logoCheckedAt: IsNull() },
        ],
        take: limit,
      });
      for (const c of list) {
        let url: string | null = null;
        try {
          if (c.website?.trim()) url = await this.findForWebsite(c.website);
        } catch (e) {
          this.log.debug(`Dò logo lỗi ${c.name}: ${(e as Error).message}`);
        }
        c.autoLogoUrl = url ?? undefined;
        c.logoCheckedAt = new Date();
        await this.repo.save(c);
        if (url) found++;
      }
      if (list.length) this.log.log(`Dò logo: ${list.length} công ty, tìm được ${found}`);
      return { checked: list.length, found };
    } finally {
      this.running = false;
    }
  }
}
