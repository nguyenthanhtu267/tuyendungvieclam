'use client';

import Link from '@/components/SmartLink';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { smartApi3, type JobInsights } from '@/lib/api';
import { getJobInsights } from '@/lib/insights-cache';

const CHANCE = {
  high: { label: 'Cơ hội cao', cls: 'text-success' },
  medium: { label: 'Cơ hội trung bình', cls: 'text-warning' },
  low: { label: 'Cơ hội thấp', cls: 'text-critical' },
} as const;

// Đợt 63 — ứng viên xem trang tin: dự báo cơ hội, lương thương lượng, việc cần bổ sung, lộ trình nghề nghiệp.
export default function JobInsightsPanel({ jobId }: { jobId: string }) {
  const { me, token } = useAuth();
  const [data, setData] = useState<JobInsights | null>(null);
  const [open, setOpen] = useState(false);
  const [certs, setCerts] = useState<{ name: string; jobs: number; percent: number }[]>([]);
  useEffect(() => {
    if (!token || me?.role !== 'candidate') return;
    getJobInsights(token, jobId).then(setData);
    smartApi3.certificates(token, jobId).then((r) => setCerts(r.items)).catch(() => setCerts([]));
  }, [token, me?.role, jobId]);
  if (!data || !data.hasProfile || !data.chance) return null;
  const c = CHANCE[data.chance.level];
  return (
    <div className="rounded-xl border border-border bg-white p-4 flex flex-col gap-3">
      {/* Mặc định thu gọn (giống "Chuẩn bị phỏng vấn"); dòng tiêu đề vẫn cho thấy % cơ hội. */}
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left" aria-expanded={open}>
        <span className="text-[13px] font-extrabold text-primary uppercase tracking-wide">
          Trợ lý ứng tuyển
          {!open && <span className={`ml-2 normal-case tabular-nums ${c.cls}`}>{data.chance.percent}% · {c.label}</span>}
        </span>
        <span className="text-primary font-bold">{open ? '−' : '+'}</span>
      </button>
      {open && <>
      <div>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-extrabold tabular-nums ${c.cls}`}>{data.chance.percent}%</span>
          <span className={`text-[14px] font-bold ${c.cls}`}>{c.label}</span>
        </div>
        <ul className="mt-1 text-[13px] text-ink-muted list-disc pl-4">
          {data.chance.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <div className="text-[11.5px] text-ink-faint mt-1">Ước tính từ độ phù hợp và số hồ sơ đã nộp, chỉ mang tính tham khảo.</div>
      </div>

      {data.tips && data.tips.length > 0 && (
        <div>
          <div className="text-[13px] font-bold text-ink mb-1">Cách cải thiện hồ sơ cho tin này</div>
          <ul className="text-[13px] text-ink-muted list-disc pl-4 flex flex-col gap-0.5">
            {data.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <Link href="/ho-so" className="inline-block mt-1 text-[13px] font-bold text-primary">
            Cập nhật hồ sơ →
          </Link>
        </div>
      )}

      {data.salary && (
        <div>
          <div className="text-[13px] font-bold text-ink mb-1">Lương thương lượng</div>
          <div className="flex items-center gap-2 text-[12.5px] tabular-nums">
            <span className="text-ink-faint">{data.salary.p25}</span>
            <div className="relative flex-1 h-2 rounded-full bg-primary-tint">
              <div className="absolute inset-y-0 rounded-full bg-primary/30" style={{ left: '12%', right: '12%' }} />
              <div className="absolute -top-0.5 w-1 h-3 rounded bg-primary" style={{ left: '50%' }} title={`Trung vị ${data.salary.median}`} />
            </div>
            <span className="text-ink-faint">{data.salary.p75} tr</span>
          </div>
          <div className="text-[13px] text-ink-muted mt-1">{data.salary.advice}</div>
        </div>
      )}

      {certs.length > 0 && (
        <div>
          <div className="text-[13px] font-bold text-ink mb-1">Chứng chỉ nên có</div>
          <ul className="text-[13px] text-ink-muted list-disc pl-4">
            {certs.map((c) => (
              <li key={c.name}>
                <b className="text-ink">{c.name}</b> — {c.percent}% tin cùng ngành nhắc tới ({c.jobs} tin)
              </li>
            ))}
          </ul>
          <div className="text-[11.5px] text-ink-faint mt-0.5">Bạn chưa ghi các chứng chỉ này trong hồ sơ. Nếu đã có, hãy thêm vào mục Chứng chỉ.</div>
        </div>
      )}

      {data.career && (
        <div>
          <div className="text-[13px] font-bold text-ink mb-1">Lộ trình nghề nghiệp</div>
          <div className="text-[13px] text-ink-muted">
            {data.career.current ? `${data.career.current} → ` : ''}
            <b className="text-ink">{data.career.next}</b> ({data.career.industry})
            {data.career.nextMedianSalary ? ` · lương phổ biến ~${data.career.nextMedianSalary} triệu` : ''}
            {data.career.openings ? ` · ${data.career.openings} tin đang tuyển` : ''}.
          </div>
          {data.career.skillsToLearn.length > 0 && (
            <div className="text-[13px] text-ink-muted mt-0.5">
              Nên học thêm: <b className="text-ink">{data.career.skillsToLearn.join(', ')}</b>
            </div>
          )}
          {data.career.openings > 0 && (
            <Link href={`/viec-lam?${data.career.searchQuery}`} className="inline-block mt-1 text-[13px] font-bold text-primary">
              Xem việc cấp {data.career.next} →
            </Link>
          )}
        </div>
      )}
      </>}
    </div>
  );
}
