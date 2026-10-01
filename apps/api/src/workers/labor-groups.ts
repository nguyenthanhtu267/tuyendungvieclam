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
export const PERKS = ['housing', 'shuttle', 'meals', 'no_fee', 'intern_cert'];
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
