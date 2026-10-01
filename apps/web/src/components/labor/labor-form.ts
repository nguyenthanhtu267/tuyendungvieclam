// Đợt 80 — chuyển đổi trường tin phổ thông giữa API (JobPosting) và state của form đăng tin.
import type { JobPosting } from '@/lib/api';
import { EMPTY_ADDRESS } from './AddressPicker';
import type { LaborFieldsValue } from './LaborJobFields';

const s = (v?: number | null) => (v ? String(v).replace('.', ',') : '');
export function laborFromJob(job: Pick<JobPosting, 'workPlace' | 'laborPerks' | 'payInfo' | 'laborSchedule' | 'laborExtra'>): LaborFieldsValue {
  const wp = job.workPlace;
  return {
    workPlace: wp
      ? { province: wp.province, addressMode: wp.mode, oldDistrict: wp.oldDistrict ?? '', oldWard: wp.oldWard ?? '', newWardCode: wp.mode === 'new' ? wp.newWardCode ?? '' : '', newWardName: wp.mode === 'new' ? wp.newWard ?? '' : '' }
      : EMPTY_ADDRESS,
    perks: job.laborPerks ?? [],
    payBase: s(job.payInfo?.base),
    payOt: s(job.payInfo?.otHours),
    payNight: s(job.payInfo?.nightHours),
    payAllowance: s(job.payInfo?.allowance),
    schedule: job.laborSchedule ?? [],
    extra: job.laborExtra ?? {},
  };
}
const n = (v: string) => Number(v.replace(',', '.')) || 0;
export function laborToPayload(channel: string, v: LaborFieldsValue) {
  if (channel === 'office') return { workPlace: null, laborPerks: null, payInfo: null, laborSchedule: null, laborExtra: null };
  const a = v.workPlace;
  return {
    workPlace: a.province ? { province: a.province, mode: a.addressMode, oldDistrict: a.oldDistrict || null, oldWard: a.oldWard || null, newWardCode: a.newWardCode || null } : null,
    laborPerks: v.perks,
    payInfo: n(v.payBase) > 0 ? { base: n(v.payBase), otHours: n(v.payOt), nightHours: n(v.payNight), allowance: n(v.payAllowance) } : null,
    laborSchedule: v.schedule,
    laborExtra: v.extra ?? null,
  };
}
