import sanitizeHtml from 'sanitize-html';

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
