'use client';

import Link from '@/components/SmartLink';
import { useEffect, useMemo, useState } from 'react';
import { smartApi3, type AppEta } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
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

function ymd(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
// Đợt 75 — thêm lịch phỏng vấn vào Google Calendar / tải file .ics (Apple, Outlook).
function CalendarButtons({ a }: { a: Application }) {
  const start = new Date(a.interviewAt as string);
  const end = new Date(start.getTime() + 60 * 60000);
  const title = `Phỏng vấn: ${a.jobPosting.title} - ${a.jobPosting.company.name}`;
  const loc = a.interviewPlace ?? '';
  const details = a.interviewNote ?? '';
  const g = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${ymd(start)}/${ymd(end)}&location=${encodeURIComponent(loc)}&details=${encodeURIComponent(details)}`;
  function ics() {
    const esc = (t: string) => t.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tuyen Dung Viec Lam//VI', 'BEGIN:VEVENT', `UID:${a.id}@tuyendungvieclam`, `DTSTAMP:${ymd(new Date())}`, `DTSTART:${ymd(start)}`, `DTEND:${ymd(end)}`, `SUMMARY:${esc(title)}`, `LOCATION:${esc(loc)}`, `DESCRIPTION:${esc(details)}`, 'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Sắp đến giờ phỏng vấn', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
    const el = document.createElement('a');
    el.href = url;
    el.download = 'phong-van.ics';
    el.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="flex flex-wrap gap-1 text-[11.5px] font-bold">
      <a href={g} target="_blank" rel="noopener noreferrer" className="rounded border border-primary text-primary px-1.5 py-0.5 hover:bg-primary-tint">📅 Google Lịch</a>
      <button type="button" onClick={ics} className="rounded border border-border text-ink px-1.5 py-0.5 hover:border-primary">Tải .ics</button>
    </div>
  );
}

export default function ApplicationTracker({ applications }: { applications: Application[] }) {
  const { token } = useAuth();
  const [eta, setEta] = useState<AppEta | null>(null);
  useEffect(() => {
    if (token) smartApi3.eta(token).then(setEta).catch(() => {});
  }, [token]);
  const cols = useMemo(() => COLS.map((c) => ({ ...c, items: applications.filter(c.pick) })), [applications]);
  const waits = applications.filter((a) => a.status === 'new').map((a) => Math.floor((Date.now() - new Date(a.appliedAt).getTime()) / DAY));
  return (
    <div className="flex flex-col gap-2">
      {waits.length > 0 && (
        <div className="text-[12.5px] text-ink-muted">
          {waits.length} đơn đang chờ phản hồi, lâu nhất <b className="text-ink">{Math.max(...waits)} ngày</b>. Sau 7 ngày bạn sẽ nhận nhắc kèm gợi ý việc tương tự.
        </div>
      )}
      {eta?.enough && (
        <div className="rounded-lg bg-surface-alt border border-border p-2.5 text-[12.5px] text-ink">
          Theo {eta.sample} đơn đã có kết quả trên hệ thống: khoảng <b>{eta.interviewRate ?? 0}%</b> đơn được mời phỏng vấn
          {eta.medianDays != null ? <>, thường sau <b>{eta.medianDays} ngày</b></> : null}.
          {eta.pending ? <> Bạn đang chờ {eta.pending} đơn, dự kiến ~<b>{eta.expectedInterviews}</b> lời mời.</> : null}
          {eta.applicationsForOne ? <> Trung bình cần nộp khoảng <b>{eta.applicationsForOne} đơn</b> để có 1 lời mời.</> : null}
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
                  <div key={a.id} className="flex flex-col gap-1">
                  <Link key={a.id} href={`/viec-lam/${a.jobPostingId}`} className="rounded-md bg-white border border-border p-2 hover:border-primary block">
                    <div className="font-bold text-[12.5px] leading-tight line-clamp-2">{a.jobPosting.title}</div>
                    <div className="co-name text-[11.5px] truncate">{a.jobPosting.company.name}</div>
                    <div className="text-[11.5px] text-ink-muted mt-0.5">
                      Nộp {formatDate(a.appliedAt)}
                      {a.status === 'new' ? ` · chờ ${days} ngày` : ''}
                      {a.interviewAt ? ` · PV ${formatDate(a.interviewAt)}` : ''}
                    </div>
                  </Link>
                    {a.interviewAt && new Date(a.interviewAt).getTime() > Date.now() && <CalendarButtons a={a} />}
                    {a.status === 'new' && !a.viewedAt && days >= 7 && (
                      <div className="rounded border border-warning bg-warning-tint text-[11.5px] text-[#7A4A00] px-1.5 py-1">
                        Sau {days} ngày nhà tuyển dụng chưa xem. Đừng chờ một nơi —{' '}
                        <Link href={`/viec-lam?q=${encodeURIComponent(a.jobPosting.title)}`} className="font-bold underline">nộp thêm tin tương tự</Link>.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
