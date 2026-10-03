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

// Đợt 155 — tự viết bộ khử độc KHÔNG cần DOM/jsdom: thư viện isomorphic-dompurify kéo jsdom → gói ESM (@exodus/bytes) bị lỗi
// ERR_REQUIRE_ESM trên Node của Vercel khiến máy chủ không dựng được nội dung mô tả tin. Cách làm: chỉ phát ra các thẻ nằm trong
// danh sách cho phép, KHÔNG BAO GIỜ giữ thuộc tính; mọi chữ còn lại được thoát ký tự → không thể chèn mã.
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
const esc = (t: string) => t.replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function sanitizeRichHtml(html: string): string {
  const src = String(html ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, '');
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(src))) {
    out += esc(src.slice(last, m.index).replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;'));
    const name = m[2].toLowerCase();
    if (ALLOWED_TAGS.includes(name)) out += name === 'br' ? '<br>' : `<${m[1]}${name}>`;
    last = m.index + m[0].length;
  }
  out += esc(src.slice(last).replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;'));
  return out;
}

// Rỗng thật sự? Tiptap trả về "<p></p>" cho ô trống — coi như không có nội dung.
export function isRichTextEmpty(value?: string | null): boolean {
  if (!value) return true;
  const stripped = value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return stripped.length === 0;
}

// Đợt 14 (25/09/2026) — mục 15 danh sách lỗi: "Quyền lợi được hưởng" đổi từ mảng chip sang rich
// text tự do (xem job-posting.entity.ts). Ở những nơi có không gian hẹp (JobCard, khung "Xem
// trước"), vẫn muốn tách được từng ý thành chip ngắn kèm icon như giao diện cũ — hàm này lấy tối đa
// `max` "mục" từ nội dung rich text: ưu tiên tách theo khối <li>/<p> nếu có (nội dung MỚI, nhập qua
// RichTextEditor); nếu không có cấu trúc HTML nào (dữ liệu CŨ trước Đợt 14, lưu dạng
// "A,B,C" do cột từng là simple-array) thì tách theo dấu phẩy/chấm phẩy/xuống dòng để tương thích
// ngược, không hiện nguyên 1 chuỗi dính liền dấu phẩy.
// Đợt 14 (25/09/2026) — hiển thị đầy đủ (không giới hạn số mục) qua <RichTextView listFallback>: dữ
// liệu MỚI (HTML) truyền thẳng; dữ liệu CŨ (trước Đợt 14, dạng "A,B,C" nối bằng dấu phẩy do cột
// từng là simple-array) không có ký tự xuống dòng nên RichTextView's fallback tách theo '\n' sẽ ra
// nguyên 1 dòng dính liền — đổi dấu phẩy thành xuống dòng trước khi truyền vào để mỗi mục vẫn hiện
// thành 1 dòng riêng như giao diện chip cũ.
export function benefitsRichTextValue(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (isHtmlContent(value)) return value;
  return value.split(',').map((s) => s.trim()).filter(Boolean).join('\n');
}

export function richTextListItems(value?: string | null, max = 3): string[] {
  if (!value) return [];
  const blocks = value.match(/<(li|p)[^>]*>([\s\S]*?)<\/\1>/gi);
  let items: string[];
  if (blocks && blocks.length > 0) {
    items = blocks.map((b) => b.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim());
  } else {
    items = value
      .replace(/<[^>]*>/g, ' ')
      .split(/[,;\n]+/)
      .map((s) => s.trim());
  }
  return items.filter(Boolean).slice(0, max);
}
