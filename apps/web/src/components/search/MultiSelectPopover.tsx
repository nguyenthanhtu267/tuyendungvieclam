'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// Đợt 10 — popover lọc nhiều lựa chọn dùng chung cho "Tỉnh, Thành Phố" và "Ngành nghề"
// (claude/06-spec-tim-kiem-nang-cao.md mục 1): không có nút "Áp dụng", chọn là lọc ngay; ô tìm +
// dòng trạng thái dính cố định khi cuộn; kết quả chọn hiện thành chip trong ô lọc.

export interface MultiSelectGroup {
  label?: string;
  options: string[];
}

export function MultiSelectPopover({
  label,
  placeholder,
  groups,
  selected,
  onChange,
  emptyText,
}: {
  label: string;
  placeholder: string;
  groups: MultiSelectGroup[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      // Tự động focus ô tìm khi mở popover (theo đặc tả).
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, options: g.options.filter((o) => o.toLowerCase().includes(q)) }))
      .filter((g) => g.options.length > 0);
  }, [groups, query]);

  function toggle(value: string) {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`tvl-input flex items-center gap-1.5 !h-auto min-h-[42px] cursor-pointer text-left ${
          open ? 'ring-1 ring-primary border-primary' : ''
        }`}
      >
        {selected.length === 0 ? (
          <span className="text-ink-faint flex-1">{placeholder}</span>
        ) : (
          <div className="flex-1 flex flex-wrap gap-1 py-0.5">
            {selected.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2 py-0.5 text-[11px] font-semibold text-primary"
              >
                {v}
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(v);
                  }}
                  className="text-primary/70 hover:text-primary"
                >
                  ✕
                </span>
              </span>
            ))}
          </div>
        )}
        <span className="text-ink-faint shrink-0">⌄</span>
      </button>

      {open && (
        <div className="absolute z-40 mt-1.5 w-[min(360px,90vw)] max-h-[380px] rounded-xl border border-border bg-white shadow-lg flex flex-col overflow-hidden">
          <div className="sticky top-0 bg-white border-b border-border px-3 pt-3 pb-2.5 flex flex-col gap-2">
            <div className="text-xs font-extrabold text-ink">{label}</div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint text-xs">🔎</span>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm kiếm"
                className="tvl-input !pl-7 text-xs"
              />
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-faint">
                {selected.length === 0 ? emptyText : `${selected.length} ${label.toLowerCase()} đã chọn`}
              </span>
              {selected.length > 0 && (
                <button type="button" onClick={() => onChange([])} className="font-bold text-primary hover:underline">
                  Xóa
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto flex-1 py-1">
            {filteredGroups.length === 0 && (
              <div className="text-center text-ink-faint text-xs py-6">Không tìm thấy kết quả</div>
            )}
            {filteredGroups.map((g, gi) => (
              <div key={g.label ?? gi}>
                {g.label && (
                  <div className="px-3 pt-2 pb-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">
                    {g.label}
                  </div>
                )}
                {g.options.map((opt) => {
                  const checked = selected.includes(opt);
                  return (
                    <label
                      key={opt}
                      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-surface-alt"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(opt)}
                        className="h-3.5 w-3.5 accent-primary shrink-0"
                      />
                      <span className={`text-[12.5px] leading-snug ${checked ? 'font-bold text-primary' : 'text-ink-muted'}`}>
                        {opt}
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
