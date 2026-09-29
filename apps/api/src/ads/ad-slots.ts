// Đợt 24 (29/09/2026) — danh sách "vùng" đặt banner. PHẢI khớp với apps/web/src/lib/ad-slots.ts (bên web có
// thêm mô tả/kích thước để hiển thị trong Admin).
export const AD_SLOTS = [
  'home-top',
  'home-mid',
  'jobs-inline',
  'jobs-sidebar',
  'job-sidebar',
  'job-bottom',
  'apply-success',
  'company-bottom',
  'candidate-top',
  'employer-top',
  'employer-search',
  'mobile-menu',
] as const;
export type AdSlot = (typeof AD_SLOTS)[number];

export const AD_AUDIENCES = ['guest', 'candidate', 'employer'] as const;

// Khớp với apps/web/src/lib/ad-theme.ts (THEMES).
export const AD_THEMES = [
  'brand',
  'ocean',
  'tech',
  'sunset',
  'flash',
  'emerald',
  'health',
  'luxury',
  'tet',
  'berry',
  'sky',
  'sand',
] as const;
