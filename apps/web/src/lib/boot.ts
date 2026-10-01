import type { BgSetting } from './bg-themes';
import type { AdFeed } from './ads';
import { apiBaseFor } from './api';

// Đợt 93 — MỘT lần gọi lúc mở trang cho 3 thứ mọi trang đều cần: cài đặt nền, banner/khuyến mãi, nhãn logo.
// (Trước đây 3 lần gọi riêng → 3 vòng chờ máy chủ.) layout.tsx đã <link rel="preload"> sẵn địa chỉ này nên khi
// code chạy thì phản hồi thường đã về. Lỗi/API bản cũ chưa có /public/boot → trả null và từng nơi tự gọi đường cũ.
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface BootData {
  background: BgSetting | null;
  promos: AdFeed | null;
  badge: { text: string; url: string } | null;
}

let inflight: Promise<BootData | null> | null = null;
let done: { at: number; v: BootData | null } | null = null;
const TTL = 5 * 60_000;

export function loadBoot(): Promise<BootData | null> {
  if (done && Date.now() - done.at < TTL) return Promise.resolve(done.v);
  if (!inflight) {
    inflight = fetch(`${apiBaseFor('/public/boot')}/public/boot`)
      .then((r) => (r.ok ? (r.json() as Promise<BootData>) : null))
      .catch(() => null)
      .then((v) => {
        done = { at: Date.now(), v };
        return v;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

// ---- nhớ cài đặt nền ở máy người xem: lần mở sau vẽ ĐÚNG nền ngay, không nháy nền mặc định rồi mới chuyển.
const BG_KEY = 'tvl_bg_cache';
export function readCachedBg(): BgSetting | null {
  try {
    const raw = localStorage.getItem(BG_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as BgSetting;
    return s && typeof s.mode === 'string' && Array.isArray(s.images) ? s : null;
  } catch {
    return null;
  }
}
export function writeCachedBg(s: BgSetting) {
  try {
    localStorage.setItem(BG_KEY, JSON.stringify(s));
  } catch {
    /* đầy bộ nhớ / chế độ riêng tư — bỏ qua */
  }
}
