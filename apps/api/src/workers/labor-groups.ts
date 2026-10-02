// Đợt 79 — nhóm công việc cho kênh lao động phổ thông (dùng chung: hồ sơ ứng viên ↔ tin tuyển dụng).
// Giữ bản sao giống hệt ở apps/web/src/lib/labor.ts.
export const LABOR_GROUPS: Record<'worker' | 'student' | 'intern', string[]> = {
  worker: [
    'May mặc - Giày da', 'Điện tử - Lắp ráp', 'Cơ khí - Hàn - Tiện', 'Chế biến thực phẩm', 'Kho vận - Bốc xếp',
    'Đóng gói - Phân loại', 'Nhựa - Bao bì - In ấn', 'Gỗ - Nội thất', 'Bảo vệ', 'Tạp vụ - Vệ sinh',
    'Lái xe - Giao hàng', 'Phụ bếp - Phục vụ', 'Xây dựng', 'Lao động phổ thông khác',
  ],
  student: [
    'Phục vụ - Pha chế', 'Bán hàng - Thu ngân', 'Giao hàng', 'Gia sư', 'Sự kiện - PG/PB',
    'Nhập liệu - Văn phòng', 'Chăm sóc khách hàng - Telesale', 'Bán thời gian khác',
  ],
  intern: [
    'Kế toán - Tài chính', 'Công nghệ thông tin', 'Marketing - Truyền thông', 'Kinh doanh - Bán hàng',
    'Nhân sự - Hành chính', 'Kỹ thuật - Cơ khí', 'Điện - Điện tử', 'Thiết kế - Mỹ thuật', 'Ngoại ngữ - Biên phiên dịch',
    'Logistics - Xuất nhập khẩu', 'Ngành khác',
  ],
};
export const ALL_LABOR_GROUPS = Array.from(new Set(Object.values(LABOR_GROUPS).flat()));
export const SHIFTS = ['Hành chính', 'Xoay ca', 'Ca đêm', 'Cuối tuần', 'Theo giờ linh hoạt'];
export const RADII = [5, 10, 20, 30];
export const CHANNELS = ['office', 'worker', 'student', 'intern'] as const;

// Đợt 80 — quyền lợi đặc thù tin phổ thông
export const PERKS = ['housing', 'shuttle', 'meals', 'no_fee', 'intern_cert', 'allowance', 'convert'];
// Đợt 80 — ô lịch (thứ × buổi) dùng cho lịch rảnh SV và ca cần người của tin
export const DAYS = ['t2', 't3', 't4', 't5', 't6', 't7', 'cn'];
export const PARTS = ['sang', 'chieu', 'toi'];
export const SLOTS = DAYS.flatMap((d) => PARTS.map((p) => `${d}-${p}`));

/** Ước tính thu nhập tháng (triệu đồng) theo Bộ luật Lao động 2019: tăng ca ngày thường ≥150%, làm đêm +30%.
 *  Giờ chuẩn: 26 ngày × 8 giờ = 208 giờ/tháng. BHXH+BHYT+BHTN người lao động đóng 10,5% trên lương cơ bản. */
export function estimateIncome(pay?: { base: number; otHours?: number; nightHours?: number; allowance?: number } | null) {
  if (!pay || !(pay.base > 0)) return null;
  const hourly = pay.base / 208;
  const ot = hourly * 1.5 * (pay.otHours ?? 0);
  const night = hourly * 0.3 * (pay.nightHours ?? 0);
  const allowance = pay.allowance ?? 0;
  const gross = pay.base + ot + night + allowance;
  const insurance = pay.base * 0.105;
  const r = (v: number) => Math.round(v * 10) / 10;
  return { base: r(pay.base), ot: r(ot), night: r(night), allowance: r(allowance), gross: r(gross), insurance: r(insurance), net: r(gross - insurance), otHours: pay.otHours ?? 0, nightHours: pay.nightHours ?? 0 };
}

