'use client';

import { useEffect, useMemo, useState } from 'react';
import { jobsApi } from '@/lib/api';
import { summarizeJob, type JobLike } from '@/lib/job-insights';

// Đợt 46 — Tóm tắt tin 3 dòng + câu nên hỏi khi phỏng vấn (đặt đầu tab "Chi tiết").
export function JobSummaryBox({ job }: { job: JobLike }) {
  const s = useMemo(() => summarizeJob(job), [job]);
  const [open, setOpen] = useState(false);
  if (s.lines.length === 0) return null;
  return (
    <section className="rounded-xl bg-[#F0F3FA] border border-border px-4 py-3 mb-4 text-[13.5px] text-ink">
      <div className="font-extrabold text-[14px] mb-1.5">Tóm tắt nhanh</div>
      <ul className="flex flex-col gap-1">
        {s.lines.map((l) => (
          <li key={l.label}>
            <span className="font-semibold">{l.label}:</span> {l.text}
          </li>
        ))}
      </ul>
      {s.questions.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setOpen((v) => !v)} className="text-primary font-semibold hover:underline text-[13px]">
            {open ? '▾' : '▸'} Nên hỏi gì khi phỏng vấn? ({s.questions.length})
          </button>
          {open && (
            <ol className="list-decimal pl-5 mt-1 flex flex-col gap-0.5 text-ink-muted">
              {s.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

// Đợt 46 — Ước lượng lương cho tin ghi "Cạnh tranh"/"Thoả thuận" từ tin cùng ngành, tỉnh, cấp bậc.
export function useSalaryEstimate(job: { salaryMin?: number | null; salaryMax?: number | null; industry?: string | null; provinces?: string[] | null; level?: string | null } | null | undefined) {
  const [est, setEst] = useState<{ low: number; high: number; count: number; scope: string } | null>(null);
  const need = !!job && !job.salaryMin && !job.salaryMax;
  const industry = job?.industry ?? undefined;
  const province = job?.provinces?.[0];
  const level = job?.level ?? undefined;
  useEffect(() => {
    if (!need) return setEst(null);
    let alive = true;
    (async () => {
      const tries: [string | undefined, string | undefined, string][] = [
        [industry, province, `${industry ?? ''}${province ? ` tại ${province}` : ''}`],
        [industry, undefined, industry ?? ''],
      ];
      for (const [ind, prov, scope] of tries) {
        if (!ind) continue;
        const s = await jobsApi.salaryStats(ind, prov, level).catch(() => null);
        if (s && s.count >= 3 && s.p25 != null && s.p75 != null) {
          if (alive) setEst({ low: s.p25, high: s.p75, count: s.count, scope });
          return;
        }
      }
      if (alive) setEst(null);
    })();
    return () => {
      alive = false;
    };
  }, [need, industry, province, level]);
  return est;
}

export const fmtTrieu = (n: number) => (Math.round(n * 10) / 10).toLocaleString('vi-VN');
