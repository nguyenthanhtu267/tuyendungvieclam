'use client';

import { useEffect, useState } from 'react';
import { clearRecent, readRecent, suggestQuery } from '@/lib/search-hints';

// Đợt 87 — dưới ô tìm kiếm: "Có phải bạn muốn tìm…" khi gõ không dấu/viết tắt; khi ô trống thì hiện 5 lần tìm gần nhất.
export default function SearchHints({ q, onPick }: { q: string; onPick: (v: string) => void }) {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(readRecent()), [q]);
  const hints = suggestQuery(q);
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
