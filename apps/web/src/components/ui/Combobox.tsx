'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

// Đợt 135 — ô chọn DÙNG CHUNG toàn web cho danh sách dài (tỉnh/thành, quận/huyện, phường/xã, ngành nghề, nhóm việc,
// tin tuyển dụng…): gõ thẳng vào ô để lọc (không cần dấu: "ke toan" → "Kế toán / Kiểm toán", "tdm" khớp chữ đầu
// "Thủ Dầu Một"), mũi tên ↑↓ + Enter để chọn, Esc để đóng, nút × để xoá. Thay cho <select> phải cuộn tìm.
export type ComboOption = string | { value: string; label: string; hint?: string };

export function foldVi(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}
const initials = (s: string) => foldVi(s).split(/[^a-z0-9]+/).filter(Boolean).map((w) => w[0]).join('');

function norm(o: ComboOption) {
  return typeof o === 'string' ? { value: o, label: o, hint: undefined as string | undefined } : { value: o.value, label: o.label, hint: o.hint };
}

/** Xếp hạng: khớp đầu chuỗi > khớp đầu từ > chữ cái đầu (viết tắt) > chứa bên trong. */
export function rankOptions<T extends { label: string }>(list: T[], q: string): T[] {
  const f = foldVi(q);
  if (!f) return list;
  const scored: { o: T; s: number; i: number }[] = [];
  list.forEach((o, i) => {
    const l = foldVi(o.label);
    let s = -1;
    if (l.startsWith(f)) s = 0;
    else if ((' ' + l).includes(' ' + f)) s = 1;
    else if (f.length >= 2 && !f.includes(' ') && initials(o.label).startsWith(f)) s = 2;
    else if (l.includes(f)) s = 3;
    else if (f.includes(' ') && f.split(' ').every((w) => l.includes(w))) s = 4;
    if (s >= 0) scored.push({ o, s, i });
  });
  return scored.sort((a, b) => a.s - b.s || a.i - b.i).map((x) => x.o);
}

export function Combobox({
  id,
  value,
  options,
  onChange,
  placeholder = '— Chọn hoặc gõ để tìm —',
  allLabel,
  ariaLabel,
  className = 'w-full',
  inputClassName = '',
  disabled,
  beforeOpen,
  emptyText = 'Không có mục nào khớp',
  inputMode,
  clearable = true,
}: {
  id?: string;
  value: string;
  options: ComboOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  /** Nhãn của lựa chọn rỗng (vd "Tất cả tỉnh/thành"). Có → hiện ở đầu danh sách và khi chưa chọn. */
  allLabel?: string;
  ariaLabel?: string;
  /** Lớp cho khung ngoài (độ rộng): mặc định w-full. */
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  /** Trả false để chặn mở (vd chưa chọn tỉnh thì chưa cho chọn quận). */
  beforeOpen?: () => boolean;
  emptyText?: string;
  inputMode?: 'text' | 'numeric';
  /** Hiện nút × xoá lựa chọn (tắt ở ô hẹp như Năm sinh). */
  clearable?: boolean;
}) {
  const autoId = useId();
  const inputId = id ?? `cb-${autoId}`;
  const listId = `${inputId}-list`;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const opts = useMemo(() => options.map(norm), [options]);
  const current = opts.find((o) => o.value === value);
  const shown = useMemo(() => {
    const r = rankOptions(opts, q);
    return allLabel !== undefined && !q.trim() ? [{ value: '', label: allLabel, hint: undefined }, ...r] : r;
  }, [opts, q, allLabel]);

  useEffect(() => {
    if (!open) return;
    function away(e: MouseEvent | TouchEvent) {
      if (box.current && !box.current.contains(e.target as Node)) close();
    }
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('touchstart', away);
    };
  }, [open]);
  useEffect(() => {
    const el = listRef.current?.children[hi] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [hi, open]);

  function close() {
    setOpen(false);
    setQ('');
  }
  function tryOpen() {
    if (disabled) return false;
    if (beforeOpen && beforeOpen() === false) return false;
    if (!open) {
      setOpen(true);
      const idx = shown.findIndex((o) => o.value === value);
      setHi(idx >= 0 ? idx : 0);
    }
    return true;
  }
  function pick(v: string) {
    onChange(v);
    close();
  }

  return (
    <div ref={box} className={`relative ${className}`}>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        inputMode={inputMode}
        disabled={disabled}
        className={`tvl-input w-full ${clearable ? 'pr-12' : 'pr-7'} ${inputClassName}`}
        placeholder={current ? current.label : allLabel ?? placeholder}
        value={open ? q : current?.label ?? (value && !current ? value : '')}
        onMouseDown={(e) => {
          if (!tryOpen()) e.preventDefault();
        }}
        onFocus={() => tryOpen()}
        onChange={(e) => {
          if (!open && !tryOpen()) return;
          setQ(e.target.value);
          setHi(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!tryOpen()) return;
            setHi((h) => Math.min(h + 1, shown.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHi((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            if (!open) return;
            e.preventDefault();
            if (shown[hi]) pick(shown[hi].value);
          } else if (e.key === 'Escape') {
            close();
          } else if (e.key === 'Tab') {
            if (open && q.trim() && shown[hi]) pick(shown[hi].value);
            else close();
          }
        }}
      />
      {clearable && value && !disabled ? (
        <button type="button" aria-label="Xoá lựa chọn" onClick={() => pick('')} className="absolute right-7 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-ink-faint hover:text-critical text-base">×</button>
      ) : null}
      <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-faint">▾</span>
      {open && (
        <ul ref={listRef} id={listId} role="listbox" className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-auto rounded-lg border border-border-strong bg-white shadow-lg text-[14px] font-normal text-ink">
          {shown.length === 0 ? (
            <li className="px-3 py-2 text-ink-faint">{emptyText} “{q}”</li>
          ) : (
            shown.map((o, i) => (
              <li
                key={o.value || '__all'}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o.value);
                }}
                onMouseEnter={() => setHi(i)}
                className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2 ${i === hi ? 'bg-primary-tint text-primary' : ''} ${o.value === value ? 'font-bold' : ''} ${!o.value ? 'text-ink-muted' : ''}`}
              >
                <span className="min-w-0 break-words">{o.label}</span>
                {o.hint && <span className="shrink-0 text-[12px] text-ink-faint">{o.hint}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
