// Đợt 109 — nhớ ở máy: 20 tin vừa xem (đọc lại được khi mất mạng) và kết quả danh sách lần trước (hiện ngay, cập nhật sau).
const JOBS_KEY = 'tvl_cache_jobs';
const LIST_KEY = 'tvl_cache_lists';
const MAX_JOBS = 20;
const MAX_LISTS = 6;
const PIN_KEY = 'tvl_pinned_jobs';
const MAX_PINS = 30;

type Stamped<T> = { t: number; v: T };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* đầy bộ nhớ / chế độ riêng tư — bỏ qua */
  }
}

export function cacheJob<T extends { id: string }>(job: T, related: unknown[] = []) {
  const all = read<Record<string, Stamped<{ job: T; related: unknown[] }>>>(JOBS_KEY, {});
  all[job.id] = { t: Date.now(), v: { job, related: related.slice(0, 6) } };
  const pins = readPins();
  // Tin đã ghim "xem offline" không bị đẩy ra khi lưu tin mới.
  const ids = Object.keys(all).filter((id) => !pins.includes(id)).sort((a, b) => all[b].t - all[a].t);
  ids.slice(MAX_JOBS).forEach((id) => delete all[id]);
  write(JOBS_KEY, all);
}
export function readCachedJob<T>(id: string): { at: number; job: T; related: unknown[] } | null {
  const hit = read<Record<string, Stamped<{ job: T; related: unknown[] }>>>(JOBS_KEY, {})[id];
  return hit ? { at: hit.t, job: hit.v.job, related: hit.v.related } : null;
}

export function cacheList<T>(key: string, data: T) {
  const all = read<Record<string, Stamped<T>>>(LIST_KEY, {});
  all[key] = { t: Date.now(), v: data };
  const keys = Object.keys(all).sort((a, b) => all[b].t - all[a].t);
  keys.slice(MAX_LISTS).forEach((k) => delete all[k]);
  write(LIST_KEY, all);
}
export function readCachedList<T>(key: string): { at: number; data: T } | null {
  const hit = read<Record<string, Stamped<T>>>(LIST_KEY, {})[key];
  return hit ? { at: hit.t, data: hit.v } : null;
}

export function agoText(at: number): string {
  const m = Math.max(1, Math.round((Date.now() - at) / 60000));
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} giờ trước` : `${Math.round(h / 24)} ngày trước`;
}

export function readPins(): string[] {
  const v = read<string[]>(PIN_KEY, []);
  return Array.isArray(v) ? v : [];
}
export function isPinned(id: string): boolean {
  return readPins().includes(id);
}
// Trả về trạng thái sau khi bấm. Cần tin đã nằm trong bộ nhớ (cacheJob) — trang chi tiết luôn lưu trước khi hiện.
export function togglePin(id: string): boolean {
  const pins = readPins();
  const next = pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id].slice(-MAX_PINS);
  write(PIN_KEY, next);
  return next.includes(id);
}
// Tất cả tin đang có trong máy (đã ghim lên trước, rồi mới nhất trước).
export function listCachedJobs<T>(): { id: string; at: number; pinned: boolean; job: T }[] {
  const all = read<Record<string, Stamped<{ job: T }>>>(JOBS_KEY, {});
  const pins = readPins();
  return Object.keys(all)
    .map((id) => ({ id, at: all[id].t, pinned: pins.includes(id), job: all[id].v.job }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at - a.at);
}
