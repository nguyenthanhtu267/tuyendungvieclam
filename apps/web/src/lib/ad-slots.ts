// Đợt 24 (29/09/2026) — các "vùng" đặt banner quảng cáo. Mã vùng PHẢI khớp apps/api/src/ads/ad-slots.ts.
// variant: wide = dải ngang co dãn theo bề rộng · tall = khung dọc cột phải · compact = dải nhỏ gọn.
// devices: nơi vùng xuất hiện (vùng cột phải chỉ có trên máy tính vì điện thoại không có cột phải).
export type AdVariant = 'wide' | 'tall' | 'compact';

export interface AdSlotDef {
  id: string;
  page: string;
  label: string;
  variant: AdVariant;
  devices: 'all' | 'desktop' | 'mobile';
  audience: string;
  // Vùng chỉ 1 nhóm người thấy (trang riêng của ứng viên / NTD) — dùng để cảnh báo cấu hình "không bao giờ hiện".
  onlyFor?: 'candidate' | 'employer';
  size: string;
}

export const AD_SLOT_DEFS: AdSlotDef[] = [
  { id: 'home-top', page: 'Trang chủ', label: 'Dưới khối tìm kiếm, trên "Việc làm mới nhất"', variant: 'wide', devices: 'all', audience: 'Mọi người', size: 'Ngang toàn khung · cao ~100–130px' },
  { id: 'home-mid', page: 'Trang chủ', label: 'Giữa trang, trước "Doanh nghiệp yêu thích"', variant: 'wide', devices: 'desktop', audience: 'Mọi người', size: 'Ngang toàn khung · cao ~100px' },
  { id: 'jobs-inline', page: 'Tìm việc làm', label: 'Xen giữa danh sách (sau tin thứ 5)', variant: 'wide', devices: 'all', audience: 'Mọi người', size: 'Ngang như 1 thẻ việc làm' },
  { id: 'jobs-sidebar', page: 'Tìm việc làm', label: 'Cột phải, dưới các khối gợi ý', variant: 'tall', devices: 'desktop', audience: 'Mọi người', size: 'Dọc 280 × ~280px' },
  { id: 'job-sidebar', page: 'Chi tiết tin', label: 'Cột phải, dưới thông tin công ty', variant: 'tall', devices: 'desktop', audience: 'Mọi người', size: 'Dọc 280 × ~280px' },
  { id: 'job-bottom', page: 'Chi tiết tin', label: 'Cuối nội dung, trước "Công việc tương tự"', variant: 'wide', devices: 'all', audience: 'Mọi người', size: 'Ngang toàn khung' },
  { id: 'apply-success', page: 'Chi tiết tin', label: 'Ngay sau khi nộp đơn thành công', variant: 'compact', devices: 'all', audience: 'Ứng viên / khách', size: 'Dải nhỏ gọn' },
  { id: 'company-bottom', page: 'Trang công ty', label: 'Cuối trang', variant: 'wide', devices: 'all', audience: 'Mọi người', size: 'Ngang toàn khung' },
  { id: 'candidate-top', page: 'Hồ sơ ứng viên', label: 'Đầu trang My Center', variant: 'wide', devices: 'all', audience: 'Ứng viên', onlyFor: 'candidate', size: 'Ngang toàn khung' },
  { id: 'employer-top', page: 'NTD · Tổng quan', label: 'Dưới lời chào, trên số liệu', variant: 'wide', devices: 'all', audience: 'Nhà tuyển dụng', onlyFor: 'employer', size: 'Ngang toàn khung' },
  { id: 'employer-search', page: 'NTD · Tìm hồ sơ', label: 'Đầu trang tìm hồ sơ', variant: 'wide', devices: 'all', audience: 'Nhà tuyển dụng', onlyFor: 'employer', size: 'Ngang toàn khung' },
  { id: 'mobile-menu', page: 'Menu điện thoại', label: 'Cuối menu ☰ trên điện thoại', variant: 'compact', devices: 'mobile', audience: 'Mọi người', size: 'Dải nhỏ gọn' },
];

export const AD_SLOT_MAP: Record<string, AdSlotDef> = Object.fromEntries(AD_SLOT_DEFS.map((s) => [s.id, s]));
