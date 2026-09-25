export function formatSalary(min?: number, max?: number): string {
  if (!min && !max) return 'Thoả thuận';
  if (min && max) return `${min}–${max} triệu`;
  if (min) return `Từ ${min} triệu`;
  if (max) return `Đến ${max} triệu`;
  return 'Thoả thuận';
}

// Đợt 10 — dòng lương màu đỏ trên thẻ việc làm (mục 4 đặc tả): dạng khoảng "10 Tr – 13 Tr VND"
// hoặc chữ "Cạnh tranh" khi chưa khai mức lương.
export function formatSalaryTag(min?: number, max?: number): string {
  if (!min && !max) return 'Cạnh tranh';
  if (min && max) return `${min} Tr – ${max} Tr VND`;
  if (min) return `Từ ${min} Tr VND`;
  return `Đến ${max} Tr VND`;
}

// Đợt 12k (21/09/2026) — khối "Địa điểm làm việc" / "Thông tin khác" trên trang chi tiết tin
// (theo mẫu careerviet.vn). Tin cũ chưa có dữ liệu (address/gender/ageRange/workSchedule) vẫn hiện
// giá trị mặc định hợp lý thay vì để trống — theo lựa chọn của người dùng, không ghi đè vào CSDL.
export function jobAddressDisplay(address?: string, locationFallback?: string): string {
  if (address && address.trim()) return address.trim();
  return locationFallback && locationFallback.trim() ? locationFallback.trim() : 'Đang cập nhật';
}

export function jobGenderDisplay(gender?: string): string {
  return gender && gender.trim() ? gender.trim() : 'Không yêu cầu';
}

export function jobAgeRangeDisplay(ageRange?: string): string {
  return ageRange && ageRange.trim() ? ageRange.trim() : 'Không giới hạn tuổi';
}

export function jobWorkScheduleDisplay(workSchedule?: string): string {
  return workSchedule && workSchedule.trim() ? workSchedule.trim() : 'Thoả thuận';
}

export function isNewJob(createdAt?: string): boolean {
  if (!createdAt) return false;
  const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return days <= 7;
}

export function companyInitials(name: string): string {
  const words = name
    .replace(/^(Công ty|Tập đoàn|Chuỗi)\s+(TNHH|CP|Cổ phần)?\s*/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters = words.slice(-2).map((w) => w[0]?.toUpperCase() ?? '');
  return letters.join('') || name.slice(0, 2).toUpperCase();
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('vi-VN');
}

// Đợt 12q (21/09/2026) — Batch 5 mục #4: hiện cả giờ:phút cho nhật ký thao tác admin (formatDate()
// chỉ có ngày, không đủ phân biệt nhiều thao tác trong cùng 1 ngày).
export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}

export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  new: 'Mới ứng tuyển',
  reviewing: 'Đang xem xét',
  suitable: 'Phù hợp',
  interview: 'Mời phỏng vấn',
  rejected: 'Từ chối',
};

export const APPLICATION_STATUS_CLASS: Record<string, string> = {
  new: 'bg-info-tint text-info',
  reviewing: 'bg-warning-tint text-warning',
  suitable: 'bg-success-tint text-success',
  interview: 'bg-success-tint text-success',
  rejected: 'bg-critical-tint text-critical',
};

export function formatCurrency(amount: number | string): string {
  return `${Number(amount).toLocaleString('vi-VN')}đ`;
}

// Đợt 13 (24/09/2026) — Quy tắc chung: mọi số đếm/thống kê hiển thị ra giao diện phải có dấu chấm
// phân cách hàng nghìn (định dạng Việt Nam). Trước đó mỗi nơi tự gọi `.toLocaleString('vi-VN')`
// rời rạc (dễ quên, VD trang /viec-lam từng hiện "1106" thay vì "1.106") — nay dùng chung hàm này.
// Áp dụng cho MỌI số đếm mới thêm sau này, không đợi báo lỗi nữa.
export function formatNumber(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return n.toLocaleString('vi-VN');
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xác nhận thanh toán',
  active: 'Đã kích hoạt',
  expired: 'Hết hạn',
  cancelled: 'Đã huỷ',
};

export const ORDER_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-warning-tint text-warning',
  active: 'bg-success-tint text-success',
  expired: 'bg-ink-faint/10 text-ink-faint',
  cancelled: 'bg-critical-tint text-critical',
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  vnpay: 'VNPay',
  momo: 'MoMo',
  zalopay: 'ZaloPay',
  vietqr: 'Chuyển khoản VietQR',
  contract_vat: 'Hợp đồng + hoá đơn VAT',
};

// Đợt 11b — Mục #4 ATS: trạng thái tin NTD tự quản lý (tính từ approvalStatus + isPaused +
// deadline, xem computeEmployerStatus() ở employer.service.ts). 'khac' gộp draft — hiếm gặp trong
// luồng bình thường nhưng vẫn cần nhãn để không hiển thị rỗng.
// Đợt 12x (21/09/2026) — tách riêng 'bi_tu_choi' (trước đây gộp chung "khac" với draft, NTD không
// biết tin bị từ chối) — đi kèm tính năng "Bắt buộc nhập lý do khi Từ chối".
export const EMPLOYER_JOB_STATUS_LABEL: Record<string, string> = {
  dang_dang: 'Đang đăng',
  cho_dang: 'Chờ đăng',
  tam_ngung: 'Tạm ngưng',
  het_han: 'Hết hạn',
  bi_tu_choi: 'Bị từ chối',
  khac: 'Khác',
};

export const EMPLOYER_JOB_STATUS_CLASS: Record<string, string> = {
  dang_dang: 'bg-success-tint text-success',
  cho_dang: 'bg-warning-tint text-warning',
  tam_ngung: 'bg-ink-faint/10 text-ink-faint',
  het_han: 'bg-critical-tint text-critical',
  bi_tu_choi: 'bg-critical-tint text-critical',
  khac: 'bg-ink-faint/10 text-ink-faint',
};
