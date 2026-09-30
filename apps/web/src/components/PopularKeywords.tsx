'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { jobsApi } from '@/lib/api';

// Đợt 29 (30/09/2026) — khối "Việc làm được tìm kiếm nhiều nhất" (theo mẫu CareerViet). Từ khoá thật do người dùng đã tìm
// trong 30 ngày (xem JobsService.getPopularKeywords). Bấm vào một từ khoá → mở danh sách việc làm đã tìm sẵn.
let cache: string[] | null = null;

export function PopularKeywords() {
  const [kws, setKws] = useState<string[] | null>(cache);
  useEffect(() => {
    if (cache) return;
    jobsApi
      .popularKeywords()
      .then((r) => {
        cache = r.keywords;
        setKws(r.keywords);
      })
      .catch(() => setKws([]));
  }, []);
  if (!kws || kws.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-white overflow-hidden" aria-label="Việc làm được tìm kiếm nhiều nhất">
      <h2 className="bg-primary-tint text-ink font-extrabold text-[15px] px-3 py-2">Việc làm được tìm kiếm nhiều nhất</h2>
      <div className="flex flex-wrap gap-1.5 p-3">
        {kws.map((k) => (
          <Link
            key={k}
            href={`/viec-lam?q=${encodeURIComponent(k)}`}
            className="rounded-md bg-primary-tint text-primary font-bold text-[13.5px] px-2.5 py-1 hover:bg-primary hover:text-white transition-colors capitalize"
          >
            {k}
          </Link>
        ))}
      </div>
    </section>
  );
}
