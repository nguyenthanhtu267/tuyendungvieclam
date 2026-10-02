'use client';

// Đợt 135 — chip lọc theo KÊNH tin dùng chung (Duyệt tin, Hộp nhập tin…): Văn phòng / Công nhân / Sinh viên / Thực tập.
export const CHANNEL_LABEL: Record<string, string> = { office: 'Văn phòng', worker: 'Công nhân', student: 'Sinh viên', intern: 'Thực tập' };
export const CHANNEL_ICON: Record<string, string> = { office: '💼', worker: '🧰', student: '🎓', intern: '📋' };

export function ChannelChips({ value, onChange, counts }: { value: string; onChange: (v: string) => void; counts?: Record<string, number> }) {
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;
  const items: [string, string][] = [['', 'Tất cả'], ...Object.entries(CHANNEL_LABEL)];
  return (
    <div role="radiogroup" aria-label="Kênh tin" className="flex items-center gap-1.5 flex-wrap text-[12px]">
      <span className="text-ink-faint font-semibold">Kênh:</span>
      {items.map(([k, l]) => {
        const n = counts ? (k ? counts[k] ?? 0 : total) : undefined;
        if (k && counts && !n && value !== k) return null;
        return (
          <button key={k || 'all'} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)} className={`rounded-full border px-2.5 py-1 font-bold ${value === k ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white text-ink'}`}>
            {k ? `${CHANNEL_ICON[k]} ` : ''}{l}{n !== undefined ? ` (${n})` : ''}
          </button>
        );
      })}
    </div>
  );
}
