'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from '@/components/SmartLink';
import { useSearchParams } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { jobsApi, type JobPosting } from '@/lib/api';
import { formatDate, formatSalary } from '@/lib/format';
import { useMatches } from '@/lib/match';
import { useCompare } from '@/lib/compare';
import { toItems } from '@/lib/job-insights';
import { distanceLabel, useHomePlace } from '@/lib/geo';
import { AdSlot } from '@/components/ads/AdSlot';

// Đợt 46 — So sánh 2–3 tin cạnh nhau.
function ComparePage() {
  const sp = useSearchParams();
  const ids = (sp.get('ids') ?? '').split(',').filter(Boolean).slice(0, 3);
  const [jobs, setJobs] = useState<(JobPosting | null)[] | null>(null);
  const matches = useMatches(ids);
  const { remove } = useCompare();
  const home = useHomePlace();

  useEffect(() => {
    Promise.all(ids.map((id) => jobsApi.get(id).then((r) => r.job).catch(() => null))).then(setJobs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const list = (jobs ?? []).filter(Boolean) as JobPosting[];
  const salaryMid = (j: JobPosting) => ((j.salaryMin ?? j.salaryMax ?? 0) + (j.salaryMax ?? j.salaryMin ?? 0)) / 2;
  const best = list.length ? Math.max(...list.map(salaryMid)) : 0;

  const rows: { label: string; render: (j: JobPosting) => React.ReactNode }[] = [
    { label: 'Công ty', render: (j) => <span className="co-name">{j.company?.name}</span> },
    {
      label: 'Lương',
      render: (j) => (
        <span className={salaryMid(j) === best && best > 0 ? 'font-bold text-success' : ''}>{formatSalary(j.salaryMin, j.salaryMax)}</span>
      ),
    },
    { label: 'Địa điểm', render: (j) => (j.provinces?.length ? j.provinces.join(' | ') : j.location) ?? '—' },
    ...(home ? [{ label: 'Khoảng cách', render: (j: JobPosting) => distanceLabel(home, j.provinces ?? []) ?? '—' }] : []),
    { label: 'Cấp bậc', render: (j) => j.level ?? '—' },
    { label: 'Kinh nghiệm', render: (j) => j.experienceLevel ?? '—' },
    { label: 'Hình thức', render: (j) => j.employmentType ?? '—' },
    { label: 'Giờ làm việc', render: (j) => j.workSchedule ?? '—' },
    {
      label: 'Quyền lợi',
      render: (j) => (
        <ul className="list-disc pl-4">
          {toItems(j.benefits).slice(0, 6).map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ),
    },
    { label: 'Hạn nộp', render: (j) => (j.deadline ? formatDate(j.deadline) : '—') },
  ];
  if (Object.values(matches).some(Boolean))
    rows.unshift({ label: 'Phù hợp với bạn', render: (j) => (matches[j.id] ? `${matches[j.id]!.score}%` : '—') });

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="max-w-6xl mx-3 sm:mx-auto my-3 px-4 sm:px-6 py-5 rounded-2xl border border-border bg-white">
        <h1 className="font-extrabold text-2xl text-ink mb-3">So sánh việc làm</h1>
        {jobs === null ? (
          <div className="text-ink-muted">Đang tải…</div>
        ) : list.length < 2 ? (
          <div className="text-ink-muted text-[15px]">
            Cần ít nhất 2 tin để so sánh. Bấm “⇄ So sánh” trên thẻ việc làm ở <Link href="/viec-lam" className="underline font-semibold">trang Việc làm</Link>.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full text-[14px] text-ink min-w-[640px]">
              <thead>
                <tr className="align-top">
                  <th className="w-36 p-3" />
                  {list.map((j) => (
                    <th key={j.id} className="p-3 text-left font-extrabold text-[15px]">
                      <Link href={`/viec-lam/${j.id}`} className="hover:text-primary">{j.title}</Link>
                      <div className="mt-1 flex gap-3 font-normal text-[13px]">
                        <Link href={`/viec-lam/${j.id}`} className="text-primary underline">Xem & ứng tuyển</Link>
                        <button onClick={() => remove(j.id)} className="text-ink-faint underline">Bỏ</button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-border align-top">
                    <td className="p-3 font-semibold text-ink-muted">{r.label}</td>
                    {list.map((j) => (
                      <td key={j.id} className="p-3">{r.render(j)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-6"><AdSlot slot="tools-bottom" className="mt-2" /></div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ComparePage />
    </Suspense>
  );
}
