'use client';

import { useEffect, useState } from 'react';
import { clearRecent, fold, readRecent, suggestQuery } from '@/lib/search-hints';
import { INDUSTRIES } from '@/lib/catalogs';

// Đợt 87 — dưới ô tìm kiếm: "Có phải bạn muốn tìm…" khi gõ không dấu/viết tắt; khi ô trống thì hiện 5 lần tìm gần nhất.
export default function SearchHints({ q, onPick, onPickIndustry }: { q: string; onPick: (v: string) => void; onPickIndustry?: (v: string) => void }) {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(readRecent()), [q]);
  const hints = suggestQuery(q);
  // Đợt 105 — gõ ≥2 ký tự khớp tên ngành (không dấu cũng được) → gợi ý bấm 1 chạm để LỌC theo ngành đó (tối đa 3 gợi ý).
  const fq = fold(q);
  const inds = onPickIndustry && fq.length >= 2 ? INDUSTRIES.filter((i) => fold(i).includes(fq)).slice(0, 3) : [];
  if (inds.length && !hints.length) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink" role="status">
        Lọc theo ngành:
        {inds.map((h) => (
          <button key={h} type="button" onClick={() => onPickIndustry?.(h)} className="rounded-full border border-primary bg-white text-primary font-bold px-2.5 min-h-[32px] hover:bg-primary-tint">{h}</button>
        ))}
      </div>
    );
  }
  if (hints.length) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink" role="status">
        Có phải bạn muốn tìm:
        {hints.map((h) => (
          <button key={h} type="button" onClick={() => onPick(h)} className="rounded-full border border-primary bg-white text-primary font-bold px-2.5 py-0.5 hover:bg-primary-tint">{h}</button>
        ))}
      </div>
    );
  }
  if (!q.trim() && recent.length) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink">
        Tìm gần đây:
        {recent.map((h) => (
          <button key={h} type="button" onClick={() => onPick(h)} className="rounded-full border border-border-strong bg-white text-ink px-2.5 py-0.5 hover:border-primary">{h}</button>
        ))}
        <button type="button" onClick={() => { clearRecent(); setRecent([]); }} className="text-ink-muted underline">Xoá</button>
      </div>
    );
  }
  return null;
}
