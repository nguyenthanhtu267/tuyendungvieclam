'use client';

// Đợt 70 — nút bật/tắt gọn (cùng chiều cao h-8 với "Tin vừa xem", "Chỉ tin đăng") để các bộ lọc nằm chung 1 dòng.
export function ToggleChip({ checked, onChange, children, title, badge, disabled }: { disabled?: boolean; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; title?: string; badge?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`h-8 px-3 rounded-lg border text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-55 disabled:cursor-not-allowed ${
        checked ? 'bg-primary text-white border-primary' : 'bg-white border-border-strong hover:border-primary'
      }`}
    >
      <span aria-hidden className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[10px] leading-none ${checked ? 'bg-white text-primary border-white' : 'border-border-strong'}`}>
        {checked ? '✓' : ''}
      </span>
      {children}
      {badge && <span className="text-[11.5px] font-bold opacity-90">{badge}</span>}
    </button>
  );
}
