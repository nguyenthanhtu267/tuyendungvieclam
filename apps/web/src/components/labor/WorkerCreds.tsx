'use client';

import Link from '@/components/SmartLink';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { workersApi, type ProfileExtra, type ApplyResult, type WorkerKind, type WorkerProfileView } from '@/lib/api';
import { KIND_LABEL, ageOfBirth, normalizePhone, slotText } from '@/lib/labor';
import { DateSelect, isFullDate } from './DateSelect';
import { markWorker } from './RefreshReminder';

const KEY = 'tvl_worker_creds';
// Ảnh chụp hồ sơ (để tính "gần tôi", ưu tiên KTX/xe, hợp lịch) — chỉ nằm trong phiên trình duyệt
export interface WorkerSnap {
  kind: WorkerKind; province: string; oldDistrict: string | null; newWardCode: string | null; lat: number | null; lon: number | null;
  desiredJobs: string[]; availability: string[]; needsHousing: boolean; needsShuttle: boolean; radiusKm: number | null;
  birthDate?: string; extra?: ProfileExtra | null; major?: string | null;
}
interface Creds { phone: string; birthDate: string; name: string; snap?: WorkerSnap }

export const snapOf = (p: WorkerProfileView): WorkerSnap => ({
  kind: p.kind, province: p.province, oldDistrict: p.oldDistrict, newWardCode: p.newWardCode, lat: p.lat, lon: p.lon, desiredJobs: p.desiredJobs,
  availability: p.availability ?? [], needsHousing: p.needsHousing, needsShuttle: p.needsShuttle, radiusKm: p.radiusKm,
  birthDate: p.birthDate, extra: p.extra ?? null, major: p.major,
});
/** Tham số gửi API browse/jobs từ ảnh chụp hồ sơ. */
export function snapParams(s?: WorkerSnap | null): Record<string, string | undefined> {
  if (!s) return {};
  return {
    oProvince: s.province, oDistrict: s.oldDistrict ?? undefined, oWard: s.newWardCode ?? undefined,
    oLat: s.lat != null ? String(s.lat) : undefined, oLon: s.lon != null ? String(s.lon) : undefined,
    groups: s.desiredJobs.join('|'), avail: s.availability.join(','), needs: [s.needsHousing ? 'housing' : '', s.needsShuttle ? 'shuttle' : ''].filter(Boolean).join(','),
    // Đợt 84 — người chưa đủ 18 tuổi: ẩn việc ca đêm/nặng; sinh viên: lọc theo số giờ/tuần; đối chiếu yêu cầu của tin
    minor: s.birthDate && ageOfBirth(s.birthDate) < 18 ? '1' : undefined,
    hours: s.extra?.hours === 'lt15' ? '14' : s.extra?.hours === '15-25' ? '25' : undefined,
    fit: s.birthDate ? '1' : undefined, bd: s.birthDate, ex: s.extra ? JSON.stringify(s.extra) : undefined, major: s.major ?? undefined,
  };
}

export function rememberWorker(p: WorkerProfileView, birthDate?: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ phone: p.phone, birthDate: birthDate ?? p.birthDate, name: p.fullName, snap: snapOf(p) }));
  } catch {
    /* bỏ qua */
  }
  markWorker({ name: p.fullName, kind: p.kind, refreshedAt: p.refreshedAt });
}

