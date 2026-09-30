'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getJobInsights } from '@/lib/insights-cache';
import type { JobInsights } from '@/lib/api';

// Đợt 65 — lúc bấm nộp: nếu lương tin thấp hơn mặt bằng cùng ngành/cấp bậc thì nhắc (không chặn nộp).
export default function SalaryNudge({ jobId }: { jobId: string }) {
  const { token, me } = useAuth();
  const [s, setS] = useState<JobInsights['salary']>(null);
  useEffect(() => {
    if (!token || me?.role !== 'candidate') return;
    getJobInsights(token, jobId).then((r) => setS(r?.salary ?? null));
  }, [token, me?.role, jobId]);
  if (!s || s.offer == null || s.offer >= s.p25) return null;
  return (
    <div className="mb-3 rounded-lg border border-warning bg-warning-tint p-3 text-[13px]" role="note">
      <b className="text-[#7A4A00]">Lương tin này thấp hơn mặt bằng.</b>{' '}
      <span className="text-ink">
        Tin trả khoảng {s.offer.toFixed(1)} triệu, trong khi {s.scope} phổ biến {s.p25}–{s.p75} triệu (trung vị {s.median}). Bạn vẫn có thể nộp và thương lượng khi phỏng vấn.
      </span>
    </div>
  );
}
