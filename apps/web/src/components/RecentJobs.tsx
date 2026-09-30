'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { clearRecentJobs, readRecentJobs, type RecentJob } from '@/lib/recent-jobs';
import { FitText } from '@/components/FitText';

// Đợt 52 — dải "Tin vừa xem" (chỉ hiện khi đã xem ít nhất 1 tin).
export function RecentJobs({ excludeId, className = '' }: { excludeId?: string; className?: string }) {
  const [list, setList] = useState<RecentJob[]>([]);
  useEffect(() => {
    setList(readRecentJobs().filter((j) => j.id !== excludeId));
  }, [excludeId]);
  if (list.length === 0) return null;
  return (
    <section className={className}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-extrabold text-[15px]">Tin vừa xem</h2>
        <button
          type="button"
          onClick={() => {
            clearRecentJobs();
            setList([]);
          }}
          className="text-[12.5px] text-ink-muted hover:text-primary hover:underline"
        >
          Xoá lịch sử
        </button>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {list.map((j) => (
          <Link
            key={j.id}
            href={`/viec-lam/${j.id}`}
            className="shrink-0 w-[230px] rounded-xl border border-border bg-white px-3 py-2.5 hover:border-primary"
          >
            <div className="font-bold text-[13.5px] leading-snug line-clamp-2">{j.title}</div>
            <div className="mt-1"><FitText lines={1} min={0.7} className="co-name text-[12px]">{j.company}</FitText></div>
          </Link>
        ))}
      </div>
    </section>
  );
}