function readCreds(): Creds | null {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

// Đợt 79/80 — "ứng tuyển nhanh": khách xác nhận SĐT + ngày sinh một lần (nhớ trong phiên),
// ứng viên đăng nhập dùng hồ sơ gắn tài khoản. Cung cấp thêm ảnh chụp vị trí/nhu cầu để xếp việc.
export function useWorkerApply() {
  const { me, token } = useAuth();
  const isCandidate = me?.role === 'candidate' && !!token;
  const [creds, setCreds] = useState<Creds | null>(null);
  const [mine, setMine] = useState<WorkerProfileView | null | undefined>(undefined);
  useEffect(() => setCreds(readCreds()), []);
  useEffect(() => {
    if (!isCandidate) return setMine(undefined);
    workersApi.mine(token!).then(setMine).catch(() => setMine(null));
  }, [isCandidate, token]);
  const save = useCallback((c: Creds | null) => {
    setCreds(c);
    try {
      if (c) sessionStorage.setItem(KEY, JSON.stringify(c));
      else sessionStorage.removeItem(KEY);
    } catch {
      /* bỏ qua */
    }
  }, []);
  const ready = isCandidate ? !!mine : !!creds;
  const snap: WorkerSnap | null = isCandidate ? (mine ? snapOf(mine) : null) : creds?.snap ?? null;
  const apply = useCallback(
    async (jobId: string, group?: string): Promise<ApplyResult> => {
      if (isCandidate) {
        if (!mine) throw new Error('Bạn chưa có hồ sơ lao động phổ thông — bấm "Điền thông tin" ở khung phía trên.');
        return workersApi.applyMine(token!, jobId, group);
      }
      if (!creds) throw new Error('Nhập SĐT và ngày sinh đã đăng ký ở khung phía trên để ứng tuyển nhanh.');
      return workersApi.quickApply(jobId, creds.phone, creds.birthDate, group);
    },
    [isCandidate, mine, token, creds],
  );
  return { isCandidate, creds, mine, save, ready, apply, snap, token };
}

/** Thông tin để soạn tin nhắn tự giới thiệu (Đợt 81). */
export function whoOf(w: ReturnType<typeof useWorkerApply>) {
  const name = w.isCandidate ? w.mine?.fullName : w.creds?.name;
  if (!name) return null;
  const phone = w.isCandidate ? w.mine?.phone : w.creds?.phone;
  const s = w.snap;
  return {
    name,
    phone,
    kindLabel: s ? KIND_LABEL[s.kind] : 'công nhân',
    place: s ? [s.oldDistrict, s.province].filter(Boolean).join(', ') : undefined,
    slots: s && s.availability.length ? slotText(s.availability) : undefined,
  };
}

export function WorkerCredsBox({ w, slug }: { w: ReturnType<typeof useWorkerApply>; slug: string }) {
  const [phone, setPhone] = useState('');
  const [birth, setBirth] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (w.isCandidate) {
    if (w.mine === undefined) return null;
    return (
      <div className="rounded-xl border border-border bg-white p-3 text-[14px] text-ink flex flex-wrap items-center gap-2">
        {w.mine ? (
          <>Ứng tuyển nhanh bằng hồ sơ: <b>{w.mine.fullName}</b> ({KIND_LABEL[w.mine.kind]}). <Link href={`/lao-dong-pho-thong?loai=${slug}`} className="font-bold text-primary underline">Sửa / làm mới hồ sơ</Link></>
        ) : (
          <>Bạn chưa có hồ sơ lao động phổ thông. <Link href={`/lao-dong-pho-thong?loai=${slug}`} className="font-bold text-primary underline">Điền thông tin (1 phút)</Link></>
        )}
      </div>
    );
  }
  if (w.creds)
    return (
      <div className="rounded-xl border border-border bg-white p-3 text-[14px] text-ink flex flex-wrap items-center gap-2">
        Ứng tuyển nhanh bằng thông tin của: <b>{w.creds.name}</b> ({w.creds.phone})
        <button type="button" onClick={() => w.save(null)} className="font-bold text-primary underline">Đổi số khác</button>
      </div>
    );

  async function confirm() {
    setErr('');
    const p = normalizePhone(phone);
    if (!p) return setErr('Số điện thoại phải có 10 số, bắt đầu bằng 0.');
    if (!isFullDate(birth)) return setErr('Vui lòng chọn đủ ngày, tháng, năm sinh.');
    setBusy(true);
    try {
      const prof = await workersApi.verify(p, birth);
      rememberWorker(prof, birth);
      w.save({ phone: p, birthDate: birth, name: prof.fullName, snap: snapOf(prof) });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div id="worker-creds" className="rounded-xl border border-border bg-white p-3 flex flex-col gap-2">
      <div className="text-[14.5px] text-ink">
        <b>Ứng tuyển nhanh không cần CV:</b> nhập số điện thoại và ngày sinh bạn đã đăng ký (để xếp việc gần bạn). Chưa đăng ký?{' '}
        <Link href={`/lao-dong-pho-thong?loai=${slug}`} className="font-bold text-primary underline">Điền thông tin (1 phút)</Link>
      </div>
      <div className="grid sm:grid-cols-[1fr_1.4fr_auto] gap-2">
        <input id="wc-phone" aria-label="Số điện thoại" className="tvl-input" inputMode="tel" placeholder="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <DateSelect value={birth} onChange={setBirth} idPrefix="wc-bd" />
        <button type="button" onClick={confirm} disabled={busy} className="rounded-lg bg-primary text-white font-bold text-[14px] px-4 py-2">Xác nhận</button>
      </div>
      {err && <div className="text-[13.5px] text-critical font-bold">{err}</div>}
    </div>
  );
}
