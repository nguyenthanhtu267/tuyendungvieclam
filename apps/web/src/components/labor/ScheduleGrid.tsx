'use client';

import { DAYS, DAY_LABEL, PARTS, PART_LABEL } from '@/lib/labor';

// Đợt 80 — lưới thứ × buổi: lịch rảnh của sinh viên / ca cần người của tin sinh viên.
/** `allowed`: chỉ cho chọn các ô này (thực tập sinh: giờ hành chính, không có buổi tối/Chủ nhật). */
export function ScheduleGrid({ value, onChange, idPrefix, allowed }: { value: string[]; onChange: (v: string[]) => void; idPrefix: string; allowed?: string[] }) {
  const days = allowed ? DAYS.filter((d) => allowed.some((s) => s.startsWith(`${d}-`))) : DAYS;
  const parts = allowed ? PARTS.filter((p) => allowed.some((s) => s.endsWith(`-${p}`))) : PARTS;
  const toggle = (s: string) => onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
  return (
    <div className="overflow-x-auto">
      <table className="text-[13px] border-separate border-spacing-1" id={idPrefix}>
        <thead>
          <tr>
            <th />
            {days.map((d) => (
              <th key={d} className="font-bold text-ink px-1">{DAY_LABEL[d]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p}>
              <th className="font-bold text-ink text-left pr-1">{PART_LABEL[p]}</th>
              {days.map((d) => {
                const s = `${d}-${p}`;
                if (allowed && !allowed.includes(s)) return <td key={s}><div className="w-9 h-8 rounded-md bg-surface-alt" aria-hidden /></td>;
                const on = value.includes(s);
                return (
                  <td key={s}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`${PART_LABEL[p]} ${DAY_LABEL[d]}`}
                      onClick={() => toggle(s)}
                      className={`w-9 h-8 rounded-md border font-extrabold ${on ? 'bg-primary border-primary text-white' : 'bg-white border-border-strong text-ink-faint'}`}
                    >
                      {on ? '✓' : ''}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
