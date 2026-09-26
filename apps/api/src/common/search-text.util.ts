// Đợt 18a (26/09/2026) — chuẩn hoá chữ để tìm kiếm "gõ không dấu vẫn ra" trong Kho CV: bỏ dấu tiếng
// Việt (kể cả đ/Đ), chữ thường, gộp khoảng trắng. Dùng CHUNG cho cả lúc lưu (search_text) lẫn lúc
// tìm (từ khoá người dùng gõ) để 2 phía luôn khớp nhau.
export function normalizeSearchText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Bỏ thẻ HTML (nội dung rich text như mục tiêu nghề nghiệp/mô tả kinh nghiệm) trước khi đưa vào chữ
// tìm kiếm — chỉ cần chữ, không cần định dạng.
export function stripHtml(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function digitsOnly(input: string | null | undefined): string {
  return (input ?? '').replace(/[^0-9]/g, '');
}
