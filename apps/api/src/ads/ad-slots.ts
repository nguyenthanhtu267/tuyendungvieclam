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
  // Đợt 28 — thêm vùng để lấp khoảng trống (cột phải xếp chồng, giữa bài, cuối danh sách, chân trang mọi trang).
  'job-sidebar-2',
  'job-sidebar-3',
  'job-mid',
  'jobs-sidebar-2',
  'jobs-bottom',
  'company-sidebar',
  'home-bottom',
  'footer-top',
  // Đợt 52 — thêm vùng cho trang ứng viên / tiện ích / quản lý tin NTD (cuối trang, không chen giữa nội dung).
  'candidate-bottom',
  'tools-bottom',
  'employer-manage',
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
