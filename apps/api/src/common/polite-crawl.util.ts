// Đợt 157 — "cào lịch sự": mọi lần hệ thống tự tải trang của website khác đều đi qua đây.
//  • Tôn trọng robots.txt của trang nguồn (đường dẫn họ cấm thì KHÔNG tải; theo Crawl-delay nếu có).
//  • Giãn cách giữa các lần tải trên cùng một trang (vài giây, có dao động) và giới hạn số lượt/ngày cho mỗi trang.
//  • Bị từ chối (403/429/503) → dừng ngay, nghỉ vài giờ, KHÔNG thử lại, KHÔNG đổi cách để lách.
//  • Khai báo đúng tên bộ thu thập (User-Agent) kèm địa chỉ liên hệ để chủ trang nguồn biết và liên hệ khi cần.
// Tiến độ (trang đang đọc, hàng đợi, link đã nhập) được lưu ở job-source.service nên dừng/khởi động lại vẫn làm tiếp đúng chỗ.
import type { DataSource } from 'typeorm';

export const BOT_UA = process.env.SCRAPER_UA || 'VieclamNgayBot/1.0 (+https://www.vieclamngay.vn; hotro@vieclamngay.vn)';
const BASE_GAP_MS = Number(process.env.SCRAPER_GAP_MS || 4000);
const DAILY_CAP = Number(process.env.SCRAPER_DAILY_CAP || 250);
const COOLDOWN_MS = 6 * 3600_000;
const ROBOTS_TTL_MS = 6 * 3600_000;

export class PoliteBlockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PoliteBlockError';
  }
}

type Rule = { allow: boolean; pat: RegExp; len: number };
type Robots = { rules: Rule[]; delayMs: number; until: number; denyAll: boolean };

const robotsCache = new Map<string, Robots>();
const lastAt = new Map<string, number>();
const lanes = new Map<string, Promise<void>>();
let store: DataSource | null = null;
const mem = new Map<string, { blockedUntil: number; day: string; count: number }>();

export async function setPoliteStore(ds: DataSource) {
  store = ds;
  await ds
    .query(`CREATE TABLE IF NOT EXISTS scrape_hosts (host varchar(120) PRIMARY KEY, blocked_until timestamptz, day varchar(10), count int NOT NULL DEFAULT 0)`)
    .catch(() => undefined);
}

const today = () => new Date().toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function state(host: string) {
  let s = mem.get(host);
  if (!s) {
    s = { blockedUntil: 0, day: today(), count: 0 };
    if (store) {
      try {
        const r: { blocked_until: Date | null; day: string | null; count: number }[] = await store.query(`SELECT blocked_until, day, count FROM scrape_hosts WHERE host=$1`, [host]);
        if (r[0]) s = { blockedUntil: r[0].blocked_until ? new Date(r[0].blocked_until).getTime() : 0, day: r[0].day || today(), count: r[0].count || 0 };
      } catch {
        /* dùng bộ nhớ tạm */
      }
    }
    mem.set(host, s);
  }
  if (s.day !== today()) {
    s.day = today();
    s.count = 0;
  }
  return s;
}

async function persist(host: string) {
  const s = mem.get(host);
  if (!s || !store) return;
  await store
    .query(
      `INSERT INTO scrape_hosts (host, blocked_until, day, count) VALUES ($1, $2, $3, $4)
       ON CONFLICT (host) DO UPDATE SET blocked_until=$2, day=$3, count=$4`,
      [host, s.blockedUntil ? new Date(s.blockedUntil) : null, s.day, s.count],
    )
    .catch(() => undefined);
}

