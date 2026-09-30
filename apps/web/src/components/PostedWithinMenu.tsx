'use client';

import { useEffect, useRef, useState } from 'react';

const OPTIONS: [string, string][] = [
  ['3d', '3 ngày qua'],
  ['7d', '7 ngày qua'],
  ['15d', '15 ngày qua'],
  ['30d', '30 ngày qua'],
];

// Đợt 69 — nút "Chỉ tin đăng" xổ danh sách 3 / 7 / 15 / 30 ngày (cùng kiểu "Tin vừa xem").
export function PostedWithinMenu({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const cur = OPTIONS.find(([v]) => v === value);
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`h-8 px-3 rounded-lg border bg-white text-[13px] font-semibold hover:border-primary inline-flex items-center gap-1.5 ${cur ? 'border-primary text-primary' : 'border-border-strong'}`}
      >
        <span aria-hidden>🗓</span> Chỉ tin đăng{cur ? `: ${cur[1]}` : ''}
        <span aria-hidden className="text-[10px] text-ink-faint">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div role="listbox" className="absolute z-30 left-0 top-full mt-1.5 w-[200px] rounded-xl border border-border bg-white shadow-lg p-1.5">
          {OPTIONS.map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="option"
              aria-selected={value === v}
              onClick={() => {
                onChange(v);
                setOpen(false);
              }}
              className={`w-full text-left rounded-lg px-2.5 py-1.5 text-[13px] hover:bg-primary-tint flex items-center justify-between ${value === v ? 'font-bold text-primary' : ''}`}
            >
              {l}
              {value === v && <span aria-hidden>✓</span>}
            </button>
          ))}
          {cur && (
            <div className="border-t border-border mt-1 pt-1 px-2.5 pb-0.5">
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
                className="text-[12.5px] text-ink-muted hover:text-primary hover:underline"
              >
                Bỏ lọc ngày đăng
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
