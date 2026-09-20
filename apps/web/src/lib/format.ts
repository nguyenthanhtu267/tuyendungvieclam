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

// Đợt 11b — Mục #4 ATS: 4 trạng thái tin NTD tự quản lý (tính từ approvalStatus + isPaused +
// deadline, xem computeEmployerStatus() ở employer.service.ts). 'khac' gộp draft/rejected — hiếm
// gặp trong luồng bình thường nhưng vẫn cần nhãn để không hiển thị rỗng.
export const EMPLOYER_JOB_STATUS_LABEL: Record<string, string> = {
  dang_dang: 'Đang đăng',
  cho_dang: 'Chờ đăng',
  tam_ngung: 'Tạm ngưng',
  het_han: 'Hết hạn',
  khac: 'Khác',
};

export const EMPLOYER_JOB_STATUS_CLASS: Record<string, string> = {
  dang_dang: 'bg-success-tint text-success',
  cho_dang: 'bg-warning-tint text-warning',
  tam_ngung: 'bg-ink-faint/10 text-ink-faint',
  het_han: 'bg-critical-tint text-critical',
  khac: 'bg-ink-faint/10 text-ink-faint',
};
