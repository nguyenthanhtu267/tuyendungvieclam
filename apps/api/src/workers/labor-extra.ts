// Đợt 84 — trường mở rộng riêng cho công nhân / sinh viên / thực tập sinh: làm sạch dữ liệu + đối chiếu yêu cầu.
import { CERTS, EXPERIENCE, LaborKind, ageOf, slotsFor } from './labor-groups';
import { minWageOf } from './min-wage';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const int = (v: unknown, lo: number, hi: number) => {
  const x = Math.round(Number(v));
  return Number.isFinite(x) && x >= lo && x <= hi ? x : undefined;
};
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '') || undefined;
const certsOf = (v: unknown) => (Array.isArray(v) ? v.map(String).filter((c) => CERTS.includes(c)) : []);

export type ProfileExtra = {
  ready?: 'now' | string; // 'now' hoặc ngày YYYY-MM-DD
  experience?: string;
  hasBike?: boolean;
  hasHealth?: boolean;
  certs?: string[];
  hours?: 'lt15' | '15-25' | 'gt25';
  year?: number; // năm học (sinh viên / thực tập sinh)
  months?: number; // thời gian thực tập mong muốn
  sessions?: number; // số buổi / tuần
  startDate?: string;
  mandatory?: 'school' | 'free';
};
export type JobExtra = {
  months?: number;
  allowance?: number; // triệu đồng / tháng (thực tập)
  sessions?: number;
  year?: number; // năm học tối thiểu
  majors?: string;
  hourlyPay?: number; // đồng / giờ (sinh viên)
  hours?: number; // giờ / tuần
  ageMin?: number;
  ageMax?: number;
  docs?: string;
  health?: boolean;
  bike?: boolean;
  certs?: string[];
  experience?: string;
};

export function cleanProfileExtra(kind: LaborKind, raw: unknown): ProfileExtra | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const o: ProfileExtra = {};
  if (r.ready === 'now' || isDate(r.ready)) o.ready = r.ready as string;
  if (kind === 'worker') {
    if (EXPERIENCE.includes(String(r.experience))) o.experience = String(r.experience);
    o.hasBike = !!r.hasBike;
    o.hasHealth = !!r.hasHealth;
    o.certs = certsOf(r.certs);
  } else if (kind === 'student') {
    if (['lt15', '15-25', 'gt25'].includes(String(r.hours))) o.hours = String(r.hours) as ProfileExtra['hours'];
    const y = int(r.year, 1, 6);
    if (y) o.year = y;
    o.hasBike = !!r.hasBike;
  } else {
    const y = int(r.year, 1, 6);
    if (y) o.year = y;
    if ([1, 2, 3, 6].includes(Number(r.months))) o.months = Number(r.months);
    const s = int(r.sessions, 1, 6);
    if (s) o.sessions = s;
    if (isDate(r.startDate)) o.startDate = r.startDate as string;
    if (['school', 'free'].includes(String(r.mandatory))) o.mandatory = String(r.mandatory) as ProfileExtra['mandatory'];
  }
  return Object.keys(o).length ? o : null;
}

export function cleanJobExtra(kind: LaborKind, raw: unknown): JobExtra | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const o: JobExtra = {};
  if (kind === 'intern') {
    if ([1, 2, 3, 6].includes(Number(r.months))) o.months = Number(r.months);
    const al = Number(r.allowance);
    if (Number.isFinite(al) && al > 0 && al <= 50) o.allowance = Math.round(al * 10) / 10;
    const s = int(r.sessions, 1, 6);
    if (s) o.sessions = s;
    const y = int(r.year, 1, 6);
    if (y) o.year = y;
    const m = str(r.majors, 150);
    if (m) o.majors = m;
  } else if (kind === 'student') {
    const hp = int(r.hourlyPay, 1000, 500000);
    if (hp) o.hourlyPay = hp;
    const h = int(r.hours, 1, 48);
    if (h) o.hours = h;
  } else {
    const a1 = int(r.ageMin, 15, 65);
    const a2 = int(r.ageMax, 15, 70);
    if (a1) o.ageMin = a1;
    if (a2) o.ageMax = a2;
    const d = str(r.docs, 150);
    if (d) o.docs = d;
    if (r.health) o.health = true;
    if (r.bike) o.bike = true;
    const c = certsOf(r.certs);
    if (c.length) o.certs = c;
    if (EXPERIENCE.includes(String(r.experience)) && r.experience !== 'none') o.experience = String(r.experience);
  }
  return Object.keys(o).length ? o : null;
}

