// Đợt 29/30b (30/09/2026) — 44 mẫu nền vector "sáng tạo · đổi mới · công nghệ AI" (11 nhóm × 4 bảng màu) + ảnh Admin tải lên.
// PHẢI khớp danh sách mã ở apps/api/src/admin/bg-themes.ts (API kiểm tra mã hợp lệ khi lưu).
export type SceneId = 'neural' | 'circuit' | 'data' | 'iso' | 'aurora' | 'hex' | 'topo' | 'tri' | 'wave' | 'bubble' | 'grid';

export interface Palette {
  name: string;
  a: string; // nền tối (gradient)
  b: string;
  c: string;
  line: string; // nét sáng trên nền tối
  glow: string; // điểm nhấn phát sáng
  tint: string; // nền sáng cho toàn trang
}

export interface BgImage {
  id: string;
  name: string;
  overlay: number; // 0–90 (%) độ phủ sáng
  width: number;
  height: number;
  url: string; // đường dẫn tương đối của API
}

export interface BgTheme extends Palette {
  id: string;
  group: SceneId;
  groupLabel: string;
  seed: number;
  image?: BgImage; // có = nền là ảnh tải lên (màu vector dùng bảng màu mặc định cho khung số liệu)
}

export const BG_GROUPS: { id: SceneId; label: string; hint: string }[] = [
  { id: 'neural', label: 'Mạng nơ-ron AI', hint: 'Các nút thông minh nối với nhau' },
  { id: 'circuit', label: 'Mạch điện & chip', hint: 'Bo mạch, vi xử lý, dòng dữ liệu' },
  { id: 'data', label: 'Dữ liệu & biểu đồ', hint: 'Cột, đường tăng trưởng, vòng dữ liệu' },
  { id: 'iso', label: 'Thành phố số', hint: 'Khối isometric như toà nhà công nghệ' },
  { id: 'aurora', label: 'Sóng ánh sáng', hint: 'Cực quang, sóng mềm, hạt sáng' },
  { id: 'hex', label: 'Tổ ong lục giác', hint: 'Ô lục giác như mạng blockchain' },
  { id: 'topo', label: 'Đường đồng mức', hint: 'Vân địa hình, quỹ đạo dữ liệu' },
  { id: 'tri', label: 'Tam giác low-poly', hint: 'Mảng tam giác hình học hiện đại' },
  { id: 'wave', label: 'Sóng đường nét', hint: 'Các đường cong uốn lượn nhẹ nhàng' },
  { id: 'bubble', label: 'Bong bóng dữ liệu', hint: 'Vòng tròn lớn nhỏ, chấm bán sắc' },
  { id: 'grid', label: 'Lưới phối cảnh', hint: 'Mặt đường lưới kiểu tương lai, mặt trời số' },
];

