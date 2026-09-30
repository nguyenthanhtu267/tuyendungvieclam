// Đợt 29 (30/09/2026) — 15 mẫu nền vector "sáng tạo · đổi mới · công nghệ AI", chia 5 nhóm × 3 bảng màu.
// PHẢI khớp danh sách mã ở apps/api/src/admin/bg-themes.ts (API kiểm tra mã hợp lệ khi lưu).
export type SceneId = 'neural' | 'circuit' | 'data' | 'iso' | 'aurora';

export interface Palette {
  name: string;
  a: string; // nền tối (gradient)
  b: string;
  c: string;
  line: string; // nét sáng trên nền tối
  glow: string; // điểm nhấn phát sáng
  tint: string; // nền sáng cho toàn trang
}

export interface BgTheme extends Palette {
  id: string;
  group: SceneId;
  groupLabel: string;
  seed: number;
}

export const BG_GROUPS: { id: SceneId; label: string; hint: string }[] = [
  { id: 'neural', label: 'Mạng nơ-ron AI', hint: 'Các nút thông minh nối với nhau' },
  { id: 'circuit', label: 'Mạch điện & chip', hint: 'Bo mạch, vi xử lý, dòng dữ liệu' },
  { id: 'data', label: 'Dữ liệu & biểu đồ', hint: 'Cột, đường tăng trưởng, vòng dữ liệu' },
  { id: 'iso', label: 'Thành phố số', hint: 'Khối isometric như toà nhà công nghệ' },
  { id: 'aurora', label: 'Sóng ánh sáng', hint: 'Cực quang, sóng mềm, hạt sáng' },
];

const P: Record<SceneId, Palette[]> = {
  neural: [
    { name: 'Xanh dương', a: '#0C2453', b: '#163B7A', c: '#1F5FBF', line: '#8DBBFF', glow: '#5CE1E6', tint: '#E9F0FB' },
    { name: 'Tím trí tuệ', a: '#1B1246', b: '#3A2A8C', c: '#6A47D6', line: '#C4B5FF', glow: '#FF7AD9', tint: '#EFEBFB' },
    { name: 'Lục ngọc', a: '#06342E', b: '#0B5B4D', c: '#12896F', line: '#8FEBCB', glow: '#C6F56D', tint: '#E6F4EF' },
  ],
  circuit: [
    { name: 'Xanh công nghệ', a: '#0A1F44', b: '#12408F', c: '#1E6BD6', line: '#7FB2FF', glow: '#4DE3F0', tint: '#E8EFFA' },
    { name: 'Cam điện', a: '#2A1206', b: '#7A2E0E', c: '#D2571C', line: '#FFC39A', glow: '#FFE066', tint: '#FBEFE6' },
    { name: 'Đêm neon', a: '#0B1020', b: '#1A1147', c: '#3A1F8F', line: '#9C8CFF', glow: '#FF5AC8', tint: '#ECEAF7' },
  ],
  data: [
    { name: 'Navy phân tích', a: '#0B1B3F', b: '#173B7C', c: '#2A63C4', line: '#9CC2FF', glow: '#FFB547', tint: '#EAF0FA' },
    { name: 'Lục tăng trưởng', a: '#07301F', b: '#0D5A3B', c: '#17916A', line: '#95F0C8', glow: '#FFE066', tint: '#E7F5EE' },
    { name: 'Hoàng hôn số', a: '#2B0F2E', b: '#6A1F5C', c: '#C2416B', line: '#FFB3CF', glow: '#FFC857', tint: '#FAEAF0' },
  ],
  iso: [
    { name: 'Sáng xanh', a: '#0E2A5C', b: '#1D4FA8', c: '#3D87F0', line: '#BBD8FF', glow: '#6FF0FF', tint: '#EAF2FE' },
    { name: 'Hồng tím', a: '#2A0F4A', b: '#5B2A9E', c: '#A04BE0', line: '#E2C4FF', glow: '#FF8AD8', tint: '#F3ECFB' },
    { name: 'Vàng cam', a: '#3A1A05', b: '#8A430E', c: '#E08A1E', line: '#FFE0A8', glow: '#FFF07A', tint: '#FBF2E4' },
  ],
  aurora: [
    { name: 'Cực quang lục', a: '#04212B', b: '#0A4A55', c: '#12897E', line: '#9CF5DC', glow: '#7DFFB2', tint: '#E4F4F1' },
    { name: 'Xanh biển sâu', a: '#06183A', b: '#0F3C8A', c: '#1B78D0', line: '#A7D4FF', glow: '#63E6FF', tint: '#E7F0FB' },
    { name: 'Tím hồng', a: '#1D0D3D', b: '#4B1F94', c: '#C0429E', line: '#F0BEFF', glow: '#FFD36B', tint: '#F5EAF8' },
  ],
};

export const BG_THEMES: BgTheme[] = BG_GROUPS.flatMap((g, gi) =>
  P[g.id].map((p, i) => ({ ...p, id: `${g.id}-${i + 1}`, group: g.id, groupLabel: g.label, seed: 101 + gi * 17 + i * 7 })),
);
export const BG_THEME_MAP: Record<string, BgTheme> = Object.fromEntries(BG_THEMES.map((t) => [t.id, t]));
export const DEFAULT_BG_THEME = 'neural-1';

export interface BgSetting {
  mode: 'fixed' | 'auto';
  theme: string;
  autoThemes: string[]; // [] = dùng cả 15 mẫu
  hours: number;
}
export const DEFAULT_BG_SETTING: BgSetting = { mode: 'auto', theme: DEFAULT_BG_THEME, autoThemes: [], hours: 2 };

/** Mẫu đang hiển thị tại thời điểm `now`: cố định = mẫu đã chọn; tự động = xoay vòng theo mốc `hours` giờ (cùng một mẫu cho mọi người xem). */
export function currentBgTheme(s: BgSetting, now = Date.now()): BgTheme {
  if (s.mode === 'fixed') return BG_THEME_MAP[s.theme] ?? BG_THEMES[0];
  const ids = (s.autoThemes.length ? s.autoThemes : BG_THEMES.map((t) => t.id)).filter((id) => BG_THEME_MAP[id]);
  const list = ids.length ? ids : BG_THEMES.map((t) => t.id);
  const slot = Math.floor(now / (Math.max(1, s.hours) * 3600 * 1000));
  return BG_THEME_MAP[list[slot % list.length]];
}

/** Thời điểm (ms) mẫu tự động đổi tiếp theo. */
export function nextBgChange(s: BgSetting, now = Date.now()): number {
  const step = Math.max(1, s.hours) * 3600 * 1000;
  return (Math.floor(now / step) + 1) * step;
}
