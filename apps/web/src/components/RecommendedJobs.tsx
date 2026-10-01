'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/SmartLink';
import { useAuth } from '@/lib/auth-context';
import { jobsApi, type JobPosting } from '@/lib/api';
import { JobCard } from '@/components/JobCard';

// Đợt 38 — "Việc gợi ý cho bạn": chỉ hiện với tài khoản ứng viên đã đăng nhập; chấm điểm bằng hồ sơ (ngành, địa điểm,
// lương, kinh nghiệm, kỹ năng…). Hồ sơ còn trống → nhắc hoàn thiện để nhận gợi ý chính xác hơn.
export function RecommendedJobs() {
  const { me, token } = useAuth();
  const [items, setItems] = useState<JobPosting[] | null>(null);
  const [hasProfile, setHasProfile] = useState(true);
  const isCand = !!token && me?.role === 'candidate';

  useEffect(() => {
    if (!isCand || !token) return;
    let alive = true;
    jobsApi
      .recommended(token, 6)
      .then((r) => {
        if (!alive) return;
        setHasProfile(r.hasProfile);
        setItems(r.items);
      })
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [isCand, token]);

  if (!isCand) return null;
  if (items === null) return null;
  if (items.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-border bg-white px-3 py-2 text-sm flex items-center justify-between gap-3">
        <span className="font-semibold">✨ Việc gợi ý cho bạn — {hasProfile ? 'chưa có tin đủ phù hợp, hãy bổ sung ngành, địa điểm, kỹ năng trong hồ sơ.' : 'hãy tạo hồ sơ để nhận gợi ý.'}</span>
        <Link href="/ho-so" className="text-primary font-bold shrink-0">Cập nhật hồ sơ →</Link>
      </div>
    );
  }
  return (
    <section className="mt-3" data-testid="recommended-jobs">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-extrabold text-lg">✨ Việc gợi ý cho bạn</h2>
        <Link href="/ho-so" className="text-primary text-xs font-bold">Chỉnh hồ sơ để gợi ý chuẩn hơn →</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
      </div>
    </section>
  );
}
