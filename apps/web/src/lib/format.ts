export function formatSalary(min?: number, max?: number): string {
  if (!min && !max) return 'Thoả thuận';
  if (min && max) return `${min}–${max} triệu`;
  if (min) return `Từ ${min} triệu`;
  if (max) return `Đến ${max} triệu`;
  return 'Thoả thuận';
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
