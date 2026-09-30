// Đợt 24 (29/09/2026) — banner quảng cáo phía trình duyệt: tải "nguồn banner" 1 lần (giữ 5 phút), chọn banner
// cho từng vùng (lọc theo vùng/đối tượng/thiết bị, xoay vòng theo trọng số, KHÔNG lặp 1 banner 2 lần trên cùng
// trang), gắn UTM cho link ngoài, ghi lượt hiển thị (≥50% banner lọt vào màn hình) và lượt bấm.

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export const ADS_API_BASE = API;

export interface PublicAd {
  id: string;
  slug: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  ctaText: string | null;
  url: string;
  addUtm: boolean;
  bgMode: 'generated' | 'image';
  bgPrompt: string;
  bgTheme: string | null;
  bgSeed: number;
  bgImageUrl: string | null;
  bgImageTone: 'light' | 'dark' | null;
  textColor: 'auto' | 'light' | 'dark';
  slots: string[];
  audiences: string[];
  device: 'all' | 'desktop' | 'mobile';
  weight: number;
}

export interface AdFeed {
  enabled: boolean;
  disabledSlots: string[];
  campaigns: PublicAd[];
}

const FEED_TTL = 5 * 60_000;
let cache: { at: number; value: AdFeed | null } | null = null;
let inflight: Promise<AdFeed | null> | null = null;

export function peekAdFeed(): AdFeed | null | undefined {
  return cache && Date.now() - cache.at < FEED_TTL ? cache.value : undefined;
}

export function loadAdFeed(): Promise<AdFeed | null> {
  const hit = peekAdFeed();
  if (hit !== undefined) return Promise.resolve(hit);
  if (!inflight) {
    inflight = fetch(`${API}/public/promos`)
      .then((r) => (r.ok ? (r.json() as Promise<AdFeed>) : null))
      .catch(() => null)
      .then((v) => {
        cache = { at: Date.now(), value: v };
        return v;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export type AdAudience = 'guest' | 'candidate' | 'employer' | 'admin';

export function audienceOf(role: string | null | undefined): AdAudience {
  if (!role) return 'guest';
  if (role === 'candidate') return 'candidate';
  if (role.startsWith('employer')) return 'employer';
  return 'admin';
}

// ------------------------------------------------------------------ ẩn (người xem bấm ×) — nhớ trong phiên
const CLOSED_KEY = 'tvl_ad_closed';
export function closedAds(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(CLOSED_KEY) || '[]') as string[]);
  } catch {
    return new Set();
  }
}
export function closeAd(id: string) {
  try {
    const s = closedAds();
    s.add(id);
    sessionStorage.setItem(CLOSED_KEY, JSON.stringify(Array.from(s).slice(-50)));
  } catch {
    /* trình duyệt chặn lưu trữ — chỉ ẩn trong lần xem này */
  }
}

// ------------------------------------------------------------------ chọn banner
export function eligibleAds(feed: AdFeed | null, slot: string, audience: AdAudience, isDesktop: boolean): PublicAd[] {
  if (!feed || !feed.enabled || feed.disabledSlots.includes(slot)) return [];
  const closed = closedAds();
  return feed.campaigns.filter(
    (c) =>
      (c.slots.includes('*') || c.slots.includes(slot)) &&
      (audience === 'admin' || c.audiences.length === 0 || c.audiences.includes(audience)) &&
      (c.device === 'all' || (c.device === 'desktop') === isDesktop) &&
      !closed.has(c.id),
  );
}

// Vùng đang hiện gì trên trang hiện tại (để 2 vùng cùng trang không hiện trùng 1 banner).
// Đợt 35 — "trùng" tính theo NỘI DUNG (tiêu đề + link), không chỉ theo mã chiến dịch: 2 chiến dịch khác ảnh nhưng cùng chữ
// (VD banner mẫu + bản sao) cũng không được hiện cùng lúc trên 1 trang.
export const adKey = (c: Pick<PublicAd, 'title' | 'url'>) => `${(c.title || '').trim().toLowerCase().replace(/\s+/g, ' ')}|${(c.url || '').trim().toLowerCase()}`;
const onPage = new Map<string, { id: string; key: string }>();
export function registerSlot(slot: string, ad: Pick<PublicAd, 'id' | 'title' | 'url'>) {
  onPage.set(slot, { id: ad.id, key: adKey(ad) });
}
export function unregisterSlot(slot: string) {
  onPage.delete(slot);
}

export function pickAd(list: PublicAd[], slot: string): PublicAd | null {
  const others = Array.from(onPage.entries()).filter(([s]) => s !== slot).map(([, v]) => v);
  const takenIds = new Set(others.map((v) => v.id));
  const takenKeys = new Set(others.map((v) => v.key));
  const pool = list.filter((c) => !takenIds.has(c.id) && !takenKeys.has(adKey(c)));
  if (!pool.length) return null;
  const total = pool.reduce((t, c) => t + Math.max(1, c.weight), 0);
  let x = Math.random() * total;
  for (const c of pool) {
    x -= Math.max(1, c.weight);
    if (x <= 0) return c;
  }
  return pool[pool.length - 1];
}

export function isExternal(url: string) {
  return /^https?:\/\//i.test(url);
}

export function adHref(c: Pick<PublicAd, 'url' | 'addUtm' | 'slug'>, slot: string): string {
  if (!isExternal(c.url) || !c.addUtm) return c.url;
  try {
    const u = new URL(c.url);
    const set = (k: string, v: string) => {
      if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    };
    set('utm_source', 'tuyendungvieclam');
    set('utm_medium', 'banner');
    set('utm_campaign', c.slug || 'banner');
    set('utm_content', slot);
    return u.toString();
  } catch {
    return c.url;
  }
}

// ------------------------------------------------------------------ ghi lượt hiển thị / bấm
const queue: { c: string; s: string; t: 'v' | 'c' }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const body = JSON.stringify({ e: queue.splice(0, 50) });
  const url = `${API}/public/promos/events`;
  try {
    const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
    if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
  } catch {
    /* thử fetch bên dưới */
  }
  fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }).catch(() => {});
}

let hooked = false;
export function trackAd(id: string, slot: string, t: 'v' | 'c') {
  queue.push({ c: id, s: slot, t });
  if (!hooked && typeof document !== 'undefined') {
    hooked = true;
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  }
  if (t === 'c') flush();
  else if (!timer) timer = setTimeout(flush, 3000);
}