// Kho bảng màu dùng cho nhóm mới và mẫu thứ 4 của nhóm cũ.
const B: Record<string, Palette> = {
  ruby: { name: 'Đỏ ruby', a: '#2E0A14', b: '#7A1330', c: '#C42A55', line: '#FFB3C6', glow: '#FFD166', tint: '#FBEAEE' },
  teal: { name: 'Ngọc lam', a: '#042B33', b: '#0A5563', c: '#0F8FA3', line: '#9BEFFA', glow: '#B6FF7A', tint: '#E4F4F7' },
  graphite: { name: 'Than chì', a: '#111418', b: '#2A313B', c: '#4A5666', line: '#B9C4D2', glow: '#4DE3F0', tint: '#EEF0F3' },
  gold: { name: 'Vàng kim', a: '#2E2306', b: '#7A5A0C', c: '#C9A227', line: '#FFE9A0', glow: '#FFFFFF', tint: '#FBF5E1' },
  indigo: { name: 'Chàm điện', a: '#0D0B3B', b: '#26208A', c: '#4A46D9', line: '#B5B3FF', glow: '#5CF2C8', tint: '#ECECFB' },
  coral: { name: 'San hô', a: '#3A0F16', b: '#8C2A2E', c: '#E8604C', line: '#FFC9BD', glow: '#FFF0A3', tint: '#FCEEEA' },
  lime: { name: 'Lục chanh', a: '#0F2A0A', b: '#26601A', c: '#5DB02C', line: '#D2F7A5', glow: '#FFF27A', tint: '#EDF6E4' },
  blue: { name: 'Xanh dương', a: '#0C2453', b: '#163B7A', c: '#1F5FBF', line: '#8DBBFF', glow: '#5CE1E6', tint: '#E9F0FB' },
  violet: { name: 'Tím trí tuệ', a: '#1B1246', b: '#3A2A8C', c: '#6A47D6', line: '#C4B5FF', glow: '#FF7AD9', tint: '#EFEBFB' },
  emerald: { name: 'Lục ngọc', a: '#06342E', b: '#0B5B4D', c: '#12896F', line: '#8FEBCB', glow: '#C6F56D', tint: '#E6F4EF' },
  ocean: { name: 'Xanh biển sâu', a: '#06183A', b: '#0F3C8A', c: '#1B78D0', line: '#A7D4FF', glow: '#63E6FF', tint: '#E7F0FB' },
  pink: { name: 'Hồng tím', a: '#2A0F4A', b: '#5B2A9E', c: '#A04BE0', line: '#E2C4FF', glow: '#FF8AD8', tint: '#F3ECFB' },
  neon: { name: 'Đêm neon', a: '#0B1020', b: '#1A1147', c: '#3A1F8F', line: '#9C8CFF', glow: '#FF5AC8', tint: '#ECEAF7' },
  sunset: { name: 'Hoàng hôn số', a: '#2B0F2E', b: '#6A1F5C', c: '#C2416B', line: '#FFB3CF', glow: '#FFC857', tint: '#FAEAF0' },
  tech: { name: 'Xanh công nghệ', a: '#0A1F44', b: '#12408F', c: '#1E6BD6', line: '#7FB2FF', glow: '#4DE3F0', tint: '#E8EFFA' },
};
const pick = (...k: string[]) => k.map((x) => B[x]);

const P: Record<SceneId, Palette[]> = {
  neural: [
    { name: 'Xanh dương', a: '#0C2453', b: '#163B7A', c: '#1F5FBF', line: '#8DBBFF', glow: '#5CE1E6', tint: '#E9F0FB' },
    { name: 'Tím trí tuệ', a: '#1B1246', b: '#3A2A8C', c: '#6A47D6', line: '#C4B5FF', glow: '#FF7AD9', tint: '#EFEBFB' },
    { name: 'Lục ngọc', a: '#06342E', b: '#0B5B4D', c: '#12896F', line: '#8FEBCB', glow: '#C6F56D', tint: '#E6F4EF' },
    B.ruby,
  ],
  circuit: [
    { name: 'Xanh công nghệ', a: '#0A1F44', b: '#12408F', c: '#1E6BD6', line: '#7FB2FF', glow: '#4DE3F0', tint: '#E8EFFA' },
    { name: 'Cam điện', a: '#2A1206', b: '#7A2E0E', c: '#D2571C', line: '#FFC39A', glow: '#FFE066', tint: '#FBEFE6' },
    { name: 'Đêm neon', a: '#0B1020', b: '#1A1147', c: '#3A1F8F', line: '#9C8CFF', glow: '#FF5AC8', tint: '#ECEAF7' },
    B.teal,
  ],
  data: [
    { name: 'Navy phân tích', a: '#0B1B3F', b: '#173B7C', c: '#2A63C4', line: '#9CC2FF', glow: '#FFB547', tint: '#EAF0FA' },
    { name: 'Lục tăng trưởng', a: '#07301F', b: '#0D5A3B', c: '#17916A', line: '#95F0C8', glow: '#FFE066', tint: '#E7F5EE' },
    { name: 'Hoàng hôn số', a: '#2B0F2E', b: '#6A1F5C', c: '#C2416B', line: '#FFB3CF', glow: '#FFC857', tint: '#FAEAF0' },
    B.gold,
  ],
  iso: [
    { name: 'Sáng xanh', a: '#0E2A5C', b: '#1D4FA8', c: '#3D87F0', line: '#BBD8FF', glow: '#6FF0FF', tint: '#EAF2FE' },
    { name: 'Hồng tím', a: '#2A0F4A', b: '#5B2A9E', c: '#A04BE0', line: '#E2C4FF', glow: '#FF8AD8', tint: '#F3ECFB' },
    { name: 'Vàng cam', a: '#3A1A05', b: '#8A430E', c: '#E08A1E', line: '#FFE0A8', glow: '#FFF07A', tint: '#FBF2E4' },
    B.teal,
  ],
  aurora: [
    { name: 'Cực quang lục', a: '#04212B', b: '#0A4A55', c: '#12897E', line: '#9CF5DC', glow: '#7DFFB2', tint: '#E4F4F1' },
    { name: 'Xanh biển sâu', a: '#06183A', b: '#0F3C8A', c: '#1B78D0', line: '#A7D4FF', glow: '#63E6FF', tint: '#E7F0FB' },
    { name: 'Tím hồng', a: '#1D0D3D', b: '#4B1F94', c: '#C0429E', line: '#F0BEFF', glow: '#FFD36B', tint: '#F5EAF8' },
    B.indigo,
  ],
  hex: pick('teal', 'indigo', 'ruby', 'graphite'),
  topo: pick('lime', 'blue', 'gold', 'violet'),
  tri: pick('coral', 'ocean', 'emerald', 'pink'),
  wave: pick('indigo', 'coral', 'teal', 'blue'),
  bubble: pick('sunset', 'lime', 'blue', 'graphite'),
  grid: pick('neon', 'tech', 'coral', 'teal'),
};

