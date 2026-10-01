'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { workersApi, type WorkerInput, type WorkerJobCard, type WorkerKind, type WorkerProfileView } from '@/lib/api';
import { GENDER_LABEL, KIND_LABEL, KIND_SELF, KIND_SLUG, LABOR_GROUPS, RADII, SHIFTS, ago, fmtDateTime, guessGroups, normalizePhone, placeText, slotText } from '@/lib/labor';
import { AddressPicker, EMPTY_ADDRESS, type AddressValue } from './AddressPicker';
import { DateSelect, isFullDate } from './DateSelect';
import { LaborJobList } from './LaborJobList';
import { rememberWorker, snapOf, snapParams } from './WorkerCreds';
import { ScheduleGrid } from './ScheduleGrid';
import { markWorker } from './RefreshReminder';

interface FormState {
  kind: WorkerKind;
  fullName: string;
  phone: string;
  relativePhone: string;
  gender: string;
  birthDate: string;
  address: AddressValue;
  addressDetail: string;
  radiusKm: number | null;
  lat: number | null;
  lon: number | null;
  desiredJobs: string[];
  shifts: string[];
  availability: string[];
  school: string;
  major: string;
  needsHousing: boolean;
  needsShuttle: boolean;
  isSeeking: boolean;
  consent: boolean;
}
const blank = (kind: WorkerKind): FormState => ({
  kind, fullName: '', phone: '', relativePhone: '', gender: '', birthDate: '', address: EMPTY_ADDRESS, addressDetail: '', radiusKm: null,
  lat: null, lon: null, desiredJobs: [], shifts: [], availability: [], school: '', major: '', needsHousing: false, needsShuttle: false, isSeeking: true, consent: false,
});
const fromProfile = (p: WorkerProfileView): FormState => ({
  kind: p.kind, fullName: p.fullName, phone: p.phone, relativePhone: p.relativePhone ?? '', gender: p.gender, birthDate: p.birthDate,
  address: { province: p.province, addressMode: p.addressMode, oldDistrict: p.oldDistrict ?? '', oldWard: p.oldWard ?? '', newWardCode: p.addressMode === 'new' ? p.newWardCode ?? '' : '', newWardName: p.addressMode === 'new' ? p.newWard ?? '' : '' },
  addressDetail: p.addressDetail ?? '', radiusKm: p.radiusKm, lat: p.lat, lon: p.lon, desiredJobs: p.desiredJobs, shifts: p.shifts, availability: p.availability ?? [], school: p.school ?? '',
  major: p.major ?? '', needsHousing: p.needsHousing, needsShuttle: p.needsShuttle, isSeeking: p.isSeeking, consent: true,
});

