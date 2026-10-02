// Đợt 145 — mọi chỗ ghi link nguồn ngoài (careerviet.vn…) chỉ hiện "Nguồn tại đây"; bấm mới mở trang gốc.
export function SourceLink({ url, label = 'Nguồn tại đây', className = '' }: { url?: string | null; label?: string; className?: string }) {
  if (!url || !/^https?:\/\//i.test(url)) return <span className="text-ink-faint">—</span>;
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* giữ nguyên */ }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={`Mở trang gốc: ${host}`} className={`text-primary font-semibold hover:underline whitespace-nowrap ${className}`}>
      {label}
    </a>
  );
}
