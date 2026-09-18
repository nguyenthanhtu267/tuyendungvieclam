import Link from 'next/link';
import type { JobPosting } from '@/lib/api';
import { companyInitials, formatDate, formatSalary } from '@/lib/format';

export function JobCard({ job }: { job: JobPosting }) {
  return (
    <Link
      href={`/viec-lam/${job.id}`}
      className="flex gap-3 rounded-xl border border-border bg-white p-4 hover:border-primary hover:shadow-sm transition-all"
    >
      <div className="w-11 h-11 shrink-0 rounded-lg bg-primary-tint text-primary flex items-center justify-center font-bold text-xs">
        {companyInitials(job.company.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[13.5px] text-ink truncate">{job.title}</div>
        <div className="text-xs text-ink-muted mt-0.5 truncate">{job.company.name}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11.5px] text-ink-faint">
          <span>💰 {formatSalary(job.salaryMin, job.salaryMax)}</span>
          {job.location && <span>📍 {job.location}</span>}
          {job.deadline && <span>🕒 Hạn nộp {formatDate(job.deadline)}</span>}
        </div>
        {job.benefits && job.benefits.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {job.benefits.slice(0, 3).map((b) => (
              <span
                key={b}
                className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface-alt text-ink-muted"
              >
                {b}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