/** Số giờ tối đa / tuần của từng mức người học chọn. */
const HOURS_MAX: Record<string, number> = { lt15: 14, '15-25': 25, gt25: 48 };
const EXP_RANK: Record<string, number> = { none: 0, lt1: 1, gte1: 2 };
const CERT_LABEL: Record<string, string> = { a1: 'Bằng A1', b2: 'Bằng B2', c: 'Bằng C', forklift: 'Chứng chỉ xe nâng', welding: 'Chứng chỉ hàn' };

export type Fit = { ok: string[]; missing: string[]; hint: string[]; percent: number | null };
type FitJob = { channel?: string; laborExtra?: JobExtra | null; laborSchedule?: string[] | null };
type FitProfile = { kind: string; birthDate: string | Date; extra?: ProfileExtra | null; availability?: string[] | null; major?: string | null };

/** Đối chiếu yêu cầu của tin với hồ sơ — chỉ dựa trên thông tin có thật, không suy đoán. */
export function fitOf(job: FitJob, p: FitProfile, third = false): Fit {
  const ok: string[] = [];
  const missing: string[] = [];
  const hint: string[] = [];
  const e = job.laborExtra ?? {};
  const x = p.extra ?? {};
  if (job.channel === 'worker') {
    const age = ageOf(p.birthDate);
    if (e.ageMin || e.ageMax) {
      if ((e.ageMin && age < e.ageMin) || (e.ageMax && age > e.ageMax)) missing.push(`Tin cần tuổi ${e.ageMin ?? '…'}–${e.ageMax ?? '…'} (bạn ${age} tuổi)`);
      else ok.push('Đúng độ tuổi');
    }
    if (e.bike) (x.hasBike ? ok : missing).push(x.hasBike ? 'Có xe máy' : 'Cần có xe máy');
    if (e.health) (x.hasHealth ? ok : missing).push(x.hasHealth ? 'Có giấy khám sức khoẻ' : 'Cần giấy khám sức khoẻ');
    for (const c of e.certs ?? []) (x.certs ?? []).includes(c) ? ok.push(CERT_LABEL[c]) : missing.push(`Cần ${CERT_LABEL[c] ?? c}`);
    if (e.experience) {
      if ((EXP_RANK[x.experience ?? 'none'] ?? 0) >= (EXP_RANK[e.experience] ?? 0)) ok.push('Đủ kinh nghiệm');
      else missing.push('Tin ưu tiên người đã có kinh nghiệm');
    }
  } else if (job.channel === 'intern') {
    if (e.year) {
      if (x.year && x.year >= e.year) ok.push('Đúng năm học');
      else if (x.year) missing.push(`Tin cần sinh viên từ năm ${e.year} (bạn năm ${x.year})`);
      else hint.push(`Tin cần sinh viên từ năm ${e.year} — hãy điền năm học`);
    }
    if (e.majors) {
      const mj = fold(p.major ?? '');
      const hit = fold(e.majors).split(' ').filter((w) => w.length >= 4).some((w) => mj.includes(w));
      if (hit) ok.push('Hợp ngành học');
      else if (mj) missing.push(`Tin ưu tiên ngành: ${e.majors}`);
    }
    if (e.months && x.months) (x.months >= e.months ? ok : missing).push(x.months >= e.months ? 'Đủ thời gian thực tập' : `Tin cần thực tập ${e.months} tháng (bạn chọn ${x.months})`);
    if (e.sessions && x.sessions) (x.sessions >= e.sessions ? ok : missing).push(x.sessions >= e.sessions ? 'Đủ số buổi/tuần' : `Tin cần ${e.sessions} buổi/tuần (bạn ${x.sessions})`);
  } else if (job.channel === 'student') {
    if (e.hours && x.hours) {
      if (e.hours > HOURS_MAX[x.hours]) missing.push(`Tin cần ~${e.hours} giờ/tuần, bạn chọn tối đa ${HOURS_MAX[x.hours]} giờ`);
      else ok.push('Hợp số giờ/tuần');
    }
  }
  // Lịch rảnh (sinh viên + thực tập sinh)
  if ((job.channel === 'student' || job.channel === 'intern') && job.laborSchedule?.length && p.availability?.length) {
    const busy = job.laborSchedule.filter((s) => !p.availability!.includes(s)).length;
    if (busy) missing.push(`Trùng ${busy} buổi bận của bạn`);
    else ok.push('Lịch rảnh khớp ca làm');
  }
  const total = ok.length + missing.length;
  // Nhà tuyển dụng đọc về ứng viên ⇒ đổi "bạn" thành "họ"
  const tr = (a: string[]) => (third ? a.map((t) => t.replace(/\bbạn\b/g, 'họ')) : a);
  return { ok: tr(ok), missing: tr(missing), hint: tr(hint), percent: total ? Math.round((ok.length / total) * 100) : null };
}

