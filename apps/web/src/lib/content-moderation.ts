// Đợt 12i (21/09/2026) — hỗ trợ Admin rà soát nội dung tin tuyển dụng trước khi duyệt: tự động
// phát hiện (1) link/URL chèn trong nội dung (thường dùng để né kênh liên hệ chính thức của hệ
// thống, dẫn ứng viên ra ngoài) và (2) từ khoá thường gặp ở tin tuyển dụng lừa đảo/đa cấp/thu phí.
// Đây CHỈ LÀ CẢNH BÁO cho Admin tự đọc và quyết định — không tự động chặn hay từ chối tin nào,
// theo đúng quyết định người dùng (21/09/2026): "Chỉ cảnh báo, Admin vẫn tự quyết định".

// Bắt các dạng URL phổ biến: có schema (http://, https://), bắt đầu bằng "www.", hoặc tên miền
// trần kèm đuôi phổ biến (vd zalo.me/xxx, bit.ly/xxx, xemthem.com) — đều là dấu hiệu link.
const URL_PATTERN =
  /\b((https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9-]+\.(com|net|vn|me|link|info|xyz|biz|io|ly)(\/[^\s]*)?)\b/gi;

// Danh sách từ khoá nhạy cảm thường gặp ở tin tuyển dụng có dấu hiệu lừa đảo/đa cấp/thu phí trái
// phép tại Việt Nam. Có thể chỉnh sửa/bổ sung thêm theo thực tế vận hành.
export const SENSITIVE_KEYWORDS: string[] = [
  'việc nhẹ lương cao',
  'không cần kinh nghiệm lương cao',
  'thu nhập khủng',
  'kiếm tiền nhanh',
  'làm giàu nhanh',
  'đa cấp',
  'kinh doanh đa cấp',
  'đóng phí',
  'nộp phí',
  'phí giữ chỗ',
  'phí đồng phục',
  'phí hồ sơ',
  'đặt cọc',
  'chuyển khoản trước',
  'thu tiền trước',
  'việc làm tại nhà thu nhập cao',
  'không cần bằng cấp lương cao',
  'tuyển gấp không phỏng vấn',
  'chỉ cần điện thoại kiếm tiền',
];

export interface ContentScanResult {
  hasLink: boolean;
  links: string[];
  sensitiveHits: string[];
}

// Quét gộp nhiều đoạn text (tiêu đề, mô tả, yêu cầu...) của 1 tin — không phân biệt hoa/thường,
// không phân biệt dấu (để bắt được biến thể gõ không dấu né lọc).
export function scanJobContent(...texts: Array<string | undefined>): ContentScanResult {
  const combined = texts.filter(Boolean).join('\n');
  const normalized = combined
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // bỏ dấu để so khớp từ khoá không dấu

  const linkMatches = Array.from(combined.matchAll(URL_PATTERN)).map((m) => m[0]);
  const uniqueLinks = Array.from(new Set(linkMatches)).slice(0, 5);

  const sensitiveHits = SENSITIVE_KEYWORDS.filter((kw) => {
    const kwNormalized = kw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    return normalized.includes(kwNormalized);
  });

  return {
    hasLink: uniqueLinks.length > 0,
    links: uniqueLinks,
    sensitiveHits,
  };
}
