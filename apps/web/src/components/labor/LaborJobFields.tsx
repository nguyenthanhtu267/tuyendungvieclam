'use client';

import Link from '@/components/SmartLink';
import { useEffect, useState } from 'react';
import { workersApi, type JobExtra, type WorkerKind } from '@/lib/api';
import { CERT_LABEL, EXPERIENCE_LABEL, INTERN_SLOTS, MONTHS_OPTIONS, PERKS_BY_KIND, PERK_LABEL, fmtM } from '@/lib/labor';
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
  extra: JobExtra;
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
  const [minW, setMinW] = useState<{ region: number; month: number; hour: number; known: boolean } | null>(null);
  const set = (p: Partial<LaborFieldsValue>) => onChange({ ...value, ...p });
  const x = value.extra ?? {};
  const setX = (p: Partial<JobExtra>) => set({ extra: { ...x, ...p } });
  const numOr = (v: string) => (v === '' ? undefined : Number(v.replace(',', '.')));
  const hourBelow = kind === 'student' && minW && x.hourlyPay && x.hourlyPay < minW.hour;
  const monthEst = x.hourlyPay && x.hours ? Math.round((x.hourlyPay * x.hours * 52) / 12 / 1000) * 1000 : null;
  const toggleCert = (c: string) => setX({ certs: (x.certs ?? []).includes(c) ? (x.certs ?? []).filter((y) => y !== c) : [...(x.certs ?? []), c] });
  useEffect(() => {
    workersApi.catalog().then((c) => setProvinces(c.provinces)).catch(() => undefined);
  }, []);
  useEffect(() => {
    workersApi.salaryStats(kind, group || undefined, value.workPlace.province || undefined).then(setStats).catch(() => setStats(null));
  }, [kind, group, value.workPlace.province]);

  useEffect(() => {
    if (!value.workPlace.province) return setMinW(null);
    workersApi.minWage(value.workPlace.province).then(setMinW).catch(() => setMinW(null));
  }, [value.workPlace.province]);
  const baseVnd = num(value.payBase) * 1e6;
  const belowMin = kind === 'worker' && minW && baseVnd > 0 && baseVnd < minW.month;
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
          {minW && (
            <div className={`text-[13px] mt-1 rounded-lg border px-2 py-1 ${belowMin ? 'border-critical bg-critical-tint text-critical font-bold' : 'border-border bg-white text-ink'}`}>
              {belowMin
                ? <>Lương cơ bản thấp hơn lương tối thiểu vùng {minW.region} ({(minW.month / 1e6).toLocaleString('vi-VN')} triệu/tháng từ 01/2026). Trả thấp hơn là vi phạm pháp luật — tin có thể bị hệ thống cảnh báo/từ chối duyệt.</>
                : <>Lương tối thiểu vùng {minW.region} (ước tính theo tỉnh): {(minW.month / 1e6).toLocaleString('vi-VN')} triệu/tháng từ 01/2026 (Nghị định 293/2025/NĐ-CP). Vùng chính xác tính theo phường/xã nơi làm việc.</>}
            </div>
          )}
          {inc && <div className="text-[13.5px] text-ink mt-1">Ứng viên sẽ thấy: tổng ~<b>{fmtM(inc.gross)}</b>, thực nhận ~<b className="text-success">{fmtM(inc.net)}/tháng</b> (tăng ca 150%, làm đêm +30%, trừ bảo hiểm 10,5% lương cơ bản).</div>}
        </div>
      )}
      {kind === 'worker' && (
        <div className="flex flex-col gap-2">
          <div className="text-[13px] font-semibold text-ink">Yêu cầu ứng viên (để chỉ người phù hợp gọi đến — không bắt buộc)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className={lbl} htmlFor="jw-age-min">Tuổi từ<input id="jw-age-min" inputMode="numeric" className="tvl-input" value={x.ageMin ?? ''} onChange={(e) => setX({ ageMin: numOr(e.target.value) })} placeholder="vd 18" /></label>
            <label className={lbl} htmlFor="jw-age-max">Đến tuổi<input id="jw-age-max" inputMode="numeric" className="tvl-input" value={x.ageMax ?? ''} onChange={(e) => setX({ ageMax: numOr(e.target.value) })} placeholder="vd 45" /></label>
            <label className={`${lbl} col-span-2`} htmlFor="jw-docs">Giấy tờ cần có<input id="jw-docs" className="tvl-input" value={x.docs ?? ''} onChange={(e) => setX({ docs: e.target.value || undefined })} placeholder="vd CCCD, sơ yếu lý lịch" /></label>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-ink">
            <label className="flex items-center gap-1.5" htmlFor="jw-health"><input id="jw-health" type="checkbox" className="w-4 h-4" checked={!!x.health} onChange={(e) => setX({ health: e.target.checked || undefined })} />Cần giấy khám sức khoẻ</label>
            <label className="flex items-center gap-1.5" htmlFor="jw-bike"><input id="jw-bike" type="checkbox" className="w-4 h-4" checked={!!x.bike} onChange={(e) => setX({ bike: e.target.checked || undefined })} />Cần có xe máy</label>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13.5px] text-ink">
            {Object.entries(CERT_LABEL).map(([k, l]) => (
              <label key={k} className="flex items-center gap-1.5" htmlFor={`jw-cert-${k}`}><input id={`jw-cert-${k}`} type="checkbox" className="w-4 h-4" checked={(x.certs ?? []).includes(k)} onChange={() => toggleCert(k)} />{l}</label>
            ))}
          </div>
          <label className={lbl} htmlFor="jw-exp">Kinh nghiệm tối thiểu
            <select id="jw-exp" className="tvl-input" value={x.experience ?? 'none'} onChange={(e) => setX({ experience: e.target.value === 'none' ? undefined : e.target.value })}>
              {Object.entries(EXPERIENCE_LABEL).map(([k, l]) => <option key={k} value={k}>{k === 'none' ? 'Không yêu cầu' : l}</option>)}
            </select>
          </label>
        </div>
      )}
      {kind === 'student' && (
        <div className="flex flex-col gap-2">
          <div className="text-[13px] font-semibold text-ink">Lương theo giờ & số giờ</div>
          <div className="grid grid-cols-2 gap-2">
            <label className={lbl} htmlFor="jw-hourly">Lương theo giờ (đồng/giờ)<input id="jw-hourly" inputMode="numeric" className="tvl-input" value={x.hourlyPay ?? ''} onChange={(e) => setX({ hourlyPay: numOr(e.target.value) })} placeholder="vd 25000" /></label>
            <label className={lbl} htmlFor="jw-hours">Số giờ / tuần<input id="jw-hours" inputMode="numeric" className="tvl-input" value={x.hours ?? ''} onChange={(e) => setX({ hours: numOr(e.target.value) })} placeholder="vd 15" /></label>
          </div>
          {minW && (
            <div className={`text-[13px] rounded-lg border px-2 py-1 ${hourBelow ? 'border-critical bg-critical-tint text-critical font-bold' : 'border-border bg-white text-ink'}`}>
              {hourBelow
                ? <>Lương theo giờ thấp hơn mức tối thiểu giờ vùng {minW.region} ({minW.hour.toLocaleString('vi-VN')} đồng/giờ từ 01/2026). Trả thấp hơn là vi phạm pháp luật — tin có thể bị cảnh báo/từ chối duyệt.</>
                : <>Lương tối thiểu giờ vùng {minW.region} (ước tính theo tỉnh): {minW.hour.toLocaleString('vi-VN')} đồng/giờ từ 01/2026.</>}
            </div>
          )}
          {monthEst && <div className="text-[13.5px] text-ink">Sinh viên sẽ thấy: ~<b className="text-success">{(monthEst / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} triệu/tháng</b> nếu làm đủ số giờ.</div>}
          <div className="text-[13px] font-semibold text-ink">Ca cần người (để gợi ý sinh viên có lịch rảnh phù hợp)</div>
          <ScheduleGrid value={value.schedule} onChange={(v) => set({ schedule: v })} idPrefix="jw-sched" />
        </div>
      )}
      {kind === 'intern' && (
        <div className="flex flex-col gap-2">
          <div className="text-[13px] font-semibold text-ink">Thông tin thực tập</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className={lbl} htmlFor="jw-months">Thời gian thực tập
              <select id="jw-months" className="tvl-input" value={x.months ?? ''} onChange={(e) => setX({ months: numOr(e.target.value) })}>
                <option value="">— Chọn —</option>
                {MONTHS_OPTIONS.map((m) => <option key={m} value={m}>{m} tháng</option>)}
              </select>
            </label>
            <label className={lbl} htmlFor="jw-allow">Trợ cấp (triệu/tháng)<input id="jw-allow" inputMode="decimal" className="tvl-input" value={x.allowance ?? ''} onChange={(e) => setX({ allowance: numOr(e.target.value) })} placeholder="0 nếu không" /></label>
            <label className={lbl} htmlFor="jw-sess">Số buổi / tuần
              <select id="jw-sess" className="tvl-input" value={x.sessions ?? ''} onChange={(e) => setX({ sessions: numOr(e.target.value) })}>
                <option value="">— Chọn —</option>
                {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} buổi</option>)}
              </select>
            </label>
            <label className={lbl} htmlFor="jw-year">Từ năm học
              <select id="jw-year" className="tvl-input" value={x.year ?? ''} onChange={(e) => setX({ year: numOr(e.target.value) })}>
                <option value="">Không yêu cầu</option>
                {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Năm {y} trở lên</option>)}
              </select>
            </label>
          </div>
          <label className={lbl} htmlFor="jw-majors">Ngành học ưu tiên<input id="jw-majors" className="tvl-input" value={x.majors ?? ''} onChange={(e) => setX({ majors: e.target.value || undefined })} placeholder="vd Kế toán, Tài chính" /></label>
          <div className="text-[13px] font-semibold text-ink">Buổi cần thực tập (giờ hành chính, không có buổi tối)</div>
          <ScheduleGrid value={value.schedule.filter((x2) => INTERN_SLOTS.includes(x2))} onChange={(v) => set({ schedule: v })} idPrefix="jw-sched" allowed={INTERN_SLOTS} />
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
