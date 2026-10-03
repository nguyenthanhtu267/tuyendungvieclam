import { shareDeviceQuery } from './social';
// Đợt 79 — kênh lao động phổ thông. Bản sao của apps/api/src/workers/labor-groups.ts (giữ giống hệt).
import type { WorkerKind } from './api';

export const LABOR_GROUPS: Record<WorkerKind, string[]> = {
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
export const SHIFTS = ['Hành chính', 'Xoay ca', 'Ca đêm', 'Cuối tuần', 'Theo giờ linh hoạt'];
export const RADII = [5, 10, 20, 30];

export const KIND_LABEL: Record<WorkerKind, string> = { worker: 'Công nhân', student: 'Sinh viên', intern: 'Thực tập sinh' };
export const KIND_SELF: Record<WorkerKind, string> = { worker: 'Bạn là công nhân', student: 'Bạn là sinh viên', intern: 'Bạn là thực tập sinh' };
export const KIND_SLUG: Record<WorkerKind, string> = { worker: 'cong-nhan', student: 'sinh-vien', intern: 'thuc-tap-sinh' };
export const SLUG_KIND: Record<string, WorkerKind> = { 'cong-nhan': 'worker', 'sinh-vien': 'student', 'thuc-tap-sinh': 'intern' };
export const CHANNEL_OPTIONS = [
  { v: 'office', l: 'Việc làm văn phòng / chuyên môn (mặc định)' },
  { v: 'worker', l: 'Tuyển công nhân' },
  { v: 'student', l: 'Sinh viên' },
  { v: 'intern', l: 'Thực tập sinh' },
];
export const GENDER_LABEL: Record<string, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' };

export function normalizePhone(v: string): string | null {
  let d = v.replace(/\D/g, '');
  if (d.startsWith('84') && d.length === 11) d = '0' + d.slice(2);
  return /^0\d{9}$/.test(d) ? d : null;
}
export function placeText(p: { newWard: string | null; oldWard: string | null; oldDistrict: string | null; province: string; addressMode: string }) {
  if (p.addressMode === 'old' && p.oldWard) return `${p.oldWard}, ${p.oldDistrict}, ${p.province}${p.newWard && p.newWard !== p.oldWard ? ` (nay: ${p.newWard})` : ''}`;
  return [p.newWard, p.province].filter(Boolean).join(', ');
}
export function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m || 1} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} ngày trước` : new Date(iso).toLocaleDateString('vi-VN');
}
export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN')}`;
}
export function laborShareUrl(jobId: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== 'undefined' ? window.location.origin : 'https://www.vieclamngay.vn');
  return `${base}/s/${jobId}${shareDeviceQuery()}`;
}

// ---------------- Đợt 80 ----------------
export const PERK_LABEL: Record<string, string> = {
  housing: 'Có ký túc xá / chỗ ở',
  shuttle: 'Có xe đưa đón',
  meals: 'Bao cơm',
  no_fee: 'Cam kết không thu phí',
  intern_cert: 'Có xác nhận & phiếu nhận xét thực tập',
  allowance: 'Có trợ cấp / hỗ trợ thực tập',
  convert: 'Có cơ hội nhận chính thức sau thực tập',
};
export const PERK_SHORT: Record<string, string> = { housing: 'Có KTX', shuttle: 'Xe đưa đón', meals: 'Bao cơm', no_fee: 'Không thu phí', intern_cert: 'Có phiếu nhận xét', allowance: 'Có trợ cấp', convert: 'Cơ hội lên chính thức' };
export const PERKS_BY_KIND: Record<WorkerKind, string[]> = {
  worker: ['housing', 'shuttle', 'meals', 'no_fee'],
  student: ['meals', 'no_fee'],
  intern: ['allowance', 'convert', 'intern_cert', 'meals', 'no_fee'],
};
export const DAYS = ['t2', 't3', 't4', 't5', 't6', 't7', 'cn'];
export const DAY_LABEL: Record<string, string> = { t2: 'T2', t3: 'T3', t4: 'T4', t5: 'T5', t6: 'T6', t7: 'T7', cn: 'CN' };
export const PARTS = ['sang', 'chieu', 'toi'];
export const PART_LABEL: Record<string, string> = { sang: 'Sáng', chieu: 'Chiều', toi: 'Tối' };
export const slotText = (slots: string[]) => {
  const byPart = PARTS.map((p) => ({ p, days: DAYS.filter((d) => slots.includes(`${d}-${p}`)) })).filter((x) => x.days.length);
  return byPart.map((x) => `${PART_LABEL[x.p]} ${x.days.map((d) => DAY_LABEL[d]).join(', ')}`).join(' · ');
};

