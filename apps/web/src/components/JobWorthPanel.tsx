'use client';

import { useEffect, useState } from 'react';
import { smartApi7, type WorthScore } from '@/lib/api';
import { grossToNet } from '@/lib/salary-calc';
import { regionOfProvince } from '@/lib/region';

const tone = { good: 'text-success border-success', fair: 'text-ink border-warning', poor: 'text-critical border-critical' } as const;
const fmt = (v: number) => (v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 });

// Đợt 87 — "Tin này có đáng ứng tuyển?" (điểm tổng hợp có giải thích) + lương thực nhận ước tính từ khung lương gross.
export default function JobWorthPanel({ jobId, salaryMin, salaryMax, province }: { jobId: string; salaryMin?: number | null; salaryMax?: number | null; province?: string | null }) {
  const [w, setW] = useState<WorthScore | null>(null);
  const [dep, setDep] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    smartApi7.worth(jobId).then(setW).catch(() => setW(null));
    try {
      setDep(Number(localStorage.getItem('tvl_dependents') ?? 0) || 0);
    } catch { /* bỏ qua */ }
  }, [jobId]);
  const region = regionOfProvince(province);
  const lo = salaryMin ? grossToNet({ gross: salaryMin * 1e6, dependents: dep, region }) : null;
  const hi = salaryMax ? grossToNet({ gross: salaryMax * 1e6, dependents: dep, region }) : null;
  if (!w && !lo && !hi) return null;
  return (
    <div className="rounded-xl border border-border bg-white p-4 flex flex-col gap-2.5">
      {w && w.parts.length > 0 && (
        <div>
          <div className="text-[11px] font-bold text-primary uppercase tracking-wide mb-1.5">Tin này có đáng ứng tuyển?</div>
          <div className="flex items-center gap-3">
            <div className={`shrink-0 w-14 h-14 rounded-full border-4 flex items-center justify-center font-extrabold text-[18px] bg-white ${tone[w.level]}`}>{w.score}</div>
            <div>
              <div className={`font-extrabold text-[15px] ${w.level === 'good' ? 'text-success' : w.level === 'poor' ? 'text-critical' : 'text-ink'}`}>{w.label}</div>
              <button type="button" onClick={() => setOpen(!open)} className="text-[12.5px] font-bold text-primary underline">{open ? 'Ẩn chi tiết' : 'Vì sao điểm này?'}</button>
            </div>
          </div>
          {open && (
            <ul className="mt-2 flex flex-col gap-1.5 text-[12.5px] text-ink">
              {w.parts.map((p) => (
                <li key={p.key}>
                  <div className="flex justify-between font-bold"><span>{p.label}</span><span>{p.score}/100</span></div>
                  <div className="h-1.5 rounded-full bg-surface-alt overflow-hidden"><div className={`h-full ${p.score >= 65 ? 'bg-success' : p.score >= 45 ? 'bg-warning' : 'bg-critical'}`} style={{ width: `${p.score}%` }} /></div>
                  <div className="text-ink-muted">{p.note}</div>
                </li>
              ))}
              <li className="text-[11.5px] text-ink-muted">Điểm tính bằng quy tắc từ dữ liệu của web, chỉ để tham khảo.</li>
            </ul>
          )}
        </div>
      )}
      {(lo || hi) && (
        <div className={w ? 'border-t border-border pt-2.5' : ''}>
          <div className="text-[11px] font-bold text-primary uppercase tracking-wide mb-1">Lương thực nhận ước tính</div>
          <div className="font-extrabold text-[16px] text-success">
            {lo && hi && lo.net !== hi.net ? `${fmt(lo.net)} – ${fmt(hi.net)} triệu/tháng` : `${fmt((hi ?? lo)!.net)} triệu/tháng`}
          </div>
          <div className="text-[12px] text-ink-muted">
            Nếu khung lương trên là lương gộp (gross): đã trừ BHXH-BHYT-BHTN 10,5% và thuế TNCN (giảm trừ 15,5 triệu bản thân).
          </div>
          <label className="flex items-center gap-2 mt-1 text-[12.5px] text-ink" htmlFor="jw-dep">
            Người phụ thuộc
            <select
              id="jw-dep"
              className="rounded border border-border-strong bg-white px-1.5 py-0.5"
              value={dep}
              onChange={(e) => {
                const v = Number(e.target.value);
                setDep(v);
                try { localStorage.setItem('tvl_dependents', String(v)); } catch { /* bỏ qua */ }
              }}
            >
              {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
