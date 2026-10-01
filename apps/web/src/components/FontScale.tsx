'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { applySaver, applyTextOnly, readSaver, readTextOnly, setSaver, setTextOnly, useDataSaver, useSavedKb, useTextOnly } from '@/lib/data-saver';

// Đợt 48 — gộp "Ngôn ngữ" + "Cỡ chữ" vào 1 nút tối giản trên header (thay cho 2 nút 🌐 VI và AA).
// Cỡ chữ 80% → 200% (bước 10%), áp cho TOÀN website (mọi cỡ chữ/khoảng cách dùng rem).
// Lưu ở trình duyệt; script nhỏ trong <head> (layout.tsx) áp lại ngay khi mở trang để không nhấp nháy.
export const FONT_KEY = 'tvl_font_pct';
export const DARK_KEY = 'tvl_dark';
const OLD_KEY = 'tvl_font_level'; // Đợt 29: mức 0–8 (100%–140%)
export const FONT_MIN = 80;
export const FONT_MAX = 200;
const STEP = 5;

export function applyFontPct(pct: number) {
  document.documentElement.style.fontSize = `${pct}%`;
}

function readPct(): number {
  try {
    const v = Number(localStorage.getItem(FONT_KEY));
    if (v >= FONT_MIN && v <= FONT_MAX) return v;
    const old = Number(localStorage.getItem(OLD_KEY));
    if (old > 0 && old <= 8) return 100 + old * 5;
  } catch {
    /* bỏ qua */
  }
  return 100;
}

export function FontScale({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLanguage();
  const [pct, setPct] = useState(100);
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState<'0' | '1' | 'auto'>('0');
  useEffect(() => {
    try { const v = localStorage.getItem(DARK_KEY); setDark(v === '1' || v === 'auto' ? v : '0'); } catch { /* bỏ qua */ }
  }, []);
  function chooseDark(v: '0' | '1' | 'auto') {
    setDark(v);
    const on = v === '1' || (v === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (on) document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem(DARK_KEY, v); } catch { /* bỏ qua */ }
  }
  const boxRef = useRef<HTMLDivElement>(null);

  const saver = useDataSaver();
  const textOnly = useTextOnly();
  const savedKb = useSavedKb();
  useEffect(() => {
    setPct(readPct());
    applySaver(readSaver());
    applyTextOnly(readTextOnly());
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
    const n = Math.max(FONT_MIN, Math.min(FONT_MAX, Math.round(v / STEP) * STEP));
    setPct(n);
    applyFontPct(n);
    try {
      localStorage.setItem(FONT_KEY, String(n));
      localStorage.removeItem(OLD_KEY);
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
        aria-label="Ngôn ngữ và cỡ chữ"
        title="Ngôn ngữ & cỡ chữ"
        className={`h-9 inline-flex items-center gap-1 rounded-lg border border-border-strong bg-white px-2.5 text-[14px] font-bold text-ink hover:border-primary hover:text-primary transition-colors ${className}`}
      >
        <span aria-hidden>🌐</span>
        {lang === 'vi' ? 'VI' : 'EN'}
        <span aria-hidden className="text-[10px] text-ink-faint">▾</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Ngôn ngữ và cỡ chữ" className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-border bg-white shadow-xl p-3 flex flex-col gap-3">
          <div>
            <div className="font-extrabold text-sm text-ink mb-1.5">Ngôn ngữ</div>
            <div className="grid grid-cols-2 gap-1 p-1 bg-surface-alt rounded-lg text-[14px] font-semibold">
              {(['vi', 'en'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`py-1.5 rounded-md ${lang === l ? 'bg-white shadow text-ink' : 'text-ink-muted'}`}
                >
                  {l === 'vi' ? 'Tiếng Việt' : 'English'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-extrabold text-sm text-ink">Cỡ chữ: {pct}%</span>
              <button type="button" onClick={() => change(100)} className="text-[13px] font-bold text-primary hover:underline">
                Đặt lại 100%
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => change(pct - STEP)} disabled={pct <= FONT_MIN} aria-label="Giảm cỡ chữ" className="w-8 h-8 rounded-md border border-border-strong font-extrabold text-sm disabled:opacity-40">
                A−
              </button>
              <input
                id="font-scale-range"
                type="range"
                min={FONT_MIN}
                max={FONT_MAX}
                step={STEP}
                value={pct}
                onChange={(e) => change(Number(e.target.value))}
                aria-label="Kéo để đổi cỡ chữ"
                className="flex-1 accent-[#163B7A]"
              />
              <button type="button" onClick={() => change(pct + STEP)} disabled={pct >= FONT_MAX} aria-label="Tăng cỡ chữ" className="w-8 h-8 rounded-md border border-border-strong font-extrabold text-base disabled:opacity-40">
                A+
              </button>
            </div>
            <div className="flex justify-between text-[12px] text-ink-faint mt-0.5">
              <span>80%</span>
              <span>200%</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <div className="mb-3">
              <div className="font-extrabold text-sm text-ink">🌙 Chế độ tối (thử nghiệm)</div>
              <div className="grid grid-cols-3 gap-1 p-1 bg-surface-alt rounded-lg text-[13px] font-semibold mt-1.5">
                {([['0', 'Tắt'], ['1', 'Bật'], ['auto', 'Theo máy']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => chooseDark(v)} aria-pressed={dark === v} className={`py-1.5 rounded-md ${dark === v ? 'bg-white shadow text-ink' : 'text-ink-muted'}`}>{l}</button>
                ))}
              </div>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input id="data-saver" type="checkbox" checked={saver} onChange={(e) => setSaver(e.target.checked)} className="mt-1 w-4 h-4 accent-[#163B7A]" />
              <span>
                <span className="font-extrabold text-sm text-ink block">Tiết kiệm dữ liệu</span>
                <span className="text-[12.5px] text-ink-soft block">Tắt nền hình và banner quảng cáo — trang tải nhanh hơn khi mạng yếu.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer mt-3">
              <input id="text-only" type="checkbox" checked={textOnly} onChange={(e) => setTextOnly(e.target.checked)} className="mt-1 w-4 h-4 accent-[#163B7A]" />
              <span>
                <span className="font-extrabold text-sm text-ink block">Chỉ chữ</span>
                <span className="text-[12.5px] text-ink-soft block">Không tải logo và hình ảnh, chỉ giữ chữ — nhanh nhất khi WiFi yếu.</span>
                {textOnly && savedKb > 0 && <span className="text-[12px] text-success font-semibold block">Đã tiết kiệm khoảng {savedKb} KB trong lần mở web này (ước tính).</span>}
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
