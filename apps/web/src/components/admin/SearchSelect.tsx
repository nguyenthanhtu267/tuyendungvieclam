'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// Đợt 127 — ô chọn có gõ tìm (không cần dấu: gõ "ke toan" ra "Kế toán / Kiểm toán"). Dùng cho Ngành nghề trong Hộp nhập tin.
function fold(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

export function SearchSelect({ id, value, options, placeholder, onChange }: { id?: string; value: string; options: string[]; placeholder?: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useMemo(() => {
    const f = fold(q.trim());
    return f ? options.filter((o) => fold(o).includes(f)) : options;
  }, [q, options]);

  useEffect(() => {
    function away(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) {
        setOpen(false);
        setQ('');
      }
    }
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQ('');
  }

  return (
    <div ref={box} className="relative">
      <input
        id={id}
        className="tvl-input w-full"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder ?? '— Chọn hoặc gõ để tìm —'}
        value={open ? q : value}
        onFocus={() => {
          setOpen(true);
          setHi(0);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHi((h) => Math.min(h + 1, list.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHi((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (list[hi]) pick(list[hi]);
          } else if (e.key === 'Escape') {
            setOpen(false);
            setQ('');
          }
        }}
      />
      {value && !open && (
        <button type="button" aria-label="Xóa lựa chọn" onClick={() => pick('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint text-sm px-1">×</button>
      )}
      {open && (
        <ul role="listbox" className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-lg border border-border bg-white shadow-lg text-xs">
          {list.length === 0 ? (
            <li className="px-3 py-2 text-ink-faint">Không có ngành khớp "{q}"</li>
          ) : (
            list.map((o, i) => (
              <li
                key={o}
                role="option"
                aria-selected={o === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                onMouseEnter={() => setHi(i)}
                className={`px-3 py-2 cursor-pointer ${i === hi ? 'bg-primary-tint text-primary' : ''} ${o === value ? 'font-bold' : ''}`}
              >
                {o}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
