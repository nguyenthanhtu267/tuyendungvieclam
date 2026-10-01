'use client';

import { useEffect, useState } from 'react';
import { readRecentJobs } from '@/lib/recent-jobs';

// Đợt 103 — thẻ nhỏ "Tuần này của bạn": số tin đã xem / đã lưu / đã nộp trong 7 ngày + lời nhắc nhẹ giữ nhịp. Dữ liệu có sẵn ở trang Hồ sơ
// (đơn nộp, tin đã lưu) cộng "tin vừa xem" lưu ở máy — không gọi API thêm.
const WEEK = 7 * 86400000;
export default function WeeklyStats({ applied, saved }: { applied: string[]; saved: string[] }) {
  const [viewed, setViewed] = useState(0);
  useEffect(() => setViewed(readRecentJobs().filter((j) => Date.now() - j.at < WEEK).length), []);
  const since = Date.now() - WEEK;
  const a = applied.filter((d) => new Date(d).getTime() >= since).length;
  const s = saved.filter((d) => new Date(d).getTime() >= since).length;
  const hint = a === 0 ? 'Tuần này bạn chưa nộp đơn nào — thử nộp 2–3 tin phù hợp nhé.' : a < 3 ? 'Nộp thêm 1–2 đơn nữa để tăng cơ hội được liên hệ.' : 'Nhịp tìm việc rất tốt, nhớ trả lời nhà tuyển dụng sớm.';
  const cell = 'flex-1 rounded-lg bg-surface-alt py-2 text-center';
  return (
    <div className="rounded-xl border border-border bg-white p-3 mb-3" aria-label="Tuần này của bạn">
      <div className="font-extrabold text-[13.5px] mb-2">📈 Tuần này của bạn</div>
      <div className="flex gap-2">
        <div className={cell}><div className="text-[20px] font-extrabold text-primary leading-none">{viewed}</div><div className="text-[11.5px] text-ink-muted mt-1">đã xem</div></div>
        <div className={cell}><div className="text-[20px] font-extrabold text-primary leading-none">{s}</div><div className="text-[11.5px] text-ink-muted mt-1">đã lưu</div></div>
        <div className={cell}><div className="text-[20px] font-extrabold text-accent leading-none">{a}</div><div className="text-[11.5px] text-ink-muted mt-1">đã nộp</div></div>
      </div>
      <div className="text-[12px] text-ink-muted mt-2">{hint}</div>
    </div>
  );
}
