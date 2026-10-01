'use client';

import Link from '@/components/SmartLink';
import { useEffect, useState } from 'react';
import { smartApi7, type BudgetItem, type FunnelJob } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

// Đợt 87 — (8) phễu tuyển dụng từng tin + (10) ngân sách gói còn lại / sắp hết hạn.
export default function EmployerFunnelPanel() {
  const { token } = useAuth();
  const [funnel, setFunnel] = useState<FunnelJob[] | null>(null);
  const [budget, setBudget] = useState<{ items: BudgetItem[]; avgApplicationsPerJob: number | null } | null>(null);
  useEffect(() => {
    if (!token) return;
    smartApi7.funnel(token).then((r) => setFunnel(r.items)).catch(() => setFunnel([]));
    smartApi7.budget(token).then(setBudget).catch(() => setBudget(null));
  }, [token]);
  const jobs = (funnel ?? []).filter((j) => j.steps[0].n + j.steps[1].n > 0);
  const warns = (budget?.items ?? []).filter((b) => b.warns.length > 0);
  if (!jobs.length && !(budget?.items ?? []).length) return null;
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      {jobs.length > 0 && (
        <section className="rounded-xl border border-border bg-white p-4">
          <h2 className="font-bold text-[15px] mb-0.5">Phễu tuyển dụng (30 ngày)</h2>
          <p className="text-[12.5px] text-ink-muted mb-2">Xem → Nộp → Bạn đã xem → Phù hợp → Phỏng vấn. Bước rớt nhiều nhất được đánh dấu.</p>
          <ul className="flex flex-col gap-3">
            {jobs.slice(0, 5).map((j) => {
              const top = Math.max(1, ...j.steps.map((s) => s.n));
              return (
                <li key={j.id}>
                  <Link href={`/nha-tuyen-dung/ung-vien?jobId=${j.id}`} className="font-bold text-[13.5px] text-primary hover:underline">{j.title}</Link>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {j.steps.map((s) => (
                      <div key={s.key} className="flex items-center gap-2 text-[12.5px] text-ink">
                        <span className="w-24 shrink-0">{s.label}</span>
                        <div className="flex-1 h-3 rounded bg-surface-alt overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.max(s.n ? 3 : 0, (s.n / top) * 100)}%` }} /></div>
                        <span className="w-8 text-right font-bold">{s.n}</span>
                      </div>
                    ))}
                  </div>
                  {j.worst && (
                    <div className="mt-1 rounded-lg border border-warning bg-white px-2 py-1 text-[12.5px] text-ink">
                      <b>Rớt {j.worst.lostPct}% từ “{j.worst.from}” sang “{j.worst.to}”.</b> {j.worst.advice}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {(budget?.items ?? []).length > 0 && (
        <section className="rounded-xl border border-border bg-white p-4">
          <h2 className="font-bold text-[15px] mb-0.5">Ngân sách gói dịch vụ</h2>
          {budget?.avgApplicationsPerJob != null && <p className="text-[12.5px] text-ink-muted mb-2">Trung bình mỗi tin của bạn nhận ~{budget.avgApplicationsPerJob} hồ sơ (90 ngày).</p>}
          <ul className="flex flex-col gap-2">
            {budget!.items.map((b) => (
              <li key={b.id} className="rounded-lg border border-border px-3 py-2 text-[13.5px] text-ink">
                <div className="font-bold">{b.name}</div>
                <div>Còn <b>{b.remaining}/{b.quantity}</b> lượt{b.daysLeft != null && <> · hết hạn sau <b>{Math.max(0, b.daysLeft)}</b> ngày</>}</div>
                {b.estApplications != null && b.remaining > 0 && <div className="text-ink-muted text-[12.5px]">Dùng hết lượt còn lại có thể nhận ~{b.estApplications} hồ sơ.</div>}
                {b.warns.map((w) => <div key={w} className="text-critical font-bold text-[12.5px]">{w}</div>)}
              </li>
            ))}
          </ul>
          <BudgetSim items={budget!.items} avg={budget!.avgApplicationsPerJob} />
          {warns.length > 0 && <Link href="/nha-tuyen-dung/don-hang" className="inline-block mt-2 rounded-lg bg-primary text-white font-bold text-[13px] px-3 py-1.5">Mua / gia hạn gói</Link>}
        </section>
      )}
    </div>
  );
}

// Đợt 89 — mô phỏng: "nếu mua thêm N lượt thì ước tính nhận thêm bao nhiêu hồ sơ". Tỉ lệ lấy từ chính lịch sử của nhà tuyển dụng.
function BudgetSim({ items, avg }: { items: BudgetItem[]; avg: number | null }) {
  const [extra, setExtra] = useState(5);
  const withRate = items.find((b) => b.remaining > 0 && b.estApplications != null);
  const rate = withRate ? (withRate.estApplications as number) / withRate.remaining : avg;
  if (rate == null || rate <= 0) return null;
  const est = Math.round(extra * rate);
  return (
    <div className="mt-3 rounded-lg bg-surface-alt border border-border p-2.5 text-[13px]">
      <label htmlFor="budget-extra" className="font-bold">Thử tính: nếu mua thêm</label>{' '}
      <input
        id="budget-extra"
        type="number"
        min={1}
        max={500}
        value={extra}
        onChange={(e) => setExtra(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
        className="tvl-input !w-20 inline-block mx-1"
      />{' '}
      lượt → ước tính thêm khoảng <b>{est} hồ sơ</b> <span className="text-ink-faint">(dựa trên mức nhận hồ sơ trước đây của bạn, chỉ mang tính tham khảo)</span>.
    </div>
  );
}
