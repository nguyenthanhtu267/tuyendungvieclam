import { scoreJobQuality } from '@/lib/job-insights';
import type { JobWizardFormState } from './JobWizardForm';

// Đợt 46 — chấm điểm chất lượng tin khi đăng + gợi ý sửa (bước "Xem trước & gửi").
export default function JobQualityPanel({ form }: { form: JobWizardFormState }) {
  const r = scoreJobQuality({
    title: form.title,
    description: form.description,
    requirements: form.requirements,
    benefits: form.benefits,
    experienceLevel: form.experienceLevel,
    level: form.level,
    salaryMin: form.negotiable ? null : Number(form.salaryMin) || null,
    salaryMax: form.negotiable ? null : Number(form.salaryMax) || null,
    tags: form.tags,
    contactEmail: form.contactEmail,
    contactPhone: form.contactPhone,
  });
  const tone = r.score >= 80 ? 'text-success bg-success-tint' : r.score >= 55 ? 'text-warning bg-warning-tint' : 'text-critical bg-critical-tint';
  const missing = r.checks.filter((c) => !c.ok);
  return (
    <section className="rounded-lg border border-border p-3 flex gap-3 items-start">
      <div className={`shrink-0 w-16 h-16 rounded-full flex flex-col items-center justify-center font-extrabold ${tone}`}>
        <span className="text-xl leading-none">{r.score}</span>
        <span className="text-[10px] font-semibold">/100</span>
      </div>
      <div className="min-w-0 text-[13px]">
        <div className="font-extrabold text-[14px] text-ink">Chất lượng tin</div>
        {missing.length === 0 ? (
          <div className="text-success font-semibold">Tin đầy đủ — sẵn sàng thu hút ứng viên.</div>
        ) : (
          <ul className="mt-0.5 flex flex-col gap-0.5">
            {missing.map((c) => (
              <li key={c.label} className="text-ink-muted">
                <span className="text-critical font-semibold">✗ {c.label}</span> — {c.tip}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
