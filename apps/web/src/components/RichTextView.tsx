import { isHtmlContent, sanitizeRichHtml } from '@/lib/richtext';

// Đợt 12n (21/09/2026) — hiển thị nội dung từ RichTextEditor. Tương thích ngược 2 chiều:
//  - Nội dung MỚI (có thẻ HTML) → khử độc rồi render bằng dangerouslySetInnerHTML.
//  - Nội dung CŨ (text thuần, trước đợt 12n) → giữ đúng cách hiển thị cũ: đoạn văn thường
//    (`whitespace-pre-line`) hoặc tách theo dòng thành <li> khi listFallback=true (áp dụng cho
//    "Yêu cầu ứng viên" — cách hiển thị cũ trước khi có định dạng danh sách thật).
export function RichTextView({
  value,
  className,
  listFallback,
}: {
  value?: string | null;
  className?: string;
  listFallback?: boolean;
}) {
  if (!value) return null;

  if (isHtmlContent(value)) {
    return (
      <div
        className={`tvl-richtext-view ${className ?? ''}`}
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(value) }}
      />
    );
  }

  if (listFallback) {
    const lines = value.split('\n').filter(Boolean);
    return (
      <ul className={`list-disc pl-5 ${className ?? ''}`}>
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    );
  }

  return <p className={`whitespace-pre-line ${className ?? ''}`}>{value}</p>;
}