// ---------- Đợt 84 — quy tắc riêng từng nhóm ----------
export type LaborKind = 'worker' | 'student' | 'intern';
/** Ca làm "có thể đi": sinh viên chỉ có ca cuối tuần/linh hoạt (buổi tối đã nằm trong lưới lịch); thực tập sinh dùng "thời gian thực tập" thay vì ca. */
export const SHIFTS_BY_KIND: Record<LaborKind, string[]> = { worker: SHIFTS, student: ['Cuối tuần', 'Theo giờ linh hoạt'], intern: [] };
/** Ô lịch được phép theo nhóm: thực tập sinh làm giờ hành chính — T2–T6 sáng/chiều + T7 sáng, không có buổi tối và Chủ nhật. */
export const INTERN_SLOTS = [...['t2', 't3', 't4', 't5', 't6'].flatMap((d) => [`${d}-sang`, `${d}-chieu`]), 't7-sang'];
export const slotsFor = (kind: LaborKind): string[] => (kind === 'intern' ? INTERN_SLOTS : kind === 'student' ? SLOTS : []);
export const CERTS = ['a1', 'b2', 'c', 'forklift', 'welding'];
export const EXPERIENCE = ['none', 'lt1', 'gte1'];
/** Việc nặng nhọc/độc hại/nguy hiểm — người chưa đủ 18 tuổi không được làm (Bộ luật Lao động 2019). */
export const MINOR_HEAVY_GROUPS = ['Xây dựng', 'Cơ khí - Hàn - Tiện', 'Bảo vệ', 'Kho vận - Bốc xếp', 'Chế biến thực phẩm', 'Lái xe - Giao hàng', 'Giao hàng'];
export function minorUnsafeReason(j: { laborGroup?: string | null; title?: string | null; description?: string | null; payInfo?: { nightHours?: number } | null }): string | null {
  if (j.laborGroup && MINOR_HEAVY_GROUPS.includes(j.laborGroup)) return `Nhóm việc “${j.laborGroup}” có thể nặng nhọc/nguy hiểm — không dành cho người chưa đủ 18 tuổi`;
  if ((j.payInfo?.nightHours ?? 0) > 0) return 'Có làm đêm — người chưa đủ 18 tuổi không được làm đêm';
  const t = `${j.title ?? ''} ${(j.description ?? '').replace(/<[^>]*>/g, ' ')}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  if (/ca dem|lam dem|nang nhoc|doc hai|bốc vác|boc vac/.test(t)) return 'Tin nêu ca đêm/việc nặng nhọc — người chưa đủ 18 tuổi không được làm';
  return null;
}
export const ageOf = (birth: string | Date) => Math.floor((Date.now() - new Date(birth).getTime()) / (365.25 * 864e5));

/** Đợt 134 — suy ra ca làm của một tin (để lọc "Ca làm" và hiện nhãn): từ lưới ca cần người + chữ trong tiêu đề/mô tả + giờ làm đêm. */
export function jobShiftTags(j: { title?: string | null; description?: string | null; workSchedule?: string | null; laborSchedule?: string[] | null; payInfo?: { nightHours?: number } | null }): string[] {
  const t = ` ${[j.title, j.workSchedule, (j.description ?? '').replace(/<[^>]+>/g, ' ')].filter(Boolean).join(' ')} `.toLowerCase();
  const sched = j.laborSchedule ?? [];
  const out = new Set<string>();
  if (/xoay ca|ca xoay|đảo ca|luân phiên ca|3 ca|ba ca|2 ca|hai ca|ca kíp|làm ca\b/.test(t)) out.add('Xoay ca');
  if (/ca đêm|làm đêm|ca 3\b|đêm/.test(t) || (j.payInfo?.nightHours ?? 0) > 0) out.add('Ca đêm');
  if (/hành chính|giờ hành chính|8h ?- ?17h|8h ?- ?17h30|7h30 ?- ?16h30/.test(t)) out.add('Hành chính');
  if (/cuối tuần|thứ 7, chủ nhật|t7, cn|thứ bảy|chủ nhật/.test(t) || (sched.length > 0 && sched.every((x) => x.startsWith('t7') || x.startsWith('cn')))) out.add('Cuối tuần');
  if (/theo giờ|linh hoạt|bán thời gian|part ?-?time|thời vụ|ca gãy/.test(t)) out.add('Theo giờ linh hoạt');
  if (sched.length) {
    const weekdayDay = sched.some((x) => /^t[2-6]-(sang|chieu)$/.test(x));
    const anyEvening = sched.some((x) => x.endsWith('-toi'));
    if (weekdayDay && !anyEvening && !out.has('Xoay ca')) out.add('Hành chính');
    if (anyEvening && !weekdayDay) out.add('Theo giờ linh hoạt');
  }
  return SHIFTS.filter((s) => out.has(s));
}