/** Đợt 81 — độ đầy đủ hồ sơ + gợi ý bổ sung để được nhà tuyển dụng gọi nhiều hơn. */
function Completeness({ f }: { f: FormState }) {
  const items: { ok: boolean; w: number; tip: string }[] = [
    { ok: f.fullName.trim().length >= 2 && !!f.phone && !!f.relativePhone && !!f.gender && !!f.birthDate, w: 30, tip: 'điền đủ họ tên, số điện thoại, người thân, giới tính, ngày sinh' },
    { ok: !!f.address.province && (!!f.address.oldWard || !!f.address.newWardCode), w: 20, tip: 'chọn đủ tỉnh, quận/huyện, phường/xã' },
    { ok: f.desiredJobs.length > 0, w: 15, tip: 'chọn công việc mong muốn (1–3)' },
    { ok: f.kind === 'worker' ? f.shifts.length > 0 : f.availability.length > 0, w: 15, tip: f.kind === 'worker' ? 'chọn ca làm bạn đi được' : 'chọn các buổi rảnh trong tuần để gợi ý ca hợp lịch' },
    { ok: f.lat != null, w: 8, tip: 'bấm “Dùng vị trí hiện tại” để tính km chính xác hơn' },
    { ok: f.radiusKm != null, w: 5, tip: 'chọn khoảng cách muốn đi làm' },
    { ok: !!f.addressDetail.trim(), w: 4, tip: 'ghi số nhà/tên đường hoặc khu trọ' },
    { ok: f.kind === 'worker' ? true : !!f.school.trim() && !!f.major.trim(), w: 3, tip: 'ghi trường và ngành học' },
  ];
  const pct = Math.min(100, items.filter((i) => i.ok).reduce((a, i) => a + i.w, 0));
  const tips = items.filter((i) => !i.ok).slice(0, 2);
  return (
    <div className="rounded-lg border border-border bg-white p-2.5" aria-live="polite">
      <div className="flex items-center justify-between text-[13.5px] font-bold text-ink">
        <span>Độ đầy đủ hồ sơ</span>
        <span className={pct >= 80 ? 'text-success' : 'text-critical'}>{pct}%</span>
      </div>
      <div className="mt-1 h-2.5 rounded-full bg-surface-alt overflow-hidden"><div className={`h-full ${pct >= 80 ? 'bg-success' : 'bg-warning'}`} style={{ width: `${pct}%` }} /></div>
      {tips.length > 0 && <div className="mt-1 text-[12.5px] text-ink">Để được nhà tuyển dụng gọi nhiều hơn: {tips.map((t) => t.tip).join('; ')}.</div>}
    </div>
  );
}

type PhoneStatus = 'idle' | 'checking' | 'new' | 'exists' | 'verified';

