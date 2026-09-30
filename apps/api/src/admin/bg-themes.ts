// Đợt 30b — mã mẫu nền giao diện: 11 nhóm × 4 bảng màu = 44 mẫu. PHẢI khớp apps/web/src/lib/bg-themes.ts.
export const BG_GROUP_IDS = [
  'neural',
  'circuit',
  'data',
  'iso',
  'aurora',
  'hex',
  'topo',
  'tri',
  'wave',
  'bubble',
  'grid',
] as const;
export const BG_PALETTES_PER_GROUP = 4;
export const BG_THEME_IDS: string[] = BG_GROUP_IDS.flatMap((g) =>
  Array.from({ length: BG_PALETTES_PER_GROUP }, (_, i) => `${g}-${i + 1}`),
);
export const BG_IMAGE_THEME_PREFIX = 'img-';
