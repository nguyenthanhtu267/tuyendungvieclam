'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PinsApi } from '@/lib/pins';
import { rankOptions } from '@/components/ui/Combobox';
import { dismissKeyboard } from '@/lib/mobile-ui';
import { haptic } from '@/lib/haptic';

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
  topAction,
  pins,
  max,
}: {
  label: string;
  placeholder: string;
  groups: MultiSelectGroup[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyText: string;
  // Đợt 66 — mục đặt trên cùng danh sách (VD "Dùng vị trí của tôi").
  // Đợt 74 — ghim tối đa N mục hay chọn (chỉ khi đã đăng nhập).
  pins?: PinsApi;
  /** Số mục chọn tối đa (vd 3). Chọn đủ → các mục còn lại mờ đi, bỏ bớt một mục để chọn thêm. */
  max?: number;
  topAction?: { label: string; onClick: () => Promise<string | void> | string | void };
}) {
  const [actionMsg, setActionMsg] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Đợt 163 — điện thoại (<640px): bảng chọn là ngăn kéo từ đáy; chọn 1 mục xong thì thu lại NGAY (hạ bàn phím), muốn chọn tiếp thì mở lại.
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const f = () => setMobile(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  useEffect(() => {
    if (!(open && mobile)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, mobile]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (window.matchMedia('(max-width: 639px)').matches) return; // điện thoại: đóng bằng nền mờ / nút Xong
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      // Tự động focus ô tìm khi mở popover (theo đặc tả).
      if (!mobile) setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  // Ngăn kéo luôn nằm TRÊN bàn phím ảo (iOS/Android): đo khoảng bị bàn phím che bằng visualViewport.
  const [kb, setKb] = useState(0);
  useEffect(() => {
    if (!(open && mobile) || !window.visualViewport) { setKb(0); return; }
    const vv = window.visualViewport;
    const f = () => setKb(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    f();
    vv.addEventListener('resize', f);
    vv.addEventListener('scroll', f);
    return () => { vv.removeEventListener('resize', f); vv.removeEventListener('scroll', f); };
  }, [open, mobile]);
  // Esc đóng bảng (máy tính).
  useEffect(() => {
    if (!open) return;
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [open]);
  // Vuốt xuống ở thanh tiêu đề để đóng ngăn kéo.
  const dragY = useRef<number | null>(null);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pinnedList = (pins?.list ?? []).filter((p) => groups.some((g) => g.options.includes(p)));
    // Mục đã ghim đưa lên nhóm đầu, bỏ khỏi các nhóm còn lại để không trùng.
    const base = pinnedList.length
      ? [{ label: '📌 Đã ghim', options: pinnedList }, ...groups.map((g) => ({ ...g, options: g.options.filter((o) => !pinnedList.includes(o)) })).filter((g) => g.options.length > 0)]
      : groups;
    if (!q) return base;
    return base
      .map((g) => ({ ...g, options: rankOptions(g.options.map((o) => ({ label: o })), q).map((x) => x.label) }))
      .filter((g) => g.options.length > 0);
  }, [groups, query, pins?.list]);

  function toggle(value: string, fromList = false) {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else if (max && selected.length >= max) {
      setPinMsg(`Chọn tối đa ${max} mục — bỏ bớt một mục để chọn thêm.`);
    } else {
      onChange([...selected, value]);
      haptic(10);
      // Điện thoại: chọn xong thu bảng lại ngay để không che màn hình/bấm nhầm.
      if (fromList && (mobile || (max && selected.length + 1 >= max))) {
        dismissKeyboard();
        setOpen(false);
      }
    }
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
            {(mobile ? selected.slice(0, 2) : selected.slice(0, 4)).map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2 py-0.5 text-[11px] font-semibold text-primary max-w-[48vw] sm:max-w-[160px] truncate"
              >
                {v}
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(v);
                  }}
                  className="text-primary/70 hover:text-primary max-sm:hidden"
                >
                  ✕
                </span>
              </span>
            ))}
            {selected.length > (mobile ? 2 : 4) && (
              <span className="inline-flex items-center rounded-full bg-surface-alt px-2 py-0.5 text-[11px] font-bold text-ink-muted">
                +{selected.length - (mobile ? 2 : 4)}
              </span>
            )}
          </div>
        )}
        <span className="text-ink-faint shrink-0">⌄</span>
      </button>

      {open && mobile && <div className="fixed inset-0 z-[70] bg-black/40" onClick={() => { dismissKeyboard(); setOpen(false); }} aria-hidden />}
      {open && (
        <div
          className={
            mobile
              ? 'fixed inset-x-2 z-[71] mx-auto max-w-[460px] max-h-[min(78dvh,calc(100dvh-5rem))] rounded-2xl border border-border bg-white shadow-2xl flex flex-col overflow-hidden'
              : 'absolute z-40 mt-1.5 w-[min(360px,90vw)] max-h-[380px] rounded-xl border border-border bg-white shadow-lg flex flex-col overflow-hidden'
          }
          style={mobile ? { bottom: `calc(${kb}px + 8px + env(safe-area-inset-bottom, 0px))`, maxHeight: kb ? `calc(100dvh - ${kb}px - 1rem)` : undefined } : undefined}
        >
          <div className="sticky top-0 bg-white border-b border-border px-3 pt-3 pb-2.5 flex flex-col gap-2">
            {mobile && <div className="mx-auto h-1 w-10 rounded-full bg-border-strong -mt-1" aria-hidden />}
            <div
              className="flex items-center justify-between"
              onTouchStart={(e) => { dragY.current = e.touches[0].clientY; }}
              onTouchEnd={(e) => {
                if (dragY.current !== null && e.changedTouches[0].clientY - dragY.current > 70) { dismissKeyboard(); setOpen(false); }
                dragY.current = null;
              }}
            >
              <div className="text-xs max-sm:text-[15px] font-extrabold text-ink">{label}</div>
              {mobile && (
                <button type="button" onClick={() => { dismissKeyboard(); setOpen(false); }} className="h-9 px-4 rounded-full bg-primary text-white font-bold text-[13px]">
                  Xong
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint text-xs">🔎</span>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Gõ để tìm (không cần dấu)"
                enterKeyHint="search"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const first = filteredGroups[0]?.options[0];
                    if (first && query.trim()) { toggle(first, true); setQuery(''); }
                  }
                }}
                className="tvl-input !pl-7 text-xs"
              />
            </div>
            {topAction && (
              <button
                type="button"
                onClick={async () => {
                  setActionMsg('Đang lấy vị trí…');
                  const m = await topAction.onClick();
                  setActionMsg(m || '');
                  if (!m) setOpen(false);
                }}
                className="text-left text-[12.5px] font-bold text-primary hover:bg-primary-tint rounded-lg px-2 py-1.5 border border-primary"
              >
                📍 {topAction.label}
              </button>
            )}
            {mobile && selected.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selected.map((v) => (
                  <button key={v} type="button" onClick={() => toggle(v)} className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2.5 py-1 text-[12.5px] font-semibold text-primary max-w-full">
                    <span className="truncate">{v}</span><span aria-hidden>✕</span>
                  </button>
                ))}
              </div>
            )}
            {actionMsg && <div className="text-[11.5px] text-critical">{actionMsg}</div>}
            {pinMsg && <div className="text-[11.5px] text-critical">{pinMsg}</div>}
            {pins && !pinMsg && <div className="text-[11px] text-ink-faint">Bấm 📌 cạnh mục hay tìm để ghim lên đầu (tối đa {pins.max}).</div>}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-faint">
                {selected.length === 0 ? emptyText : max ? `Đã chọn ${selected.length}/${max}` : `${selected.length} ${label.toLowerCase()} đã chọn`}
              </span>
              {selected.length > 0 && (
                <button type="button" onClick={() => onChange([])} className="font-bold text-primary hover:underline">
                  Xóa
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto overscroll-contain flex-1 py-1">
            {filteredGroups.length === 0 && (
              <div className="text-center text-ink-faint text-xs py-6">Không tìm thấy kết quả</div>
            )}
            {filteredGroups.map((g, gi) => (
              <div key={g.label ?? gi}>
                {g.label && (
                  <div className="px-3 pt-2 pb-1 flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">
                    <span>{g.label}</span>
                    {!max && !query.trim() && g.options.length > 1 && !g.label.startsWith('📌') && (() => {
                      const all = g.options.every((o) => selected.includes(o));
                      return (
                        <button
                          type="button"
                          onClick={() => onChange(all ? selected.filter((v) => !g.options.includes(v)) : Array.from(new Set([...selected, ...g.options])))}
                          className="normal-case text-[11.5px] max-sm:text-[13px] font-bold text-primary hover:underline"
                        >
                          {all ? 'Bỏ cả nhóm' : 'Chọn cả nhóm'}
                        </button>
                      );
                    })()}
                  </div>
                )}
                {g.options.map((opt) => {
                  const checked = selected.includes(opt);
                  const locked = !!max && !checked && selected.length >= max;
                  return (
                    <div key={opt} className={`flex items-center hover:bg-surface-alt ${locked ? 'opacity-45' : ''}`}>
                      <label className="flex-1 min-w-0 flex items-center gap-2.5 pl-3 py-2 max-sm:py-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(opt, true)}
                          className="h-3.5 w-3.5 max-sm:h-5 max-sm:w-5 accent-primary shrink-0"
                        />
                        <span className={`text-[12.5px] max-sm:text-[15px] leading-snug ${checked ? 'font-bold text-primary' : 'text-ink-muted'}`}>
                          {opt}
                        </span>
                      </label>
                      {pins && (
                        <button
                          type="button"
                          onClick={() => setPinMsg(pins.toggle(opt) || '')}
                          aria-pressed={pins.list.includes(opt)}
                          aria-label={pins.list.includes(opt) ? `Bỏ ghim ${opt}` : `Ghim ${opt}`}
                          title={pins.list.includes(opt) ? 'Bỏ ghim' : `Ghim lên đầu (tối đa ${pins.max})`}
                          className={`shrink-0 px-3 py-2 max-sm:py-3 text-[14px] leading-none ${pins.list.includes(opt) ? 'opacity-100' : 'opacity-35 hover:opacity-100'}`}
                        >
                          📌
                        </button>
                      )}
                    </div>
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
