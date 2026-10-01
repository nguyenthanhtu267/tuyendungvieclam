'use client';

import Link from '@/components/SmartLink';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { applicationsApi, candidatesApi, type Application, type SavedJob } from '@/lib/api';
import { readRecentJobs, type RecentJob } from '@/lib/recent-jobs';
import { formatDate } from '@/lib/format';

const DAY = 86400000;

// Đợt 64 — trang chủ cá nhân hoá: "Tiếp tục nơi bạn dừng lại" (chỉ hiện cho ứng viên đã đăng nhập và có việc để nhắc).
export default function ContinueBlock() {
  const { me, token } = useAuth();
  const [recent, setRecent] = useState<RecentJob[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [saved, setSaved] = useState<SavedJob[]>([]);
  useEffect(() => {
    setRecent(readRecentJobs().slice(0, 2));
    if (!token || me?.role !== 'candidate') return;
    applicationsApi.listOwn(token).then(setApps).catch(() => setApps([]));
    candidatesApi.listSavedJobs(token).then(setSaved).catch(() => setSaved([]));
  }, [token, me?.role]);
  if (me?.role !== 'candidate') return null;

  const appliedIds = new Set(apps.map((a) => a.jobPostingId));
  const waiting = apps.filter((a) => a.status === 'new');
  const oldest = waiting.length ? Math.max(...waiting.map((a) => Math.floor((Date.now() - new Date(a.appliedAt).getTime()) / DAY))) : 0;
  const interviews = apps
    .filter((a) => a.interviewAt && new Date(a.interviewAt).getTime() > Date.now())
    .sort((a, b) => new Date(a.interviewAt!).getTime() - new Date(b.interviewAt!).getTime());
  const needChoose = apps.filter((a) => a.status === 'interview' && !a.interviewAt && a.interviewSlots?.length);
  const closing = saved.filter((s) => {
    const d = s.jobPosting.deadline;
    if (!d || appliedIds.has(s.jobPostingId)) return false;
    const left = (new Date(d).getTime() - Date.now()) / DAY;
    return left >= -1 && left <= 3;
  });
  const notApplied = recent.filter((r) => !appliedIds.has(r.id));

  const items: { key: string; tone: 'hot' | 'normal'; node: React.ReactNode }[] = [];
  if (needChoose.length)
    items.push({ key: 'choose', tone: 'hot', node: <Link href="/ho-so#applications" className="font-bold">Có {needChoose.length} lời mời phỏng vấn đang chờ bạn chọn giờ →</Link> });
  if (interviews.length)
    items.push({ key: 'iv', tone: 'hot', node: <Link href="/ho-so#applications">Phỏng vấn sắp tới: <b>{interviews[0].jobPosting.title}</b> lúc {formatDate(interviews[0].interviewAt!)} →</Link> });
  if (closing.length)
    items.push({ key: 'close', tone: 'hot', node: <Link href="/ho-so#applications"><b>{closing.length} tin đã lưu</b> sắp hết hạn nộp (“{closing[0].jobPosting.title}”…) →</Link> });
  notApplied.forEach((r) => items.push({ key: `r${r.id}`, tone: 'normal', node: <Link href={`/viec-lam/${r.id}`}>Bạn đang xem dở: <b>{r.title}</b> – {r.company} →</Link> }));
  if (waiting.length)
    items.push({ key: 'wait', tone: 'normal', node: <Link href="/ho-so#applications">{waiting.length} đơn đang chờ phản hồi{oldest ? ` (lâu nhất ${oldest} ngày)` : ''} →</Link> });
  if (!items.length) return null;
  return (
    <section className="mt-4 rounded-xl border border-border bg-white p-4" aria-label="Tiếp tục nơi bạn dừng lại">
      <h2 className="font-extrabold text-[15px] mb-2">Tiếp tục nơi bạn dừng lại</h2>
      <ul className="flex flex-col gap-1.5">
        {items.slice(0, 5).map((it) => (
          <li key={it.key} className={`text-[13.5px] ${it.tone === 'hot' ? 'text-ink font-semibold' : 'text-ink-muted'} [&_a:hover]:text-primary`}>
            {it.node}
          </li>
        ))}
      </ul>
    </section>
  );
}
