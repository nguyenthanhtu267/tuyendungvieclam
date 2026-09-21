import DOMPurify from 'isomorphic-dompurify';

// Đợt 12n (21/09/2026) — Mô tả công việc / Yêu cầu ứng viên (NTD) và các ô mô tả dài trong hồ sơ
// CV (ứng viên) chuyển từ textarea thường sang trình soạn thảo có định dạng (RichTextEditor.tsx),
// lưu nội dung dạng HTML thay vì text thuần. Các hàm dưới đây dùng chung ở cả 2 chiều nhập/hiển thị:
//  - Dữ liệu CŨ (trước đợt 12n) vẫn là text thuần (có thể có \n) → nhận diện bằng isHtmlContent().
//  - Dữ liệu MỚI là HTML do RichTextEditor sinh ra → luôn khử độc (sanitize) trước khi render bằng
//    dangerouslySetInnerHTML để chống XSS (nội dung do NTD/ứng viên nhập, hiển thị cho người khác xem).

const HTML_TAG_RE = /<\/?[a-z][\s\S]*>/i;

export function isHtmlContent(value?: string | null): boolean {
  return !!value && HTML_TAG_RE.test(value);
}

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
];

export function sanitizeRichHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  });
}

// Rỗng thật sự? Tiptap trả về "<p></p>" cho ô trống — coi như không có nội dung.
export function isRichTextEmpty(value?: string | null): boolean {
  if (!value) return true;
  const stripped = value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return stripped.length === 0;
}
