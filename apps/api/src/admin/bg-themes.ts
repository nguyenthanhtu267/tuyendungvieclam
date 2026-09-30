// Đợt 29 — mã 15 mẫu nền giao diện (5 nhóm × 3). PHẢI khớp apps/web/src/lib/bg-themes.ts.
export const BG_THEME_IDS = [
  'neural-1', 'neural-2', 'neural-3',
  'circuit-1', 'circuit-2', 'circuit-3',
  'data-1', 'data-2', 'data-3',
  'iso-1', 'iso-2', 'iso-3',
  'aurora-1', 'aurora-2', 'aurora-3',
] as const;
export type BgThemeId = (typeof BG_THEME_IDS)[number];
