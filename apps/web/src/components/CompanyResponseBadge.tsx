'use client';

import { useEffect, useState } from 'react';
import { smartApi2, type CompanyResponseStats } from '@/lib/api';

const TONE = {
  good: 'text-success',
  fair: 'text-warning',
  poor: 'text-critical',
} as const;

// Đợt 64 — độ phản hồi của công ty tính từ đơn ứng tuyển thật (180 ngày gần nhất), chỉ hiện khi có từ 5 đơn.
export default function CompanyResponseBadge({ companyId }: { companyId: string }) {
  const [s, setS] = useState<CompanyResponseStats | null>(null);
  useEffect(() => {
    smartApi2.responseStats(companyId).then(setS).catch(() => setS(null));
  }, [companyId]);
  if (!s || !s.enough || !s.level) return null;
  return (
    <div className="mt-2 rounded-lg border border-border p-2.5 text-[13px]" title={`Tính trên ${s.total} đơn ứng tuyển trong 180 ngày qua`}>
      <div className="font-bold text-ink">Độ phản hồi hồ sơ</div>
      <div className={`font-extrabold text-[15px] ${TONE[s.level]}`}>
        {s.responseRate}% đơn được xem/xử lý
      </div>
      <div className="text-ink-muted text-[12.5px]">
        {s.medianLabel ? `Thường xem sau ~${s.medianLabel}` : 'Chưa đủ dữ liệu thời gian'} · {s.interviewRate}% được mời phỏng vấn ({s.total} đơn)
      </div>
    </div>
  );
}
