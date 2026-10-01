'use client';

import { useEffect, useRef, useState } from 'react';
import Link from '@/components/SmartLink';
import { clearRecentJobs, readRecentJobs, type RecentJob } from '@/lib/recent-jobs';

// Đợt 52/58 — "Tin vừa xem": nút nhỏ cạnh tiêu đề danh sách, bấm xổ danh sách "Tiêu đề vị trí - Tên công ty" (tiết kiệm diện tích).
// Chỉ hiện khi đã xem ít nhất 1 tin.
export function RecentJobs({ excludeId, className = '' }: { excludeId?: string; className?: string }) {
  const [list, setList] = useState<RecentJob[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setList(readRecentJobs().filter((j) => j.id !== excludeId));
  }, [excludeId]);

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

  if (list.length === 0) return null;
  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="h-8 px-3 rounded-lg border border-border-strong bg-white text-[13px] font-semibold hover:border-primary inline-flex items-center gap-1.5"
      >
        <span aria-hidden>🕘</span> Tin vừa xem ({list.length})
        <span aria-hidden className="text-[10px] text-ink-faint">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="absolute z-30 left-0 top-full mt-1.5 w-[min(420px,calc(100vw-2rem))] rounded-xl border border-border bg-white shadow-lg p-1.5">
          <ul className="max-h-[320px] overflow-y-auto">
            {list.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/viec-lam/${j.id}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-2.5 py-1.5 text-[13px] hover:bg-primary-tint truncate"
                  title={`${j.title} - ${j.company}`}
                >
                  <span className="font-bold">{j.title}</span>
                  <span className="text-ink-muted"> - </span>
                  <span className="co-name text-[12px]">{j.company}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-border mt-1 pt-1 px-2.5 pb-0.5">
            <button
              type="button"
              onClick={() => {
                clearRecentJobs();
                setList([]);
                setOpen(false);
              }}
              className="text-[12.5px] text-ink-muted hover:text-primary hover:underline"
            >
              Xoá lịch sử
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
