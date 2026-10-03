// Đợt 147 — bộ đọc TRANG DANH SÁCH tin tuyển dụng (công ty / ngành nghề / từ khoá) theo từng trang web.
// Mỗi trang là một "adapter" khai báo: nhận ra link, đổi thành trang danh sách, tạo link sang trang N, rút link tin + tổng số tin.
// Thêm trang mới = thêm một adapter vào ADAPTERS; phần còn lại (hàng đợi, kiểm tra trùng, quét mỗi ngày) dùng chung.
// Chỉ dùng `fetch` + regex (không thêm thư viện), chỉ tải địa chỉ Internet công khai, tự theo chuyển hướng tối đa 4 lần.

import { assertPublicHttpUrl } from './public-url.util';
import { normalizeSearchText } from './search-text.util';
import { BOT_UA, PoliteBlockError, politeGate, politeReport } from './polite-crawl.util';

export type SourceKind = 'company' | 'category' | 'keyword' | 'list';

export interface ParsedList {
  jobs: string[];
  total?: number;
  /** Số trang lớn nhất thấy trong phân trang (nếu có). */
  lastPage?: number;
  /** Link các trang kế tiếp đọc được trực tiếp từ HTML (ưu tiên hơn đoán theo mẫu). */
  pageLinks: Map<number, string>;
  employers: { name: string; url: string }[];
  title?: string;
}

export interface Detected {
  site: string;
  kind: SourceKind;
  listingUrl: string;
  label?: string;
}

export interface SiteAdapter {
  id: string;
  name: string;
  match(host: string): boolean;
  detect(url: URL): Detected;
  pageUrl(listingUrl: string, page: number): string;
  parseList(html: string, baseUrl: string): ParsedList;
  /** Link tìm theo từ khoá (để Admin tìm công ty theo tên). */
  searchUrl?(q: string): string;
}

const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;

