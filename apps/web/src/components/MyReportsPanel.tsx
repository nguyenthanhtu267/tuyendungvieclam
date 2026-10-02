'use client';

import Link from '@/components/SmartLink';
import { useEffect, useState } from 'react';
import { smartApi7, type MyReport } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';

// Đợt 87 — người báo cáo tin xem được tiến trình xử lý (đã nhận → đã xử lý). Chỉ hiện khi có báo cáo.
export default function MyReportsPanel() {
  const { token } = useAuth();
  const [items, setItems] = useState<MyReport[]>([]);
  useEffect(() => {
    if (token) smartApi7.myReports(token).then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [token]);
  if (!items.length) return null;
  return (
    <details className="rounded-xl border border-border bg-white">
      <summary className="cursor-pointer px-4 py-3 font-bold text-[14.5px] text-ink">Góp ý về tin của bạn ({items.length})</summary>
      <ul className="px-4 pb-3 flex flex-col gap-2">
        {items.map((r) => (
          <li key={r.id} className="rounded-lg border border-border px-3 py-2 text-[13.5px] text-ink">
            <div className="font-bold">{r.title === 'Tin đã gỡ' ? r.title : <Link href={`/viec-lam/${r.jobId}`} className="text-primary hover:underline">{r.title}</Link>}</div>
            <div className="text-ink-muted text-[12.5px]">Gửi ngày {formatDate(r.createdAt)}</div>
            <div className={r.done ? 'text-success font-bold' : 'text-ink font-bold'}>{r.stage}</div>
          </li>
        ))}
      </ul>
    </details>
  );
}