export const CALL_STATUS: { v: string; l: string; cls: string }[] = [
  { v: 'no_answer', l: 'Chưa nghe máy', cls: 'bg-warning-tint text-ink border-warning' },
  { v: 'callback', l: 'Hẹn gọi lại', cls: 'bg-primary-tint text-primary border-primary' },
  { v: 'interview', l: 'Hẹn phỏng vấn', cls: 'bg-primary text-white border-primary' },
  { v: 'hired', l: 'Đã nhận việc', cls: 'bg-success text-white border-success' },
  { v: 'rejected', l: 'Không phù hợp', cls: 'bg-surface-alt text-ink-muted border-border-strong' },
  { v: 'no_show', l: 'Nhận việc nhưng không đi làm', cls: 'bg-critical-tint text-critical border-critical' },
];
export const CALL_LABEL: Record<string, string> = Object.fromEntries([['new', 'Mới'], ...CALL_STATUS.map((c) => [c.v, c.l])]);

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
// Từ người lao động hay gõ → nhóm việc (khớp theo cụm không dấu)
const KEYWORDS: [string[], string][] = [
  [['may', 'det', 'giay', 'da giay', 'cat chi', 'ui do', 'vat so'], 'May mặc - Giày da'],
  [['dien tu', 'lap rap', 'linh kien', 'han thiec', 'smt', 'bo mach', 'dung may', 'dung chuyen'], 'Điện tử - Lắp ráp'],
  [['co khi', 'han', 'tien', 'phay', 'cnc', 'dot dap', 'son tinh dien'], 'Cơ khí - Hàn - Tiện'],
  [['thuc pham', 'che bien', 'thuy san', 'dong lanh', 'banh keo', 'lam ca', 'lot ca', 'tom'], 'Chế biến thực phẩm'],
  [['kho', 'boc vac', 'boc xep', 'xe nang', 'phu kho', 'soan hang', 'kiem hang'], 'Kho vận - Bốc xếp'],
  [['dong goi', 'phan loai', 'dan tem', 'dong thung'], 'Đóng gói - Phân loại'],
  [['nhua', 'bao bi', 'in an', 'ep nhua', 'thoi mang'], 'Nhựa - Bao bì - In ấn'],
  [['go', 'noi that', 'cha nham', 'son go', 'moc'], 'Gỗ - Nội thất'],
  [['bao ve', 'an ninh', 'giu xe'], 'Bảo vệ'],
  [['tap vu', 've sinh', 'lau don', 'giup viec'], 'Tạp vụ - Vệ sinh'],
  [['lai xe', 'tai xe', 'giao hang', 'shipper', 'xe tai', 'bang c', 'bang b2'], 'Lái xe - Giao hàng'],
  [['phu bep', 'phuc vu', 'rua chen', 'bep', 'nau an'], 'Phụ bếp - Phục vụ'],
  [['phu ho', 'xay dung', 'tho ho', 'cong trinh', 'son nha', 'thach cao'], 'Xây dựng'],
  [['pha che', 'barista', 'bartender', 'chay ban', 'quan cafe', 'tra sua'], 'Phục vụ - Pha chế'],
  [['ban hang', 'thu ngan', 'tap hoa', 'sieu thi', 'cua hang tien loi', 'circle k'], 'Bán hàng - Thu ngân'],
  [['gia su', 'day kem', 'tro giang'], 'Gia sư'],
  [['pg', 'pb', 'su kien', 'phat to roi', 'mau anh'], 'Sự kiện - PG/PB'],
  [['nhap lieu', 'van phong', 'danh may', 'excel'], 'Nhập liệu - Văn phòng'],
  [['cskh', 'telesale', 'tong dai', 'cham soc khach hang', 'goi dien'], 'Chăm sóc khách hàng - Telesale'],
  [['ke toan', 'tai chinh', 'kiem toan'], 'Kế toán - Tài chính'],
  [['it', 'lap trinh', 'cntt', 'phan mem', 'web', 'tester'], 'Công nghệ thông tin'],
  [['marketing', 'truyen thong', 'content', 'mxh', 'thiet ke do hoa'], 'Marketing - Truyền thông'],
  [['nhan su', 'hanh chinh', 'tuyen dung'], 'Nhân sự - Hành chính'],
  [['xuat nhap khau', 'logistics', 'chung tu'], 'Logistics - Xuất nhập khẩu'],
  [['tieng anh', 'tieng nhat', 'tieng han', 'tieng trung', 'phien dich', 'bien dich'], 'Ngoại ngữ - Biên phiên dịch'],
];
/** Đợt 80 — hiểu chữ người dùng gõ tự do ("đứng máy", "bốc vác", "phụ hồ"…) thành nhóm việc của kênh. */
export function guessGroups(text: string, kind?: WorkerKind): string[] {
  const t = ` ${fold(text).replace(/[^a-z0-9 ]/g, ' ')} `;
  if (t.trim().length < 2) return [];
  const allowed = kind ? LABOR_GROUPS[kind] : null;
  const hits: { g: string; at: number }[] = [];
  for (const [words, g] of KEYWORDS) {
    if (allowed && !allowed.includes(g)) continue;
    let best = -1;
    for (const w of words) {
      const at = t.indexOf(` ${w} `);
      if (at >= 0 && (best < 0 || at < best)) best = at;
    }
    if (best >= 0) hits.push({ g, at: best });
  }
  // khớp thẳng tên nhóm
  for (const g of allowed ?? Object.values(LABOR_GROUPS).flat()) if (fold(g).includes(fold(text).trim()) && !hits.some((h) => h.g === g)) hits.push({ g, at: 999 });
  return hits.sort((a, b) => a.at - b.at).map((h) => h.g).slice(0, 3);
}