export function slugify(s: string): string {
  return normalizeSearchText(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function abs(href: string, base: string): string | null {
  try {
    const u = new URL(decodeEntities(href.trim()), base);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

function pageTitle(html: string): string | undefined {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const raw = stripTags((h1?.[1] ?? '') || (t?.[1] ?? ''));
  if (!raw) return undefined;
  return raw.replace(/\s*[|\-–—]\s*(careerviet|vietnamworks|topcv|itviec).*$/i, '').slice(0, 180);
}

function parseTotal(text: string): number | undefined {
  // "217 việc làm", "1,007 vị trí", "Tìm thấy 1.007 việc làm"
  const m = text.match(/(\d{1,3}(?:[.,]\d{3})+|\d{1,6})\s*(?:việc làm|vị trí|tin tuyển dụng|jobs?)/i);
  if (!m) return undefined;
  const n = Number(m[1].replace(/[.,]/g, ''));
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? n : undefined;
}

// ===================== careerviet.vn =====================
// Trang công ty:  /vi/nha-tuyen-dung/<slug>.<MÃ>.html  → danh sách đầy đủ ở /viec-lam/<slug>-p<MÃ>-vi.html
// Ngành nghề:     /viec-lam/<slug>-c<số>-vi.html     Từ khoá: /viec-lam/<slug>-k-vi.html
// Chi tiết tin:   /vi/tim-viec-lam/<slug>.<MÃ>.html     Trang N: …-trang-N-vi.html
const careerviet: SiteAdapter = {
  id: 'careerviet',
  name: 'CareerViet',
  match: (h) => /(^|\.)careerviet\.vn$/i.test(h),
  detect(u) {
    const path = u.pathname;
    const origin = `${u.protocol}//${u.host}`;
    const comp = path.match(/^\/vi\/nha-tuyen-dung\/([^/]+?)\.([0-9A-Za-z]{4,12})\.html$/);
    if (comp) return { site: 'careerviet', kind: 'company', listingUrl: `${origin}/viec-lam/${comp[1]}-p${comp[2]}-vi.html`, label: comp[1].replace(/-/g, ' ') };
    const list = path.match(/^\/viec-lam\/([^/]+?)-(p[0-9A-Za-z]{4,12}|c\d+|k)(?:-trang-\d+)?-vi\.html$/);
    if (list) {
      const t = list[2];
      const kind: SourceKind = t.startsWith('p') ? 'company' : t === 'k' ? 'keyword' : 'category';
      return { site: 'careerviet', kind, listingUrl: `${origin}${path.replace(/-trang-\d+(?=-vi\.html$)/, '')}`, label: list[1].replace(/-/g, ' ') };
    }
    return { site: 'careerviet', kind: 'list', listingUrl: u.toString() };
  },
  pageUrl(listingUrl, page) {
    if (page <= 1) return listingUrl;
    return listingUrl.replace(/-vi\.html(\?.*)?$/, `-trang-${page}-vi.html$1`);
  },
  parseList(html, baseUrl) {
    const jobs = new Set<string>();
    for (const m of html.matchAll(/href\s*=\s*["']([^"']*\/vi\/tim-viec-lam\/[^"']+?\.html[^"']*)["']/gi)) {
      const a = abs(m[1], baseUrl);
      if (a) jobs.add(a.split('?')[0]);
    }
    const pageLinks = new Map<number, string>();
    let lastPage = 0;
    for (const m of html.matchAll(/href\s*=\s*["']([^"']*-trang-(\d+)-vi\.html[^"']*)["']/gi)) {
      const n = Number(m[2]);
      const a = abs(m[1], baseUrl);
      if (a && n > 1) {
        pageLinks.set(n, a);
        lastPage = Math.max(lastPage, n);
      }
    }
    const employers = new Map<string, string>();
    for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']*\/vi\/nha-tuyen-dung\/[^"']+?\.html)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const a = abs(m[1], baseUrl);
      const name = stripTags(m[2]) || (m[0].match(/title\s*=\s*["']([^"']+)["']/i)?.[1] ?? '');
      if (a && name && !employers.has(a)) employers.set(a, decodeEntities(name).slice(0, 160));
    }
    return {
      jobs: Array.from(jobs),
      total: parseTotal(stripTags(html.slice(0, 200_000))),
      lastPage: lastPage || undefined,
      pageLinks,
      employers: Array.from(employers, ([url, name]) => ({ name, url })),
      title: pageTitle(html),
    };
  },
  searchUrl: (q) => `https://careerviet.vn/viec-lam/${slugify(q)}-k-vi.html`,
};

// ===================== Trang bất kỳ (dự phòng) =====================
// Gom các link trông như trang chi tiết tin (có số/mã định danh ở cuối đường dẫn), phân trang theo ?page= hoặc rel=next.
const JOB_PATH = /(viec-lam|tuyen-dung|vieclam|\/jobs?\/|\/job-|\/careers?\/|\/position|\/vacanc|\/recruit|\/jd\/|\/v\/|\/it-jobs\/|\/tim-viec)/i;
const JOB_TAIL = /(\d{4,}|[0-9a-f]{8,})(?:\.html?|\/)?$/i;
const NOT_JOB = /(\/page\/|[?&]page=|\/category|\/nganh|\/tag|\/search|\/login|\/dang-nhap|\/dang-ky|\.(png|jpe?g|gif|svg|css|js)$)/i;

const generic: SiteAdapter = {
  id: 'generic',
  name: 'Trang khác (tự nhận)',
  match: () => true,
  detect(u) {
    return { site: 'generic', kind: 'list', listingUrl: u.toString() };
  },
  pageUrl(listingUrl, page) {
    if (page <= 1) return listingUrl;
    const u = new URL(listingUrl);
    u.searchParams.set('page', String(page));
    return u.toString();
  },
  parseList(html, baseUrl) {
    const jobs = new Set<string>();
    const host = new URL(baseUrl).hostname;
    for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
      const a = abs(m[1], baseUrl);
      if (!a) continue;
      const u = new URL(a);
      if (u.hostname !== host || NOT_JOB.test(a)) continue;
      if (JOB_PATH.test(u.pathname) && JOB_TAIL.test(u.pathname)) jobs.add(a.split('?')[0]);
    }
    const pageLinks = new Map<number, string>();
    let lastPage = 0;
    for (const m of html.matchAll(/href\s*=\s*["']([^"']*[?&]page=(\d+)[^"']*)["']/gi)) {
      const n = Number(m[2]);
      const a = abs(m[1], baseUrl);
      if (a && n > 1) {
        pageLinks.set(n, a);
        lastPage = Math.max(lastPage, n);
      }
    }
    return { jobs: Array.from(jobs), total: parseTotal(stripTags(html.slice(0, 200_000))), lastPage: lastPage || undefined, pageLinks, employers: [], title: pageTitle(html) };
  },
};

// ===================== Các trang tuyển dụng phổ biến (Đợt 157) =====================
// Mẫu link tin: joboko (/viec-lam-<tên>-xvi<số>), careerlink (/tim-viec-lam/<tên>/<số>), vietnamworks (…-<số>-jv) đã đối chiếu với
// trang thật; topcv, jobsgo, vieclam24h theo mẫu thường gặp — nếu một trang đổi cấu trúc thì "Đọc thử" sẽ báo không thấy tin,
// khi đó dùng được adapter "Trang khác (tự nhận)". Một số trang (TopCV, VietnamWorks…) có thể từ chối truy cập tự động: hệ thống
// sẽ dừng và báo rõ lý do, không cố lách.
function siteAdapter(o: { id: string; name: string; host: RegExp; detail: RegExp; pageParam?: string }): SiteAdapter {
  const param = o.pageParam ?? 'page';
  const clean = (u: string) => u.split('#')[0].split('?')[0];
  return {
    id: o.id,
    name: o.name,
    match: (h) => o.host.test(h),
    detect(u) {
      const listing = new URL(u.toString());
      listing.searchParams.delete(param);
      const comp = u.pathname.match(/^\/(?:cong-ty|nha-tuyen-dung|company|employer)\/([^/]+)/i);
      return { site: o.id, kind: comp ? 'company' : 'list', listingUrl: listing.toString(), label: comp ? comp[1].replace(/\.html?$/i, '').replace(/-/g, ' ') : undefined };
    },
    pageUrl(listingUrl, page) {
      if (page <= 1) return listingUrl;
      const x = new URL(listingUrl);
      x.searchParams.set(param, String(page));
      return x.toString();
    },
    parseList(html, baseUrl) {
      const host = new URL(baseUrl).hostname.replace(/^www\./, '');
      const jobs = new Set<string>();
      for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
        const a = abs(m[1], baseUrl);
        if (!a) continue;
        let u: URL;
        try {
          u = new URL(a);
        } catch {
          continue;
        }
        if (!u.hostname.replace(/^www\./, '').endsWith(host.split('.').slice(-2).join('.'))) continue;
        if (o.detail.test(u.pathname)) jobs.add(clean(a));
      }
      const pageLinks = new Map<number, string>();
      let lastPage = 0;
      const re = new RegExp(`href\\s*=\\s*["']([^"']*[?&]${param}=(\\d+)[^"']*)["']`, 'gi');
      for (const m of html.matchAll(re)) {
        const n = Number(m[2]);
        const a = abs(m[1], baseUrl);
        if (a && n > 1) {
          pageLinks.set(n, a);
          lastPage = Math.max(lastPage, n);
        }
      }
      return { jobs: Array.from(jobs), total: parseTotal(stripTags(html.slice(0, 200_000))), lastPage: lastPage || undefined, pageLinks, employers: [], title: pageTitle(html) };
    },
  };
}

const joboko = siteAdapter({ id: 'joboko', name: 'Joboko', host: /(^|\.)joboko\.com$/i, detail: /^\/viec-lam-[^/]+-xvi\d+$/i, pageParam: 'p' });
const careerlink = siteAdapter({ id: 'careerlink', name: 'CareerLink', host: /(^|\.)careerlink\.vn$/i, detail: /^\/tim-viec-lam\/[^/]+\/\d+$/i });
const topcv = siteAdapter({ id: 'topcv', name: 'TopCV', host: /(^|\.)topcv\.vn$/i, detail: /^\/viec-lam\/[^/]+\/\d+\.html$/i });
const jobsgo = siteAdapter({ id: 'jobsgo', name: 'JobsGO', host: /(^|\.)jobsgo\.vn$/i, detail: /^\/viec-lam\/[^/]+-\d+\.html$/i });
const vieclam24h = siteAdapter({ id: 'vieclam24h', name: 'Vieclam24h', host: /(^|\.)vieclam24h\.vn$/i, detail: /-id\d+\.html$/i });
const vietnamworks = siteAdapter({ id: 'vietnamworks', name: 'VietnamWorks', host: /(^|\.)vietnamworks\.com$/i, detail: /-\d+-jv$/i });

export const ADAPTERS: SiteAdapter[] = [careerviet, joboko, careerlink, topcv, jobsgo, vieclam24h, vietnamworks, generic];

export function adapterFor(host: string): SiteAdapter {
  return ADAPTERS.find((a) => a.id !== 'generic' && a.match(host)) ?? generic;
}
export function adapterById(id: string): SiteAdapter {
  return ADAPTERS.find((a) => a.id === id) ?? generic;
}

export function detectSource(raw: string): Detected & { adapter: SiteAdapter } {
  const u = new URL(raw.trim());
  const adapter = adapterFor(u.hostname);
  return { ...adapter.detect(u), adapter };
}

/** Tải một trang HTML công khai (chặn mạng nội bộ). Ném lỗi có thông điệp tiếng Việt. */
export async function fetchHtml(url: string, opts: { minMs?: number } = {}): Promise<{ html: string; finalUrl: string }> {
  let target: URL = await assertPublicHttpUrl(url);
  for (let hop = 0; hop < 5; hop++) {
    await politeGate(target, opts); // robots.txt + giãn cách + giới hạn ngày (Đợt 157)
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(target, { signal: ctl.signal, redirect: 'manual', headers: { 'User-Agent': BOT_UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'vi,en;q=0.8' } });
    } catch (e) {
      if (e instanceof PoliteBlockError) throw e;
      throw new Error('Không tải được trang (mạng chậm hoặc trang chặn truy cập tự động).');
    } finally {
      clearTimeout(timer);
    }
    const loc = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    if (loc) {
      target = await assertPublicHttpUrl(new URL(loc, target).toString());
      continue;
    }
    if (res.status === 403 || res.status === 429 || res.status === 503) {
      await politeReport(target, res.status);
      throw new Error(`Trang nguồn từ chối truy cập tự động (mã ${res.status}) — hệ thống dừng và nghỉ vài giờ, không cố truy cập lại.`);
    }
    if (!res.ok) throw new Error(`Không tải được trang (mã lỗi ${res.status}).`);
    const buf = await res.arrayBuffer();
    return { html: Buffer.from(buf.slice(0, MAX_HTML_BYTES)).toString('utf-8'), finalUrl: target.toString() };
  }
  throw new Error('Trang chuyển hướng quá nhiều lần.');
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