/** Lương theo giờ của tin sinh viên so với mức tối thiểu giờ của vùng. */
export function hourlyInfo(province: string | undefined | null, hourly?: number | null, hours?: number | null) {
  if (!hourly) return null;
  const m = minWageOf(province);
  return {
    hourly,
    belowMin: hourly < m.hour,
    min: m.hour,
    region: m.region,
    monthEstimate: hours ? Math.round((hourly * hours * 52) / 12 / 1000) * 1000 : null,
  };
}

/** Cảnh báo nhẹ khi lưu hồ sơ (không chặn). */
export function profileSanity(kind: LaborKind, birthDate: string, extra: ProfileExtra | null, availability: string[] | null, shifts: string[] | null): string[] {
  const out: string[] = [];
  const age = ageOf(birthDate);
  if (kind === 'intern' && age > 28) out.push(`Bạn ${age} tuổi — thực tập sinh thường là sinh viên dưới 28 tuổi, kiểm tra lại ngày sinh hoặc nhóm hồ sơ.`);
  if (kind === 'student' && age > 30) out.push(`Bạn ${age} tuổi — nhóm “Sinh viên” thường dưới 30 tuổi, kiểm tra lại ngày sinh.`);
  if (kind === 'worker' && age < 18) out.push('Bạn chưa đủ 18 tuổi: web sẽ ẩn các việc ca đêm/nặng nhọc và cần người giám hộ đồng ý khi đi làm.');
  if (kind === 'worker' && extra?.certs?.length && extra.experience === 'none') out.push('Bạn có chứng chỉ nghề nhưng chọn “chưa có kinh nghiệm” — kiểm tra lại cho đúng.');
  if (kind !== 'worker' && !(availability ?? []).length) out.push('Bạn chưa chọn buổi nào rảnh — nhà tuyển dụng sẽ khó xếp lịch cho bạn.');
  if (kind === 'student' && extra?.hours === 'gt25' && (availability ?? []).length && (availability ?? []).length < 8) out.push('Bạn chọn làm trên 25 giờ/tuần nhưng lịch rảnh còn ít — kiểm tra lại.');
  if (kind === 'intern' && extra?.sessions && extra.sessions > (availability ?? []).length / 2 + 0.5) out.push('Số buổi/tuần bạn muốn thực tập nhiều hơn số buổi rảnh đã chọn.');
  void slotsFor; void shifts;
  return out;
}