export const fmtM = (v: number) => `${v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`;

// ---------------- Đợt 84 — quy tắc riêng từng nhóm (khớp apps/api/src/workers/labor-groups.ts) ----------------
export const SHIFTS_BY_KIND: Record<WorkerKind, string[]> = { worker: SHIFTS, student: ['Cuối tuần', 'Theo giờ linh hoạt'], intern: [] };
/** Thực tập sinh làm giờ hành chính: T2–T6 sáng/chiều + T7 sáng, không có buổi tối và Chủ nhật. */
export const INTERN_SLOTS = [...['t2', 't3', 't4', 't5', 't6'].flatMap((d) => [`${d}-sang`, `${d}-chieu`]), 't7-sang'];
export const CERT_LABEL: Record<string, string> = { a1: 'Bằng A1', b2: 'Bằng B2', c: 'Bằng C', forklift: 'Chứng chỉ xe nâng', welding: 'Chứng chỉ hàn' };
export const EXPERIENCE_LABEL: Record<string, string> = { none: 'Chưa có kinh nghiệm', lt1: 'Dưới 1 năm', gte1: 'Từ 1 năm trở lên' };
export const HOURS_LABEL: Record<string, string> = { lt15: 'Dưới 15 giờ/tuần', '15-25': '15–25 giờ/tuần', gt25: 'Trên 25 giờ/tuần' };
export const MONTHS_OPTIONS = [1, 2, 3, 6];
export const MINOR_HEAVY_GROUPS = ['Xây dựng', 'Cơ khí - Hàn - Tiện', 'Bảo vệ', 'Kho vận - Bốc xếp', 'Chế biến thực phẩm', 'Lái xe - Giao hàng', 'Giao hàng'];
export const ageOfBirth = (bd: string) => Math.floor((Date.now() - new Date(bd).getTime()) / (365.25 * 864e5));