export const BG_THEMES: BgTheme[] = BG_GROUPS.flatMap((g, gi) =>
  P[g.id].map((p, i) => ({ ...p, id: `${g.id}-${i + 1}`, group: g.id, groupLabel: g.label, seed: 101 + gi * 17 + i * 7 })),
);
export const BG_THEME_MAP: Record<string, BgTheme> = Object.fromEntries(BG_THEMES.map((t) => [t.id, t]));
export const DEFAULT_BG_THEME = 'neural-1';

export interface BgSetting {
  mode: 'fixed' | 'auto' | 'none'; // none = không dùng nền (nền trơn)
  theme: string;
  autoThemes: string[]; // [] = xoay vòng toàn bộ mẫu vector (ảnh tải lên chỉ vào vòng xoay khi được tích chọn)
  hours: number;
  images: BgImage[];
}
export const DEFAULT_BG_SETTING: BgSetting = { mode: 'auto', theme: DEFAULT_BG_THEME, autoThemes: [], hours: 2, images: [] };

export const IMG_PREFIX = 'img-';

/** Tra 1 mã mẫu: mẫu vector, hoặc ảnh tải lên ("img-<uuid>") → BgTheme mang `image`. */
export function resolveBgTheme(id: string, images: BgImage[]): BgTheme | null {
  if (id.startsWith(IMG_PREFIX)) {
    const im = images.find((x) => IMG_PREFIX + x.id === id);
    return im ? { ...BG_THEMES[0], id, groupLabel: 'Ảnh của bạn', name: im.name, image: im } : null;
  }
  return BG_THEME_MAP[id] ?? null;
}

/** Mẫu đang hiển thị tại thời điểm `now`: cố định = mẫu đã chọn; tự động = xoay vòng theo mốc `hours` giờ (cùng một mẫu cho mọi người xem). */
export function currentBgTheme(s: BgSetting, now = Date.now()): BgTheme {
  const imgs = s.images ?? [];
  if (s.mode !== 'auto') return resolveBgTheme(s.theme, imgs) ?? BG_THEMES[0];
  const ids = (s.autoThemes.length ? s.autoThemes : BG_THEMES.map((t) => t.id)).filter((id) => resolveBgTheme(id, imgs));
  const list = ids.length ? ids : BG_THEMES.map((t) => t.id);
  const slot = Math.floor(now / (Math.max(1, s.hours) * 3600 * 1000));
  return resolveBgTheme(list[slot % list.length], imgs) ?? BG_THEMES[0];
}

/** Thời điểm (ms) mẫu tự động đổi tiếp theo. */
export function nextBgChange(s: BgSetting, now = Date.now()): number {
  const step = Math.max(1, s.hours) * 3600 * 1000;
  return (Math.floor(now / step) + 1) * step;
}
