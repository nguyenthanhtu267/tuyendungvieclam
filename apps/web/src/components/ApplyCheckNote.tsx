'use client';

import Link from '@/components/SmartLink';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { smartApi4 } from '@/lib/api';
import { formatDate } from '@/lib/format';

// Đợt 75 — cảnh báo nhẹ (không chặn) khi đã nộp tin gần giống của cùng công ty trong 30 ngày.
export default function ApplyCheckNote({ jobId }: { jobId: string }) {
  const { me, token } = useAuth();
  const [items, setItems] = useState<{ jobId: string; title: string; appliedAt: string }[]>([]);
  useEffect(() => {
    if (!token || me?.role !== 'candidate') return;
    smartApi4.applyCheck(token, jobId).then((r) => setItems(r.similar)).catch(() => setItems([]));
  }, [token, me?.role, jobId]);
  if (!items.length) return null;
  const f = items[0];
  return (
    <div className="mb-3 rounded-lg border border-warning bg-warning-tint p-3 text-[13px]" role="note">
      <b className="text-[#7A4A00]">Bạn đã nộp vị trí gần giống công ty này.</b>{' '}
      <span className="text-ink">
        Ngày {formatDate(f.appliedAt)} bạn đã nộp <Link href={`/viec-lam/${f.jobId}`} className="font-bold text-primary underline">“{f.title}”</Link>. Nộp nhiều vị trí giống nhau có thể khiến hồ sơ bị xem là gửi tràn lan — bạn vẫn có thể nộp nếu đúng nguyện vọng.
      </span>
    </div>
  );
}
