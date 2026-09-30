'use client';

import { useEffect, useRef, useState } from 'react';

// Đợt 29 (30/09/2026) — nút "Aa" trên header: thanh kéo tăng cỡ chữ TOÀN website, mỗi mức +5% (0 → 100%, tối đa mức 8 → 140%).
// Lưu ở trình duyệt (localStorage); script nhỏ trong <head> (layout.tsx) áp lại ngay khi mở trang để không bị nhấp nháy.
// Mọi cỡ chữ/khoảng cách của web dùng đơn vị rem nên co giãn theo đồng bộ.
export const FONT_KEY = 'tvl_font_level';
const MAX_LEVEL = 8;

export function applyFontLevel(level: number) {
  document.documentElement.style.fontSize = `${100 + level * 5}%`;
}

export function FontScale() {
  const [level, setLevel] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(FONT_KEY));
      if (Number.isInteger(v) && v >= 0 && v <= MAX_LEVEL) setLevel(v);
    } catch {
      /* bỏ qua */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', off);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', off);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  function change(v: number) {
    const n = Math.max(0, Math.min(MAX_LEVEL, v));
    setLevel(n);
    applyFontLevel(n);
    try {
      localStorage.setItem(FONT_KEY, String(n));
    } catch {
      /* bỏ qua */
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Chỉnh cỡ chữ"
        title="Chỉnh cỡ chữ"
        className="text-[13px] font-extrabold text-ink border border-border-strong rounded-md px-2 py-1 hover:border-primary hover:text-primary transition-colors"
      >
        A<span className="text-[15px]">A</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Cỡ chữ" className="absolute right-0 top-full mt-1 z-50 w-64 rounded-xl border border-border bg-white shadow-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-extrabold text-sm text-ink">Cỡ chữ: {100 + level * 5}%</span>
            <button type="button" onClick={() => change(0)} className="text-[13px] font-bold text-primary hover:underline">
              Đặt lại
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => change(level - 1)} disabled={level === 0} aria-label="Giảm cỡ chữ" className="w-8 h-8 rounded-md border border-border-strong font-extrabold text-sm disabled:opacity-40">
              A−
            </button>
            <input
              type="range"
              min={0}
              max={MAX_LEVEL}
              step={1}
              value={level}
              onChange={(e) => change(Number(e.target.value))}
              aria-label="Kéo để đổi cỡ chữ"
              className="flex-1 accent-[#163B7A]"
            />
            <button type="button" onClick={() => change(level + 1)} disabled={level === MAX_LEVEL} aria-label="Tăng cỡ chữ" className="w-8 h-8 rounded-md border border-border-strong font-extrabold text-base disabled:opacity-40">
              A+
            </button>
          </div>
          <div className="text-[12.5px] font-semibold text-ink-muted mt-1.5">Mỗi mức tăng 5% — áp dụng cho toàn bộ website.</div>
        </div>
      )}
    </div>
  );
}
