'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { workersApi, type WorkerKind } from '@/lib/api';
import { PERKS_BY_KIND, PERK_LABEL, fmtM } from '@/lib/labor';
import { AddressPicker, type AddressValue } from './AddressPicker';
import { ScheduleGrid } from './ScheduleGrid';

export interface LaborFieldsValue {
  workPlace: AddressValue;
  perks: string[];
  payBase: string;
  payOt: string;
  payNight: string;
  payAllowance: string;
  schedule: string[];
}
const num = (v: string) => Number(v.replace(',', '.')) || 0;

/** Ước tính thực nhận (giống API labor-groups.estimateIncome). */
export function previewIncome(v: LaborFieldsValue) {
  const base = num(v.payBase);
  if (!(base > 0)) return null;
  const hourly = base / 208;
  const gross = base + hourly * 1.5 * num(v.payOt) + hourly * 0.3 * num(v.payNight) + num(v.payAllowance);
  return { gross: Math.round(gross * 10) / 10, net: Math.round((gross - base * 0.105) * 10) / 10 };
}

// Đợt 80 — phần riêng của tin lao động phổ thông trong form đăng tin: nơi làm việc chi tiết, quyền lợi,
// thu nhập ước tính + lương gợi ý theo thị trường, ca cần người (sinh viên).
export function LaborJobFields({
  kind,
  group,
  value,
  onChange,
  salaryMin,
  salaryMax,
}: {
  kind: WorkerKind;
  group: string;
  value: LaborFieldsValue;
  onChange: (v: LaborFieldsValue) => void;
  salaryMin: string;
  salaryMax: string;
}) {
  const [provinces, setProvinces] = useState<string[]>([]);
  const [stats, setStats] = useState<{ scope: string | null; count: number; p25: number | null; median: number | null; p75: number | null } | null>(null);
  const set = (p: Partial<LaborFieldsValue>) => onChange({ ...value, ...p });
  useEffect(() => {
    workersApi.catalog().then((c) => setProvinces(c.provinces)).catch(() => undefined);
  }, []);
  useEffect(() => {
    workersApi.salaryStats(kind, group || undefined, value.workPlace.province || undefined).then(setStats).catch(() => setStats(null));
  }, [kind, group, value.workPlace.province]);

  const inc = previewIncome(value);
  const mine = num(salaryMax) || num(salaryMin) ? (num(salaryMin || salaryMax) + num(salaryMax || salaryMin)) / 2 : num(value.payBase);
  let verdict: string | null = null;
  if (stats?.median && mine > 0) {
    if (stats.p25 != null && mine < stats.p25) verdict = `Mức bạn nhập (~${fmtM(mine)}) thấp hơn khoảng 75% tin cùng loại — nên tăng để dễ tuyển.`;
    else if (mine < stats.median) verdict = `Mức bạn nhập (~${fmtM(mine)}) thấp hơn mức giữa thị trường (${fmtM(stats.median)}).`;
    else if (stats.p75 != null && mine > stats.p75) verdict = `Mức bạn nhập (~${fmtM(mine)}) cao hơn 75% tin cùng loại — lợi thế tuyển nhanh.`;
    else verdict = `Mức bạn nhập (~${fmtM(mine)}) ngang mặt bằng thị trường.`;
  }
  const lbl = 'flex flex-col gap-1 text-[13px] font-semibold text-ink';
  return (
    <div className="rounded-xl border-2 border-warning bg-white p-3 flex flex-col gap-3">
      <div className="font-extrabold text-[14px] text-ink">Thông tin riêng cho tin tuyển {kind === 'worker' ? 'công nhân' : kind === 'student' ? 'sinh viên' : 'thực tập sinh'}</div>
      <div>
        <div className="text-[13px] font-semibold text-ink mb-1">Nơi làm việc (để ứng viên ở gần thấy tin trước)</div>
        <AddressPicker value={value.workPlace} onChange={(a) => set({ workPlace: a })} provinces={provinces} idPrefix="jw-wp" requireWard={false} />
      </div>
      <div>
        <div className="text-[13px] font-semibold text-ink mb-1">Quyền lợi đặc thù</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {PERKS_BY_KIND[kind].map((p) => (
            <label key={p} className="flex items-center gap-1.5 text-[13.5px] text-ink" htmlFor={`jw-perk-${p}`}>
              <input id={`jw-perk-${p}`} type="checkbox" className="w-4 h-4" checked={value.perks.includes(p)} onChange={(e) => set({ perks: e.target.checked ? [...value.perks, p] : value.perks.filter((x) => x !== p) })} />
              {PERK_LABEL[p]}
            </label>
          ))}
        </div>
        {value.perks.includes('intern_cert') && (
          <Link href="/nha-tuyen-dung/phieu-nhan-xet-thuc-tap" target="_blank" className="text-[12.5px] font-bold text-primary underline">Xem mẫu phiếu nhận xét thực tập in sẵn</Link>
        )}
      </div>
      {kind === 'worker' && (
        <div>
          <div className="text-[13px] font-semibold text-ink mb-1">Ước tính thu nhập để ứng viên thấy (không bắt buộc)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className={lbl} htmlFor="jw-pay-base">Lương cơ bản (triệu/tháng)<input id="jw-pay-base" inputMode="decimal" className="tvl-input" value={value.payBase} onChange={(e) => set({ payBase: e.target.value })} placeholder="vd 6,5" /></label>
            <label className={lbl} htmlFor="jw-pay-ot">Giờ tăng ca / tháng<input id="jw-pay-ot" inputMode="numeric" className="tvl-input" value={value.payOt} onChange={(e) => set({ payOt: e.target.value })} placeholder="vd 40" /></label>
            <label className={lbl} htmlFor="jw-pay-night">Giờ làm đêm / tháng<input id="jw-pay-night" inputMode="numeric" className="tvl-input" value={value.payNight} onChange={(e) => set({ payNight: e.target.value })} placeholder="vd 52" /></label>
            <label className={lbl} htmlFor="jw-pay-al">Phụ cấp (triệu/tháng)<input id="jw-pay-al" inputMode="decimal" className="tvl-input" value={value.payAllowance} onChange={(e) => set({ payAllowance: e.target.value })} placeholder="vd 0,8" /></label>
          </div>
          {inc && <div className="text-[13.5px] text-ink mt-1">Ứng viên sẽ thấy: tổng ~<b>{fmtM(inc.gross)}</b>, thực nhận ~<b className="text-success">{fmtM(inc.net)}/tháng</b> (tăng ca 150%, làm đêm +30%, trừ bảo hiểm 10,5% lương cơ bản).</div>}
        </div>
      )}
      {kind === 'student' && (
        <div>
          <div className="text-[13px] font-semibold text-ink mb-1">Ca cần người (để gợi ý sinh viên có lịch rảnh phù hợp)</div>
          <ScheduleGrid value={value.schedule} onChange={(v) => set({ schedule: v })} idPrefix="jw-sched" />
        </div>
      )}
      <div className="rounded-lg bg-surface-alt px-2.5 py-2 text-[13px] text-ink">
        <b>Lương thị trường</b>
        {stats?.median ? (
          <> ({stats.scope}, {stats.count} tin): thấp {fmtM(stats.p25!)} · giữa {fmtM(stats.median)} · cao {fmtM(stats.p75!)}.{verdict && <div className="font-bold mt-0.5">{verdict}</div>}</>
        ) : (
          <>: chưa đủ dữ liệu tin cùng loại để so sánh.</>
        )}
      </div>
    </div>
  );
}
