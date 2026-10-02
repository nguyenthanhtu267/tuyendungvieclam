'use client';

import { Combobox } from '@/components/ui/Combobox';

// Đợt 79 — chọn ngày sinh bằng 3 ô Ngày / Tháng / Năm (dễ dùng trên điện thoại hơn lịch).
export function DateSelect({ value, onChange, idPrefix }: { value: string; onChange: (v: string) => void; idPrefix: string }) {
  const [y, m, d] = value ? value.split('-') : ['', '', ''];
  const now = new Date().getFullYear();
  const years = Array.from({ length: 56 }, (_, i) => String(now - 15 - i));
  const emit = (ny: string, nm: string, nd: string) => {
    if (ny && nm && nd) {
      const max = new Date(Number(ny), Number(nm), 0).getDate();
      const dd = String(Math.min(Number(nd), max)).padStart(2, '0');
      onChange(`${ny}-${nm}-${dd}`);
    } else onChange(ny || nm || nd ? `${ny}-${nm}-${nd}` : '');
  };
  const cls = 'tvl-input font-normal !px-2';
  return (
    <div className="grid grid-cols-[1fr_1fr_1.3fr] gap-1.5">
      <select id={`${idPrefix}-d`} aria-label="Ngày" className={cls} value={d ?? ''} onChange={(e) => emit(y, m, e.target.value)}>
        <option value="">Ngày</option>
        {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((v) => (
          <option key={v} value={v}>{Number(v)}</option>
        ))}
      </select>
      <select id={`${idPrefix}-m`} aria-label="Tháng" className={cls} value={m ?? ''} onChange={(e) => emit(y, e.target.value, d)}>
        <option value="">Tháng</option>
        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((v) => (
          <option key={v} value={v}>Tháng {Number(v)}</option>
        ))}
      </select>
      {/* Đợt 135 — năm sinh: gõ thẳng "1998" (danh sách 56 năm, cuộn rất lâu) */}
      <Combobox id={`${idPrefix}-y`} ariaLabel="Năm" inputClassName="font-normal !pl-2" inputMode="numeric" clearable={false} value={y ?? ''} options={years} placeholder="Năm" onChange={(v) => emit(v, m, d)} />
    </div>
  );
}
export const isFullDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
