// Đợt 12w (21/09/2026) — sửa lỗi nghiêm trọng "(0, sanitize_html_1.default) is not a function"
// (500 Internal Server Error) khi đăng tin/lưu hồ sơ có mô tả thật. Nguyên nhân: tsconfig.json của
// apps/api KHÔNG bật `esModuleInterop` (chỉ có `allowSyntheticDefaultImports`, vốn chỉ nới lỏng
// kiểm tra kiểu lúc biên dịch chứ không đổi code JS sinh ra) — `import sanitizeHtml from
// 'sanitize-html'` biên dịch thành truy cập `.default` trên module CommonJS gốc, mà gói
// `sanitize-html` export theo kiểu `export = sanitize` (không có `.default`) → luôn là undefined ở
// production, gọi vào sẽ crash. Dùng cú pháp `import ... = require(...)` để lấy đúng named export
// CommonJS, không phụ thuộc esModuleInterop — an toàn cho mọi cấu hình tsconfig.
import sanitizeHtml = require('sanitize-html');

// Đợt 12n (21/09/2026) — Mô tả công việc/Yêu cầu ứng viên (NTD) và các ô mô tả dài trong hồ sơ CV
// (ứng viên) chuyển sang trình soạn thảo HTML (RichTextEditor.tsx ở web). Khử độc (sanitize) ngay
// khi LƯU ở backend — phòng vệ ở lớp API, độc lập với việc frontend có khử độc khi hiển thị hay
// không (defense in depth: nội dung do người dùng nhập, hiển thị công khai cho người khác xem).
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

export function sanitizeRichText(value?: string | null): string | undefined {
  if (value == null) return value ?? undefined;
  return sanitizeHtml(value, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
  });
}
