'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { Application } from '@/lib/api';
import { formatDate } from '@/lib/format';

const DAY = 86400000;
// Đợt 64 — bảng theo dõi đơn ứng tuyển dạng cột: Đã nộp → NTD đã xem → Phù hợp/Phỏng vấn → Kết quả.
const COLS: { id: string; label: string; hint: string; pick: (a: Application) => boolean }[] = [
  { id: 'sent', label: 'Đã nộp', hint: 'Chưa được xem', pick: (a) => a.status === 'new' && !a.viewedAt },
  { id: 'seen', label: 'NTD đã xem', hint: 'Đang xem xét', pick: (a) => (a.status === 'new' && !!a.viewedAt) || a.status === 'reviewing' },
  { id: 'good', label: 'Phù hợp / Phỏng vấn', hint: 'Tin tốt', pick: (a) => a.status === 'suitable' || a.status === 'interview' },
  { id: 'done', label: 'Kết quả', hint: 'Từ chối', pick: (a) => a.status === 'rejected' },
];

export default function ApplicationTracker({ applications }: { applications: Application[] }) {
  const cols = useMemo(() => COLS.map((c) => ({ ...c, items: applications.filter(c.pick) })), [applications]);
  const waits = applications.filter((a) => a.status === 'new').map((a) => Math.floor((Date.now() - new Date(a.appliedAt).getTime()) / DAY));
  return (
    <div className="flex flex-col gap-2">
      {waits.length > 0 && (
        <div className="text-[12.5px] text-ink-muted">
          {waits.length} đơn đang chờ phản hồi, lâu nhất <b className="text-ink">{Math.max(...waits)} ngày</b>. Sau 7 ngày bạn sẽ nhận nhắc kèm gợi ý việc tương tự.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {cols.map((c) => (
          <div key={c.id} className="rounded-lg bg-surface-alt border border-border p-2 min-w-0">
            <div className="flex items-baseline justify-between gap-1 mb-1.5">
              <span className="font-extrabold text-[13px]">{c.label}</span>
              <span className="text-[12px] font-bold tabular-nums text-ink-muted">{c.items.length}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {c.items.length === 0 && <div className="text-[12px] text-ink-faint py-2">{c.hint}: không có</div>}
              {c.items.map((a) => {
                const days = Math.floor((Date.now() - new Date(a.appliedAt).getTime()) / DAY);
                return (
                  <Link key={a.id} href={`/viec-lam/${a.jobPostingId}`} className="rounded-md bg-white border border-border p-2 hover:border-primary block">
                    <div className="font-bold text-[12.5px] leading-tight line-clamp-2">{a.jobPosting.title}</div>
                    <div className="co-name text-[11.5px] truncate">{a.jobPosting.company.name}</div>
                    <div className="text-[11.5px] text-ink-muted mt-0.5">
                      Nộp {formatDate(a.appliedAt)}
                      {a.status === 'new' ? ` · chờ ${days} ngày` : ''}
                      {a.interviewAt ? ` · PV ${formatDate(a.interviewAt)}` : ''}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