// Đợt 79 — form "Dành riêng tuyển công nhân / Sinh viên / Thực tập sinh" (không bắt buộc đăng nhập).
export function WorkerForm({ initialKind }: { initialKind: WorkerKind }) {
  const { me, token } = useAuth();
  const isCandidate = me?.role === 'candidate' && !!token;
  const [f, setF] = useState<FormState>(blank(initialKind));
  const [provinces, setProvinces] = useState<string[]>([]);
  const [phoneStatus, setPhoneStatus] = useState<PhoneStatus>('idle');
  const [existingAt, setExistingAt] = useState<string | null>(null);
  const [verifyBirth, setVerifyBirth] = useState('');
  const [old, setOld] = useState<WorkerProfileView | null>(null); // hồ sơ cũ đã xác minh
  const [editing, setEditing] = useState(true);
  const [saved, setSaved] = useState<WorkerProfileView | null>(null);
  const [jobs, setJobs] = useState<WorkerJobCard[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [geoMsg, setGeoMsg] = useState('');
  const [freeText, setFreeText] = useState('');
  const guessed = guessGroups(freeText, f.kind).filter((g) => !f.desiredJobs.includes(g));
  const set = (p: Partial<FormState>) => setF((s) => ({ ...s, ...p }));

  useEffect(() => {
    workersApi.catalog().then((c) => setProvinces(c.provinces)).catch(() => undefined);
  }, []);
  // Ứng viên có tài khoản: nạp hồ sơ đã gắn tài khoản (nếu có)
  useEffect(() => {
    if (!isCandidate) return;
    workersApi
      .mine(token!)
      .then((p) => {
        if (!p) return;
        setOld(p);
        setF(fromProfile(p));
        setPhoneStatus('verified');
        setEditing(false);
      })
      .catch(() => undefined);
  }, [isCandidate, token]);

  async function onPhoneBlur() {
    const phone = normalizePhone(f.phone);
    if (!phone || phoneStatus === 'verified') return;
    setPhoneStatus('checking');
    try {
      const r = await workersApi.check(phone);
      setExistingAt(r.refreshedAt);
      setPhoneStatus(r.exists ? 'exists' : 'new');
    } catch {
      setPhoneStatus('idle');
    }
  }

  async function doVerify() {
    setErr('');
    if (!isFullDate(verifyBirth)) return setErr('Vui lòng chọn đủ ngày, tháng, năm sinh.');
    setBusy(true);
    try {
      const p = await workersApi.verify(f.phone, verifyBirth);
      setOld(p);
      setPhoneStatus('verified');
      setEditing(false);
      rememberWorker(p, verifyBirth);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function loadJobs(p: WorkerProfileView) {
    setJobs(null);
    workersApi.jobs({ kind: p.kind, ...snapParams(snapOf(p)) }).then(setJobs).catch(() => setJobs([]));
  }

  async function doRefresh() {
    if (!old) return;
    setBusy(true);
    setErr('');
    try {
      const p = isCandidate ? await workersApi.refreshMine(token!) : await workersApi.refresh(old.phone, verifyBirth || old.birthDate);
      setOld(p);
      setSaved(p);
      if (isCandidate) markWorker({ name: p.fullName, kind: p.kind, refreshedAt: p.refreshedAt });
      else rememberWorker(p, verifyBirth || p.birthDate);
      loadJobs(p);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function keepAsIs() {
    if (!old) return;
    setSaved(old);
    loadJobs(old);
  }

  function pickMyLocation() {
    setGeoMsg('');
    if (!navigator.geolocation) return setGeoMsg('Máy không hỗ trợ lấy vị trí.');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({ lat: Math.round(pos.coords.latitude * 1e5) / 1e5, lon: Math.round(pos.coords.longitude * 1e5) / 1e5 });
        setGeoMsg('Đã lấy vị trí — nhà tuyển dụng sẽ thấy khoảng cách chính xác hơn.');
      },
      () => setGeoMsg('Không lấy được vị trí (bạn có thể bỏ qua).'),
      { timeout: 10000 },
    );
  }

  function validate(): string | null {
    if (f.fullName.trim().length < 2) return 'Vui lòng nhập họ và tên.';
    const phone = normalizePhone(f.phone);
    if (!phone) return 'Số điện thoại cá nhân phải có 10 số, bắt đầu bằng 0.';
    const rel = normalizePhone(f.relativePhone);
    if (!rel) return 'Vui lòng nhập số điện thoại người thân (10 số).';
    if (rel === phone) return 'Số người thân phải khác số cá nhân.';
    if (!f.gender) return 'Vui lòng chọn giới tính.';
    if (!isFullDate(f.birthDate)) return 'Vui lòng chọn đủ ngày, tháng, năm sinh.';
    if (!f.address.province) return 'Vui lòng chọn tỉnh/thành phố.';
    if (f.address.addressMode === 'old' && (!f.address.oldDistrict || !f.address.oldWard)) return 'Vui lòng chọn quận/huyện và phường/xã.';
    if (f.address.addressMode === 'new' && !f.address.newWardCode) return 'Vui lòng chọn phường/xã mới trong danh sách gợi ý.';
    if (!f.desiredJobs.length) return 'Vui lòng chọn ít nhất 1 công việc mong muốn.';
    if (!old && !f.consent) return 'Vui lòng đánh dấu đồng ý để nhà tuyển dụng liên hệ.';
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const v = validate();
    if (v) return setErr(v);
    if (phoneStatus === 'exists') return setErr('Số điện thoại này đã có thông tin — vui lòng xác nhận ngày sinh ở trên trước.');
    const body: WorkerInput = {
      kind: f.kind, fullName: f.fullName.trim(), phone: f.phone, relativePhone: f.relativePhone, gender: f.gender, birthDate: f.birthDate,
      province: f.address.province, addressMode: f.address.addressMode, oldDistrict: f.address.oldDistrict || undefined, oldWard: f.address.oldWard || undefined,
      newWardCode: f.address.newWardCode || undefined, addressDetail: f.addressDetail.trim() || undefined, lat: f.lat, lon: f.lon, radiusKm: f.radiusKm,
      desiredJobs: f.desiredJobs, shifts: f.shifts, availability: f.kind === 'worker' ? [] : f.availability, school: f.school.trim() || undefined, major: f.major.trim() || undefined, needsHousing: f.needsHousing,
      needsShuttle: f.needsShuttle, isSeeking: f.isSeeking, consent: f.consent, verifyBirthDate: old ? verifyBirth || old.birthDate : undefined,
    };
    setBusy(true);
    try {
      const r = isCandidate ? await workersApi.saveMine(token!, body) : await workersApi.save(body);
      setOld(r.profile);
      setSaved(r.profile);
      if (isCandidate) markWorker({ name: r.profile.fullName, kind: r.profile.kind, refreshedAt: r.profile.refreshedAt });
      if (!isCandidate) {
        setVerifyBirth(r.profile.birthDate);
        rememberWorker(r.profile, r.profile.birthDate);
      }
      loadJobs(r.profile);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e2) {
      const msg = (e2 as Error).message;
      setErr(msg);
      if (/đã có thông tin|Ngày sinh không khớp/.test(msg)) setPhoneStatus('exists');
    } finally {
      setBusy(false);
    }
  }

  // ---------- màn hình sau khi lưu ----------
  if (saved) {
    const birth = verifyBirth || saved.birthDate;
    return (
      <div className="flex flex-col gap-3">
        <section className="rounded-xl border-2 border-success bg-white p-4 flex flex-col gap-2">
          <h2 className="font-extrabold text-[18px] text-success">Thông tin của bạn đã sẵn sàng để nhà tuyển dụng liên hệ</h2>
          <p className="text-[14.5px] text-ink">
            <b>{saved.fullName}</b> · {KIND_LABEL[saved.kind]} · {saved.phone} · cập nhật lúc <b>{fmtDateTime(saved.refreshedAt)}</b>
          </p>
          <p className="text-[14px] text-ink-muted">{placeText(saved)} · Mong muốn: {saved.desiredJobs.join(', ')}</p>
          <p className="text-[13.5px] text-ink-muted">Nhà tuyển dụng ưu tiên người mới cập nhật. Khi vẫn đang tìm việc, hãy quay lại bấm <b>Làm mới</b> vài ngày một lần.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={doRefresh} disabled={busy} className="rounded-lg bg-primary text-white font-bold text-[14px] px-3 py-2">Làm mới ngay</button>
            <button
              type="button"
              onClick={() => {
                setF(fromProfile(saved));
                setEditing(true);
                setSaved(null);
              }}
              className="rounded-lg border border-border-strong bg-white font-bold text-[14px] px-3 py-2 text-ink"
            >
              Sửa thông tin
            </button>
            <Link href={`/lao-dong-pho-thong/viec-lam?loai=${KIND_SLUG[saved.kind]}`} className="rounded-lg border border-border-strong bg-white font-bold text-[14px] px-3 py-2 text-ink">
              Xem tất cả việc {KIND_LABEL[saved.kind].toLowerCase()}
            </Link>
          </div>
          {err && <div className="text-[13.5px] text-critical">{err}</div>}
        </section>
        <h2 className="tvl-title font-extrabold text-[18px] text-ink self-start">Công ty đang tuyển phù hợp với bạn</h2>
        {jobs === null ? (
          <div className="rounded-xl border border-border bg-white p-4 text-[14px] text-ink-muted">Đang tìm việc phù hợp…</div>
        ) : (
          <LaborJobList
            jobs={jobs}
            who={{ name: saved.fullName, phone: saved.phone, kindLabel: KIND_LABEL[saved.kind], place: [saved.oldDistrict, saved.province].filter(Boolean).join(', '), slots: (saved.availability ?? []).length ? slotText(saved.availability ?? []) : undefined }}
            onApply={(id) => (isCandidate ? workersApi.applyMine(token!, id) : workersApi.quickApply(id, saved.phone, birth))}
          />
        )}
      </div>
    );
  }

  const groups = LABOR_GROUPS[f.kind];
  const showRest = phoneStatus !== 'exists' && !(phoneStatus === 'verified' && !editing);
  const lbl = 'flex flex-col gap-1 text-[14px] font-bold text-ink';
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-[13.5px] font-bold ${on ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white text-ink'}`;

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-white p-4 flex flex-col gap-3" noValidate>
      <label className={lbl} htmlFor="wk-kind">
        Bạn là
        <select id="wk-kind" className="tvl-input font-normal" value={f.kind} onChange={(e) => set({ kind: e.target.value as WorkerKind, desiredJobs: [] })}>
          {(Object.keys(KIND_SELF) as WorkerKind[]).map((k) => (
            <option key={k} value={k}>{KIND_SELF[k]}</option>
          ))}
        </select>
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className={lbl} htmlFor="wk-name">
          Họ và tên *
          <input id="wk-name" className="tvl-input font-normal" value={f.fullName} onChange={(e) => set({ fullName: e.target.value })} autoComplete="name" />
        </label>
        <label className={lbl} htmlFor="wk-phone">
          Số điện thoại cá nhân *
          <input
            id="wk-phone"
            className="tvl-input font-normal"
            inputMode="tel"
            value={f.phone}
            disabled={phoneStatus === 'verified'}
            onChange={(e) => {
              set({ phone: e.target.value });
              if (phoneStatus !== 'verified') setPhoneStatus('idle');
            }}
            onBlur={onPhoneBlur}
            autoComplete="tel"
          />
        </label>
      </div>

      {phoneStatus === 'exists' && (
        <div className="rounded-xl border-2 border-warning bg-warning-tint p-3 flex flex-col gap-2" role="alert">
          <div className="font-extrabold text-[15px] text-ink">Số điện thoại này đã có thông tin tìm việc{existingAt ? ` (cập nhật ${ago(existingAt)})` : ''}.</div>
          <div className="text-[14px] text-ink">Nhập <b>ngày sinh đã đăng ký</b> để xem lại, sửa hoặc làm mới thông tin:</div>
          <DateSelect value={verifyBirth} onChange={setVerifyBirth} idPrefix="wk-vb" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={doVerify} disabled={busy} className="rounded-lg bg-primary text-white font-bold text-[14px] px-4 py-2">Xác nhận</button>
            <button
              type="button"
              onClick={() => {
                set({ phone: '' });
                setPhoneStatus('idle');
                setErr('');
              }}
              className="rounded-lg border border-border-strong bg-white font-bold text-[14px] px-3 py-2 text-ink"
            >
              Dùng số khác
            </button>
          </div>
          <div className="text-[12.5px] text-ink-muted">Quên ngày sinh đã nhập? Hãy dùng chức năng Liên hệ để được hỗ trợ.</div>
          {err && <div className="text-[13.5px] text-critical font-bold">{err}</div>}
        </div>
      )}

      {phoneStatus === 'verified' && old && !editing && (
        <div className="rounded-xl border-2 border-primary bg-white p-3 flex flex-col gap-2">
          <div className="font-extrabold text-[15px] text-ink">Thông tin bạn đã đăng ký · cập nhật {ago(old.refreshedAt)}</div>
          <div className="text-[14px] text-ink leading-relaxed">
            <b>{old.fullName}</b> · {KIND_LABEL[old.kind]} · {GENDER_LABEL[old.gender]} · {old.birthDate.split('-').reverse().join('/')}
            <br />
            {placeText(old)}
            <br />
            Mong muốn: {old.desiredJobs.join(', ')}
            {old.radiusKm ? ` · trong ${old.radiusKm} km` : ''}
            {!old.isSeeking && <span className="text-critical font-bold"> · Đang tạm dừng tìm việc</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={doRefresh} disabled={busy} className="rounded-lg bg-primary text-white font-bold text-[14px] px-3 py-2">Làm mới (không sửa)</button>
            <button type="button" onClick={() => { setF(fromProfile(old)); setEditing(true); }} className="rounded-lg border border-border-strong bg-white font-bold text-[14px] px-3 py-2 text-ink">Sửa thông tin</button>
            <button type="button" onClick={keepAsIs} className="rounded-lg border border-border-strong bg-white font-bold text-[14px] px-3 py-2 text-ink">Giữ nguyên, xem việc phù hợp</button>
          </div>
          <div className="text-[12.5px] text-ink-muted"><b>Làm mới</b> giúp nhà tuyển dụng biết bạn vẫn đang tìm việc (danh sách xếp theo ngày cập nhật).</div>
          {err && <div className="text-[13.5px] text-critical font-bold">{err}</div>}
        </div>
      )}

      {showRest && (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className={lbl} htmlFor="wk-rel">
              Số điện thoại người thân *
              <input id="wk-rel" className="tvl-input font-normal" inputMode="tel" value={f.relativePhone} onChange={(e) => set({ relativePhone: e.target.value })} />
            </label>
            <div className={lbl}>
              Giới tính *
              <div role="radiogroup" aria-label="Giới tính" className="grid grid-cols-3 gap-1.5">
                {Object.entries(GENDER_LABEL).map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={f.gender === v} onClick={() => set({ gender: v })} className={`rounded-lg border py-2 text-[14px] font-bold ${f.gender === v ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white text-ink'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className={lbl}>
            Ngày sinh *
            <DateSelect value={f.birthDate} onChange={(v) => set({ birthDate: v })} idPrefix="wk-bd" />
          </div>

          <fieldset className="rounded-xl border border-border p-3 flex flex-col gap-2">
            <legend className="px-1 font-extrabold text-[15px] text-ink">Địa chỉ</legend>
            <AddressPicker value={f.address} onChange={(a) => set({ address: a })} provinces={provinces} idPrefix="wk-addr" />
            <label className={lbl} htmlFor="wk-detail">
              Số nhà, tên đường, khu trọ… (không bắt buộc)
              <input id="wk-detail" className="tvl-input font-normal" value={f.addressDetail} onChange={(e) => set({ addressDetail: e.target.value })} />
            </label>
          </fieldset>

          <div className={lbl}>
            Khoảng cách muốn đi làm (không bắt buộc)
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={chip(f.radiusKm == null)} onClick={() => set({ radiusKm: null })}>Không chọn</button>
              {RADII.map((r) => (
                <button key={r} type="button" className={chip(f.radiusKm === r)} onClick={() => set({ radiusKm: r })}>Từ {r} km</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 font-normal">
              <button type="button" onClick={pickMyLocation} className="rounded-lg border border-border-strong bg-white font-bold text-[13px] px-2.5 py-1.5 text-ink">
                {f.lat != null ? 'Đã lấy vị trí ✓ — lấy lại' : 'Dùng vị trí hiện tại (tính km chính xác hơn)'}
              </button>
              {f.lat != null && <button type="button" onClick={() => { set({ lat: null, lon: null }); setGeoMsg(''); }} className="text-[13px] font-bold text-critical">Bỏ vị trí</button>}
              {geoMsg && <span className="text-[12.5px] text-ink-muted">{geoMsg}</span>}
            </div>
          </div>

          <div className={lbl}>
            Công việc mong muốn * <span className="font-normal text-[12.5px] text-ink-muted">(chọn 1–3, hoặc gõ tự do bên dưới)</span>
            <div className="flex flex-wrap items-center gap-2 font-normal">
              <input
                id="wk-free"
                className="tvl-input !w-auto flex-1 min-w-[200px]"
                placeholder={f.kind === 'worker' ? 'Gõ công việc, vd: đứng máy, bốc vác, phụ hồ…' : f.kind === 'student' ? 'Gõ công việc, vd: chạy bàn, pha chế, gia sư…' : 'Gõ ngành, vd: kế toán, lập trình…'}
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
              />
              {guessed.length > 0 && (
                <span className="flex flex-wrap items-center gap-1 text-[13px]">
                  Có phải:
                  {guessed.map((g) => (
                    <button key={g} type="button" onClick={() => { if (!f.desiredJobs.includes(g) && f.desiredJobs.length < 3) set({ desiredJobs: [...f.desiredJobs, g] }); setFreeText(''); }} className="rounded-full border border-success bg-success-tint text-success font-bold px-2.5 py-1">
                      + {g}
                    </button>
                  ))}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {groups.map((g) => {
                const on = f.desiredJobs.includes(g);
                return (
                  <button key={g} type="button" className={chip(on)} onClick={() => set({ desiredJobs: on ? f.desiredJobs.filter((x) => x !== g) : f.desiredJobs.length < 3 ? [...f.desiredJobs, g] : f.desiredJobs })}>
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={lbl}>
            Ca làm có thể đi <span className="font-normal text-[12.5px] text-ink-muted">(không bắt buộc)</span>
            <div className="flex flex-wrap gap-1.5">
              {SHIFTS.map((s) => {
                const on = f.shifts.includes(s);
                return (
                  <button key={s} type="button" className={chip(on)} onClick={() => set({ shifts: on ? f.shifts.filter((x) => x !== s) : [...f.shifts, s] })}>{s}</button>
                );
              })}
            </div>
          </div>

          {f.kind !== 'worker' && (
            <div className={lbl}>
              Lịch rảnh trong tuần <span className="font-normal text-[12.5px] text-ink-muted">(không bắt buộc — để gợi ý việc hợp lịch học)</span>
              <ScheduleGrid value={f.availability} onChange={(v) => set({ availability: v })} idPrefix="wk-avail" />
              {f.availability.length > 0 && <span className="font-normal text-[12.5px] text-ink-muted">{slotText(f.availability)}</span>}
            </div>
          )}
          {f.kind !== 'worker' && (
            <div className="grid sm:grid-cols-2 gap-3">
              <label className={lbl} htmlFor="wk-school">
                Trường đang học (không bắt buộc)
                <input id="wk-school" className="tvl-input font-normal" value={f.school} onChange={(e) => set({ school: e.target.value })} />
              </label>
              <label className={lbl} htmlFor="wk-major">
                Ngành học (không bắt buộc)
                <input id="wk-major" className="tvl-input font-normal" value={f.major} onChange={(e) => set({ major: e.target.value })} />
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-ink">
            <label className="flex items-center gap-2" htmlFor="wk-house"><input id="wk-house" type="checkbox" className="w-4 h-4" checked={f.needsHousing} onChange={(e) => set({ needsHousing: e.target.checked })} />Cần chỗ ở / ký túc xá</label>
            <label className="flex items-center gap-2" htmlFor="wk-bus"><input id="wk-bus" type="checkbox" className="w-4 h-4" checked={f.needsShuttle} onChange={(e) => set({ needsShuttle: e.target.checked })} />Cần xe đưa đón</label>
            {old && (
              <label className="flex items-center gap-2" htmlFor="wk-seek"><input id="wk-seek" type="checkbox" className="w-4 h-4" checked={f.isSeeking} onChange={(e) => set({ isSeeking: e.target.checked })} />Tôi vẫn đang tìm việc</label>
            )}
          </div>

          {!old && (
            <label className="flex items-start gap-2 text-[13.5px] text-ink" htmlFor="wk-consent">
              <input id="wk-consent" type="checkbox" className="w-4 h-4 mt-0.5" checked={f.consent} onChange={(e) => set({ consent: e.target.checked })} />
              <span>Tôi đồng ý để nhà tuyển dụng đã đăng nhập xem thông tin trên (gồm số điện thoại của tôi và người thân) để liên hệ tuyển dụng. Tôi có thể sửa hoặc tạm dừng bất cứ lúc nào bằng số điện thoại và ngày sinh.</span>
            </label>
          )}

          <Completeness f={f} />
          {err && <div className="rounded-lg border border-critical bg-white p-2 text-[14px] text-critical font-bold">{err}</div>}
          <button type="submit" disabled={busy || phoneStatus === 'checking'} className="tvl-btn-accent !text-[16px] !py-3">
            {busy ? 'Đang lưu…' : old ? 'Lưu thay đổi' : 'Lưu thông tin & tìm việc phù hợp'}
          </button>
        </>
      )}
    </form>
  );
}
