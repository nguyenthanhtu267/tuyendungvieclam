'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/SmartLink';
import { jobsApi, type JobPosting } from '@/lib/api';
import { useHomePlace } from '@/lib/geo';
import { whenPageReady } from '@/lib/page-ready';

// Đợt 100 — thẻ gọn ở đầu trang chủ: "Có N việc mới 3 ngày qua ở <tỉnh của bạn>" + 3 tin đầu. Chỉ hiện khi đã biết nơi ở (người dùng
// đã chọn ở "Việc gần tôi"/"Quanh tôi") và thật sự có tin mới; gọi API 1 lần, sau khi trang đã vẽ xong (không làm chậm lần mở đầu).
export default function TodayNew() {
  const home = useHomePlace();
  const province = home?.province;
  const [data, setData] = useState<{ total: number; items: JobPosting[] } | null>(null);
  useEffect(() => {
    if (!province) return;
    let alive = true;
    const cancel = whenPageReady(() => {
      jobsApi
        .list({ provinces: [province], postedWithin: '3d', pageSize: 3 })
        .then((r) => alive && setData({ total: r.total, items: r.items }))
        .catch(() => undefined);
    });
    return () => {
      alive = false;
      cancel();
    };
  }, [province]);
  if (!province || !data || data.total < 1) return null;
  return (
    <section className="mt-2 rounded-xl border border-border bg-white p-3.5" aria-label="Việc mới gần bạn">
      <div className="flex items-center justify-between gap-2">
        <div className="font-extrabold text-[14.5px] text-ink">
          🆕 {data.total} việc mới ở {province}
          <span className="font-semibold text-ink-muted text-[12.5px]"> · 3 ngày qua</span>
        </div>
        <Link href={`/viec-lam?provinces=${encodeURIComponent(province)}&postedWithin=3d`} className="shrink-0 text-[13px] font-bold text-primary min-h-[36px] inline-flex items-center">
          Xem hết →
        </Link>
      </div>
      <div className="mt-1.5 flex flex-col">
        {data.items.map((j) => (
          <Link key={j.id} href={`/viec-lam/${j.id}`} className="py-1.5 border-t border-border first:border-t-0 min-h-[44px] flex flex-col justify-center">
            <span className="text-[13.5px] font-bold text-ink truncate">{j.title}</span>
            <span className="text-[12px] text-ink-muted truncate">{j.company?.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
