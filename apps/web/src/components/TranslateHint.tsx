'use client';

// Đợt 65 — phát hiện tin viết bằng tiếng nước ngoài (không có dấu tiếng Việt, nhiều từ tiếng Anh) và gợi ý mở Google Dịch.
// Web không tự dịch; chỉ phát hiện ngôn ngữ và đưa liên kết (người dùng chủ động bấm).
const strip = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const EN = /\b(the|and|with|experience|responsibilities|requirements|skills|will|you|our|team|work|ability)\b/gi;
export function looksEnglish(text: string): boolean {
  const t = strip(text);
  if (t.length < 60) return false;
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(t)) return false;
  return (t.match(EN) || []).length >= 5;
}
export default function TranslateHint({ html }: { html: string }) {
  if (!looksEnglish(html)) return null;
  const text = strip(html).slice(0, 1500);
  const href = `https://translate.google.com/?sl=auto&tl=vi&op=translate&text=${encodeURIComponent(text)}`;
  return (
    <div className="rounded-lg bg-info-tint border border-border p-2.5 text-[12.5px] mb-3">
      Tin này có vẻ viết bằng tiếng Anh.{' '}
      <a href={href} target="_blank" rel="noopener noreferrer" className="font-bold text-primary hover:underline">Dịch sang tiếng Việt bằng Google Dịch →</a>
      <span className="text-ink-faint"> (mở trang của Google, nội dung mô tả tin được gửi sang đó)</span>
    </div>
  );
}
