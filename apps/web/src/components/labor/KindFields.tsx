'use client';

import type { ProfileExtra, WorkerKind } from '@/lib/api';
import { CERT_LABEL, EXPERIENCE_LABEL, HOURS_LABEL, INTERN_SLOTS, MONTHS_OPTIONS, SHIFTS_BY_KIND, slotText } from '@/lib/labor';
import { ScheduleGrid } from './ScheduleGrid';

const lbl = 'flex flex-col gap-1 text-[14px] font-bold text-ink';
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-[13.5px] font-bold ${on ? 'bg-primary border-primary text-white' : 'bg-white border-border-strong text-ink'}`;

export interface KindFieldsValue {
  kind: WorkerKind;
  shifts: string[];
  availability: string[];
  school: string;
  major: string;
  extra: ProfileExtra;
}

/** Đợt 84 — phần riêng từng nhóm: công nhân / sinh viên / thực tập sinh có câu hỏi khác nhau, đúng thực tế. */
export function KindFields({ v, onChange }: { v: KindFieldsValue; onChange: (p: Partial<KindFieldsValue>) => void }) {
  const x = v.extra;
  const setX = (p: Partial<ProfileExtra>) => onChange({ extra: { ...x, ...p } });
  const toggleIn = (arr: string[] | undefined, k: string) => ((arr ?? []).includes(k) ? (arr ?? []).filter((y) => y !== k) : [...(arr ?? []), k]);
  const shifts = SHIFTS_BY_KIND[v.kind];

  const ready = (
    <div className={lbl}>
      Khi nào bạn đi làm được?
      <div className="flex flex-wrap items-center gap-1.5 font-normal">
        <button type="button" className={chip(x.ready === 'now')} onClick={() => setX({ ready: x.ready === 'now' ? undefined : 'now' })}>Đi làm được ngay</button>
        <span className="text-[13px] text-ink-muted">hoặc từ ngày</span>
        <input id="wk-ready" type="date" className="tvl-input !w-auto" value={x.ready && x.ready !== 'now' ? x.ready : ''} onChange={(e) => setX({ ready: e.target.value || undefined })} />
      </div>
    </div>
  );

  const schoolBlock = (
    <div className="grid sm:grid-cols-3 gap-3">
      <label className={lbl} htmlFor="wk-school">
        Trường đang học (không bắt buộc)
        <input id="wk-school" className="tvl-input font-normal" value={v.school} onChange={(e) => onChange({ school: e.target.value })} />
      </label>
      <label className={lbl} htmlFor="wk-major">
        Ngành học (không bắt buộc)
        <input id="wk-major" className="tvl-input font-normal" value={v.major} onChange={(e) => onChange({ major: e.target.value })} />
      </label>
      <label className={lbl} htmlFor="wk-year">
        Đang học năm mấy
        <select id="wk-year" className="tvl-input font-normal" value={x.year ?? ''} onChange={(e) => setX({ year: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">— Chọn —</option>
          {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Năm {y}</option>)}
        </select>
      </label>
    </div>
  );

  if (v.kind === 'worker') {
    return (
      <>
        {ready}
        <div className={lbl}>
          Kinh nghiệm làm việc
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(EXPERIENCE_LABEL).map(([k, l]) => <button key={k} type="button" className={chip(x.experience === k)} onClick={() => setX({ experience: x.experience === k ? undefined : k })}>{l}</button>)}
          </div>
        </div>
        <div className={lbl}>
          Ca làm có thể đi <span className="font-normal text-[12.5px] text-ink-muted">(không bắt buộc)</span>
          <div className="flex flex-wrap gap-1.5">
            {shifts.map((s) => <button key={s} type="button" className={chip(v.shifts.includes(s))} onClick={() => onChange({ shifts: toggleIn(v.shifts, s) })}>{s}</button>)}
          </div>
        </div>
        <div className={lbl}>
          Giấy tờ & chứng chỉ
          <div className="flex flex-wrap gap-x-5 gap-y-2 font-normal text-[14px]">
            <label className="flex items-center gap-2" htmlFor="wk-bike"><input id="wk-bike" type="checkbox" className="w-4 h-4" checked={!!x.hasBike} onChange={(e) => setX({ hasBike: e.target.checked })} />Có xe máy</label>
            <label className="flex items-center gap-2" htmlFor="wk-health"><input id="wk-health" type="checkbox" className="w-4 h-4" checked={!!x.hasHealth} onChange={(e) => setX({ hasHealth: e.target.checked })} />Có giấy khám sức khoẻ</label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(CERT_LABEL).map(([k, l]) => <button key={k} type="button" className={chip((x.certs ?? []).includes(k))} onClick={() => setX({ certs: toggleIn(x.certs, k) })}>{l}</button>)}
          </div>
        </div>
      </>
    );
  }

  if (v.kind === 'student') {
    return (
      <>
        {ready}
        <div className={lbl}>
          Bạn làm được bao nhiêu giờ mỗi tuần?
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(HOURS_LABEL).map(([k, l]) => <button key={k} type="button" className={chip(x.hours === k)} onClick={() => setX({ hours: x.hours === k ? undefined : (k as ProfileExtra['hours']) })}>{l}</button>)}
          </div>
        </div>
        <div className={lbl}>
          Hình thức làm <span className="font-normal text-[12.5px] text-ink-muted">(không bắt buộc)</span>
          <div className="flex flex-wrap gap-1.5">
            {shifts.map((s) => <button key={s} type="button" className={chip(v.shifts.includes(s))} onClick={() => onChange({ shifts: toggleIn(v.shifts, s) })}>{s}</button>)}
          </div>
        </div>
        <div className={lbl}>
          Lịch rảnh trong tuần <span className="font-normal text-[12.5px] text-ink-muted">(bỏ trống buổi có tiết học — để gợi ý việc hợp lịch)</span>
          <ScheduleGrid value={v.availability} onChange={(a) => onChange({ availability: a })} idPrefix="wk-avail" />
          {v.availability.length > 0 && <span className="font-normal text-[12.5px] text-ink-muted">{slotText(v.availability)}</span>}
        </div>
        <label className="flex items-center gap-2 text-[14px] text-ink" htmlFor="wk-bike2"><input id="wk-bike2" type="checkbox" className="w-4 h-4" checked={!!x.hasBike} onChange={(e) => setX({ hasBike: e.target.checked })} />Có xe máy (cần cho việc giao hàng, đi lại)</label>
        {schoolBlock}
      </>
    );
  }

  // intern
  return (
    <>
      <div className={lbl}>
        Thời gian thực tập bạn muốn
        <div className="flex flex-wrap items-center gap-1.5 font-normal">
          {MONTHS_OPTIONS.map((m) => <button key={m} type="button" className={chip(x.months === m)} onClick={() => setX({ months: x.months === m ? undefined : m })}>{m} tháng</button>)}
          <label htmlFor="wk-sessions" className="text-[13.5px] text-ink ml-2">Số buổi/tuần</label>
          <select id="wk-sessions" className="tvl-input !w-auto" value={x.sessions ?? ''} onChange={(e) => setX({ sessions: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">—</option>
            {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} buổi</option>)}
          </select>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className={lbl} htmlFor="wk-start">
          Ngày có thể bắt đầu
          <input id="wk-start" type="date" className="tvl-input font-normal" value={x.startDate ?? ''} onChange={(e) => setX({ startDate: e.target.value || undefined })} />
        </label>
        <div className={lbl}>
          Hình thức thực tập
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={chip(x.mandatory === 'school')} onClick={() => setX({ mandatory: x.mandatory === 'school' ? undefined : 'school' })}>Bắt buộc theo trường (cần xác nhận)</button>
            <button type="button" className={chip(x.mandatory === 'free')} onClick={() => setX({ mandatory: x.mandatory === 'free' ? undefined : 'free' })}>Tự tìm, không bắt buộc</button>
          </div>
        </div>
      </div>
      <div className={lbl}>
        Lịch rảnh trong tuần <span className="font-normal text-[12.5px] text-ink-muted">(thực tập theo giờ hành chính: T2–T6 sáng/chiều, T7 sáng)</span>
        <ScheduleGrid value={v.availability.filter((s) => INTERN_SLOTS.includes(s))} onChange={(a) => onChange({ availability: a })} idPrefix="wk-avail" allowed={INTERN_SLOTS} />
        {v.availability.length > 0 && <span className="font-normal text-[12.5px] text-ink-muted">{slotText(v.availability)}</span>}
      </div>
      {schoolBlock}
    </>
  );
}
