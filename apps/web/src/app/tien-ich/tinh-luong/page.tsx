'use client';

import { useEffect, useMemo, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import { jobsApi, type SalaryStats } from '@/lib/api';
import { grossToNet, netToGross, REGION_MIN_WAGE, PERSONAL_DEDUCTION, DEPENDENT_DEDUCTION } from '@/lib/salary-calc';
import { AdSlot } from '@/components/ads/AdSlot';

const vnd = (n: number) => Math.round(n).toLocaleString('vi-VN') + ' đ';
const trieu = (n: number | null | undefined) => (n == null ? '—' : `${(Math.round(n * 10) / 10).toLocaleString('vi-VN')} triệu`);

export default function TinhLuongPage() {
  const [mode, setMode] = useState<'g2n' | 'n2g'>('g2n');
  const [amount, setAmount] = useState('25000000');
  const [dependents, setDependents] = useState(0);
  const [region, setRegion] = useState<1 | 2 | 3 | 4>(1);
  const [industry, setIndustry] = useState('');
  const [province, setProvince] = useState('');
  const [stats, setStats] = useState<SalaryStats | null>(null);

  const value = Number(amount.replace(/\D/g, '')) || 0;
  const r = useMemo(
    () => (mode === 'g2n' ? grossToNet({ gross: value, dependents, region }) : netToGross(value, dependents, region)),
    [mode, value, dependents, region],
  );

  useEffect(() => {
    let alive = true;
    jobsApi.salaryStats(industry || undefined, province || undefined).then((s) => alive && setStats(s)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [industry, province]);

  const grossTrieu = r.gross / 1_000_000;
  const median = stats?.median ?? null;
  const diff = median ? Math.round(((grossTrieu - median) / median) * 100) : null;

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
        <div>
          <h1 className="font-extrabold text-2xl text-ink">Tính lương Gross ↔ Net 2026</h1>
          <p className="text-[15px] text-ink-muted mt-1">
            Áp dụng giảm trừ bản thân {vnd(PERSONAL_DEDUCTION)}, người phụ thuộc {vnd(DEPENDENT_DEDUCTION)}/người, biểu thuế 5 bậc và bảo hiểm 10,5%.
          </p>
        </div>

        <div className="grid md:grid-cols-[360px_1fr] gap-4 items-start">
          <section className="rounded-xl bg-white border border-border p-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-1 p-1 bg-surface-alt rounded-lg text-[15px] font-semibold">
              {(['g2n', 'n2g'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`py-1.5 rounded-md ${mode === m ? 'bg-white shadow text-ink' : 'text-ink-muted'}`}
                >
                  {m === 'g2n' ? 'Gross → Net' : 'Net → Gross'}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1 text-[15px] font-semibold text-ink" htmlFor="sl-amount">
              {mode === 'g2n' ? 'Lương Gross (đ/tháng)' : 'Lương Net mong muốn (đ/tháng)'}
              <input
                id="sl-amount"
                inputMode="numeric"
                className="tvl-input"
                value={value ? value.toLocaleString('vi-VN') : ''}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-[15px] font-semibold text-ink" htmlFor="sl-dep">
              Số người phụ thuộc
              <input
                id="sl-dep"
                type="number"
                min={0}
                max={10}
                className="tvl-input"
                value={dependents}
                onChange={(e) => setDependents(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
              />
            </label>
            <label className="flex flex-col gap-1 text-[15px] font-semibold text-ink" htmlFor="sl-region">
              Vùng (lương tối thiểu vùng, tính trần BHTN)
              <select id="sl-region" className="tvl-input" value={region} onChange={(e) => setRegion(Number(e.target.value) as 1 | 2 | 3 | 4)}>
                {([1, 2, 3, 4] as const).map((v) => (
                  <option key={v} value={v}>
                    Vùng {['I', 'II', 'III', 'IV'][v - 1]} — {REGION_MIN_WAGE[v].toLocaleString('vi-VN')} đ
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="flex flex-col gap-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-white border border-border p-4">
                <div className="text-[13px] font-bold text-ink-muted uppercase">Lương Gross</div>
                <div className="text-2xl font-extrabold text-ink">{vnd(r.gross)}</div>
              </div>
              <div className="rounded-xl bg-success-tint border border-border p-4">
                <div className="text-[13px] font-bold text-success uppercase">Lương Net (thực nhận)</div>
                <div className="text-2xl font-extrabold text-success">{vnd(r.net)}</div>
              </div>
            </div>

            <div className="rounded-xl bg-white border border-border p-4 text-[15px] text-ink">
              <table className="w-full">
                <tbody>
                  {[
                    ['BHXH (8%)', r.bhxh],
                    ['BHYT (1,5%)', r.bhyt],
                    ['BHTN (1%)', r.bhtn],
                    ['Thu nhập trước thuế', r.incomeBeforeTax],
                    ['Giảm trừ gia cảnh', r.deduction],
                    ['Thu nhập tính thuế', r.taxable],
                    ['Thuế TNCN', r.tax],
                    ['Tổng chi phí NSDLĐ (ước tính)', r.employerCost],
                  ].map(([k, v]) => (
                    <tr key={k as string} className="border-b border-border last:border-0">
                      <td className="py-1.5 text-ink-muted">{k}</td>
                      <td className="py-1.5 text-right font-semibold">{vnd(v as number)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.breakdown.length > 0 && (
                <div className="mt-3">
                  <div className="text-[13px] font-bold text-ink-muted uppercase mb-1">Chi tiết theo bậc thuế</div>
                  {r.breakdown.map((b, i) => (
                    <div key={i} className="flex justify-between py-0.5">
                      <span>
                        Bậc {i + 1} · {Math.round(b.rate * 100)}% · {vnd(b.amount)}
                      </span>
                      <span className="font-semibold">{vnd(b.tax)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-white border border-border p-4 text-[15px]">
              <div className="font-extrabold text-ink mb-2">So với mức lương trên web (tin đang tuyển)</div>
              <div className="grid sm:grid-cols-2 gap-2 mb-3">
                <select aria-label="Ngành nghề" className="tvl-input" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                  <option value="">Tất cả ngành nghề</option>
                  {(stats?.industries ?? []).map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
                <select aria-label="Tỉnh thành" className="tvl-input" value={province} onChange={(e) => setProvince(e.target.value)}>
                  <option value="">Tất cả tỉnh thành</option>
                  {(stats?.provinces ?? []).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              {stats && stats.count >= 3 ? (
                <>
                  <div className="text-ink-muted">
                    Dựa trên {stats.count} tin có ghi lương: phổ biến {trieu(stats.p25)} – {trieu(stats.p75)}, trung vị {trieu(stats.median)}.
                  </div>
                  {diff != null && (
                    <div className={`mt-1 font-bold ${diff >= 0 ? 'text-success' : 'text-danger'}`}>
                      Lương Gross của bạn {diff >= 0 ? 'cao hơn' : 'thấp hơn'} trung vị {Math.abs(diff)}%.
                    </div>
                  )}
                </>
              ) : (
                <div className="text-ink-muted">Chưa đủ tin có ghi lương cho lựa chọn này (cần ít nhất 3 tin) để so sánh.</div>
              )}
            </div>
            <p className="text-[13px] text-ink-faint">Kết quả mang tính tham khảo; số thực tế phụ thuộc hợp đồng và quyết toán thuế.</p>
          </section>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-6"><AdSlot slot="tools-bottom" className="mt-2" /></div>
    </main>
  );
}
