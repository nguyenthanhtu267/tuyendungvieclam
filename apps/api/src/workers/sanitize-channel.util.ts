import { LABOR_GROUPS, PERKS, SLOTS, slotsFor, LaborKind } from './labor-groups';
import { cleanJobExtra } from './labor-extra';
import { resolveWorkPlace } from './vn-geo';

// Đợt 79/80 — kênh tin + các trường riêng của tin lao động phổ thông (chỉ giữ khi kênh khác "office").
// Đợt 135 — tách khỏi employer.service để AdminService dùng chung (tránh vòng import admin ↔ employer).
export function sanitizeChannel(dto: { channel?: string; laborGroup?: string | null; workPlace?: unknown; laborPerks?: unknown; payInfo?: unknown; laborSchedule?: unknown; laborExtra?: unknown }) {
  const ch = ['worker', 'student', 'intern'].includes(String(dto.channel)) ? String(dto.channel) : 'office';
  if (ch === 'office') return { channel: 'office', laborGroup: null, workPlace: null, laborPerks: null, payInfo: null, laborSchedule: null, laborExtra: null };
  const groups = LABOR_GROUPS[ch as 'worker'];
  const perks = Array.isArray(dto.laborPerks) ? dto.laborPerks.filter((x) => PERKS.includes(String(x))).map(String) : [];
  const sched = Array.isArray(dto.laborSchedule) ? dto.laborSchedule.filter((x) => (ch === 'intern' ? slotsFor('intern') : SLOTS).includes(String(x))).map(String) : [];
  const pi = (dto.payInfo ?? null) as Record<string, unknown> | null;
  const n = (v: unknown, max: number) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 && x <= max ? Math.round(x * 10) / 10 : 0;
  };
  const payInfo = pi && n(pi.base, 200) > 0 ? { base: n(pi.base, 200), otHours: n(pi.otHours, 120), nightHours: n(pi.nightHours, 208), allowance: n(pi.allowance, 50) } : null;
  return {
    channel: ch,
    laborGroup: dto.laborGroup && groups.includes(dto.laborGroup) ? dto.laborGroup : null,
    workPlace: resolveWorkPlace(dto.workPlace),
    laborPerks: perks.length ? perks : null,
    payInfo,
    laborSchedule: sched.length ? sched : null,
    laborExtra: cleanJobExtra(ch as LaborKind, dto.laborExtra),
  };
}