function toRegex(p: string): RegExp {
  const esc = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${esc.endsWith('\\$') ? esc.slice(0, -2) + '$' : esc}`);
}

function parseRobots(txt: string): { rules: Rule[]; delayMs: number } {
  const groups: { agents: string[]; rules: Rule[]; delay: number }[] = [];
  let cur: { agents: string[]; rules: Rule[]; delay: number } | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const i = line.indexOf(':');
    if (i < 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line.slice(i + 1).trim();
    if (k === 'user-agent') {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [], delay: 0 };
        groups.push(cur);
      }
      cur.agents.push(v.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (k === 'disallow' || k === 'allow') {
      if (!v && k === 'disallow') continue;
      if (!v) continue;
      cur.rules.push({ allow: k === 'allow', pat: toRegex(v), len: v.length });
    } else if (k === 'crawl-delay') {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) cur.delay = Math.min(n, 60);
    }
  }
  const mine = groups.find((g) => g.agents.some((a) => a !== '*' && 'vieclamngaybot'.includes(a))) ?? groups.find((g) => g.agents.includes('*'));
  return { rules: mine?.rules ?? [], delayMs: (mine?.delay ?? 0) * 1000 };
}

async function robotsFor(origin: string): Promise<Robots> {
  const c = robotsCache.get(origin);
  if (c && c.until > Date.now()) return c;
  let r: Robots;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(`${origin}/robots.txt`, { signal: ctl.signal, headers: { 'User-Agent': BOT_UA, Accept: 'text/plain' } }).finally(() => clearTimeout(t));
    if (res.status >= 500) r = { rules: [], delayMs: 0, until: Date.now() + 30 * 60_000, denyAll: true };
    else if (!res.ok) r = { rules: [], delayMs: 0, until: Date.now() + ROBOTS_TTL_MS, denyAll: false };
    else {
      const p = parseRobots((await res.text()).slice(0, 500_000));
      r = { ...p, until: Date.now() + ROBOTS_TTL_MS, denyAll: false };
    }
  } catch {
    r = { rules: [], delayMs: 0, until: Date.now() + 30 * 60_000, denyAll: true };
  }
  robotsCache.set(origin, r);
  return r;
}

function allowed(r: Robots, path: string): boolean {
  if (r.denyAll) return false;
  let best: Rule | null = null;
  for (const x of r.rules) if (x.pat.test(path) && (!best || x.len > best.len || (x.len === best.len && x.allow))) best = x;
  return best ? best.allow : true;
}

/**
 * Cổng trước MỖI lần tải trang của website khác. Ném PoliteBlockError (thông điệp tiếng Việt) nếu không được phép;
 * nếu được thì chờ đủ khoảng giãn cách rồi cho đi tiếp. `minMs` = khoảng giãn cách tối thiểu (mặc định vài giây).
 */
export async function politeGate(raw: string | URL, opts: { minMs?: number } = {}): Promise<void> {
  const u = typeof raw === 'string' ? new URL(raw) : raw;
  const host = u.host.toLowerCase();
  const s = await state(host);
  if (s.blockedUntil > Date.now()) {
    const h = Math.ceil((s.blockedUntil - Date.now()) / 3600_000);
    throw new PoliteBlockError(`Trang ${host} đã từ chối truy cập tự động — hệ thống tạm nghỉ ~${h} giờ rồi mới thử lại.`);
  }
  if (s.count >= DAILY_CAP) throw new PoliteBlockError(`Hôm nay đã đạt giới hạn ${DAILY_CAP} lượt tải từ ${host} (để không làm nặng trang nguồn) — sẽ tiếp tục ngày mai.`);
  const rb = await robotsFor(u.origin);
  if (!allowed(rb, u.pathname + u.search)) throw new PoliteBlockError(`Trang ${host} không cho phép bộ thu thập tự động đọc đường dẫn này (robots.txt) — đã bỏ qua.`);
  // Xếp hàng theo từng trang nguồn để các lần tải nối nhau, không dồn cùng lúc.
  const prev = lanes.get(host) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((res) => (release = res));
  lanes.set(host, prev.then(() => mine));
  await prev;
  try {
    const gap = Math.max(rb.delayMs, opts.minMs ?? BASE_GAP_MS);
    const wait = (lastAt.get(host) ?? 0) + gap + Math.random() * gap * 0.5 - Date.now();
    if (wait > 0) await sleep(wait);
    lastAt.set(host, Date.now());
    s.count += 1;
    await persist(host);
  } finally {
    release();
  }
}

/** Báo kết quả để biết khi nào phải dừng: 403/429/503 → nghỉ vài giờ. */
export async function politeReport(raw: string | URL, status: number): Promise<void> {
  if (![403, 429, 503].includes(status)) return;
  const host = (typeof raw === 'string' ? new URL(raw) : raw).host.toLowerCase();
  const s = await state(host);
  s.blockedUntil = Date.now() + COOLDOWN_MS;
  await persist(host);
}
