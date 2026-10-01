'use client';

import { useMemo, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import { grossToNet } from '@/lib/salary-calc';

interface Offer { name: string; gross: string; allowance: string; bonusMonths: string; km: string; leave: string }
const blank = (n: string): Offer => ({ name: n, gross: '', allowance: '0', bonusMonths: '0', km: '0', leave: '12' });
const vnd = (n: number) => Math.round(n).toLocaleString('vi-VN');
const COST_PER_KM = 1500; // xăng + hao mòn xe máy, ước lượng 1.500 đ/km

// Đợt 78 — so sánh 2–3 lời mời làm việc: thực nhận hằng tháng và cả năm sau thuế, bảo hiểm, chi phí đi lại.
export default function CompareOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([
    { name: 'Offer A', gross: '20', allowance: '1', bonusMonths: '1', km: '5', leave: '12' },
    { name: 'Offer B', gross: '23', allowance: '0', bonusMonths: '0', km: '15', leave: '12' },
  ]);
  const [dependents, setDependents] = useState(0);
  const [region, setRegion] = useState<1 | 2 | 3 | 4>(1);

  const rows = useMemo(
    () =>
      offers.map((o) => {
        const gross = (Number(o.gross.replace(',', '.')) || 0) * 1_000_000;
        const r = grossToNet({ gross, dependents, region });
        const allowance = (Number(o.allowance.replace(',', '.')) || 0) * 1_000_000;
        const commute = (Number(o.km.replace(',', '.')) || 0) * 2 * 22 * COST_PER_KM;
        const monthly = r.net + allowance - commute;
        const bonus = (Number(o.bonusMonths.replace(',', '.')) || 0) * r.net;
        const yearly = monthly * 12 + bonus;
        return { net: r.net, allowance, commute, monthly, yearly, valid: gross > 0 };
      }),
    [offers, dependents, region],
  );
  const best = rows.reduce((b, r, i) => (r.valid && (b < 0 || r.yearly > rows[b].yearly) ? i : b), -1);
  const set = (i: number, k: keyof Offer, v: string) => setOffers((p) => p.map((o, j) => (j === i ? { ...o, [k]: v } : o)));

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="max-w-5xl mx-3 sm:mx-auto my-3 px-4 sm:px-6 py-5 flex flex-col gap-4 rounded-2xl border border-border bg-white">
        <div>
          <h1 className="font-extrabold text-2xl text-ink">So sánh lời mời làm việc</h1>
          <p className="text-[15px] text-ink-muted mt-1">Nhập 2–3 offer để xem khoản nào thật sự cao hơn sau thuế, bảo hiểm và chi phí đi lại (ước tính {vnd(COST_PER_KM)} đ/km, đi về 22 ngày/tháng).</p>
        </div>
        <div className="flex flex-wrap gap-4 text-[14px]">
          <label className="flex items-center gap-2">Người phụ thuộc
            <input id="offer-dep" type="number" min={0} max={10} value={dependents} onChange={(e) => setDependents(Math.max(0, Number(e.target.value) || 0))} className="w-16 rounded border border-border px-2 py-1" />
          </label>
          <label className="flex items-center gap-2">Vùng lương tối thiểu
            <select id="offer-region" value={region} onChange={(e) => setRegion(Number(e.target.value) as 1 | 2 | 3 | 4)} className="rounded border border-border px-2 py-1">
              {[1, 2, 3, 4].map((r) => (<option key={r} value={r}>Vùng {r}</option>))}
            </select>
          </label>
          {offers.length < 3 && <button type="button" onClick={() => setOffers((p) => [...p, blank(`Offer ${String.fromCharCode(65 + p.length)}`)])} className="font-bold text-primary">+ Thêm offer</button>}
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {offers.map((o, i) => {
            const r = rows[i];
            return (
              <section key={i} className={`rounded-xl border p-4 flex flex-col gap-2 ${best === i ? 'border-success bg-success-tint' : 'border-border bg-white'}`}>
                <div className="flex items-center justify-between gap-2">
                  <input aria-label="Tên offer" value={o.name} onChange={(e) => set(i, 'name', e.target.value)} className="font-extrabold text-[16px] bg-transparent w-full" />
                  {best === i && <span className="text-[12px] font-bold text-success whitespace-nowrap">Cao nhất</span>}
                </div>
                {([['gross', 'Lương gross (triệu/tháng)'], ['allowance', 'Phụ cấp không chịu thuế (triệu/tháng)'], ['bonusMonths', 'Số tháng thưởng/năm (tháng 13…)'], ['km', 'Quãng đường đi làm một chiều (km)']] as const).map(([k, label]) => (
                  <label key={k} className="flex flex-col gap-0.5 text-[13px] text-ink-muted">{label}
                    <input inputMode="decimal" value={o[k]} onChange={(e) => set(i, k, e.target.value)} className="rounded border border-border bg-white px-2 py-1.5 text-[15px] text-ink" />
                  </label>
                ))}
                {r.valid && (
                  <dl className="mt-1 text-[14px] flex flex-col gap-0.5 tabular-nums">
                    <div className="flex justify-between"><dt className="text-ink-muted">Lương net</dt><dd>{vnd(r.net)} đ</dd></div>
                    <div className="flex justify-between"><dt className="text-ink-muted">+ Phụ cấp</dt><dd>{vnd(r.allowance)} đ</dd></div>
                    <div className="flex justify-between"><dt className="text-ink-muted">− Đi lại</dt><dd>{vnd(r.commute)} đ</dd></div>
                    <div className="flex justify-between font-extrabold text-ink border-t border-border pt-1"><dt>Thực nhận/tháng</dt><dd>{vnd(r.monthly)} đ</dd></div>
                    <div className="flex justify-between font-extrabold text-primary"><dt>Cả năm (có thưởng)</dt><dd>{vnd(r.yearly)} đ</dd></div>
                  </dl>
                )}
              </section>
            );
          })}
        </div>
        {best >= 0 && rows.filter((r) => r.valid).length >= 2 && (
          <div className="rounded-lg bg-surface-alt border border-border p-3 text-[14px] text-ink">
            <b>{offers[best].name}</b> có thu nhập thực cả năm cao nhất, hơn offer thấp nhất khoảng <b>{vnd(rows[best].yearly - Math.min(...rows.filter((r) => r.valid).map((r) => r.yearly)))} đ/năm</b>. Kết quả chỉ tính tiền; hãy cân nhắc thêm lộ trình thăng tiến, môi trường và bảo hiểm sức khỏe.
          </div>
        )}
      </div>
    </main>
  );
}
