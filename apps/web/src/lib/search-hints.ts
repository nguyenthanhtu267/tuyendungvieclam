// Đợt 87 — gợi ý tìm kiếm: khôi phục dấu tiếng Việt ("ke toan" → "kế toán"), viết tắt tỉnh/chức danh, nhớ 5 lần tìm gần nhất.
import { INDUSTRIES, PROVINCE_REGIONS } from './catalogs';

export const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const TITLES = [
  'Kế toán', 'Kế toán tổng hợp', 'Kế toán trưởng', 'Kiểm toán', 'Nhân viên kinh doanh', 'Nhân viên bán hàng', 'Chăm sóc khách hàng', 'Telesales', 'Marketing', 'Digital Marketing',
  'Content Marketing', 'Lập trình viên', 'Kỹ sư phần mềm', 'Tester', 'Nhân viên hành chính', 'Hành chính nhân sự', 'Tuyển dụng', 'Thiết kế đồ hoạ', 'Biên phiên dịch', 'Tài xế',
  'Giao hàng', 'Nhân viên kho', 'Xuất nhập khẩu', 'Thủ kho', 'Bảo vệ', 'Phục vụ', 'Pha chế', 'Đầu bếp', 'Lễ tân', 'Thu ngân', 'Quản lý cửa hàng', 'Giám sát bán hàng',
  'Kỹ sư xây dựng', 'Kỹ sư cơ khí', 'Kỹ thuật viên điện', 'Công nhân', 'Giáo viên', 'Gia sư', 'Dược sĩ', 'Điều dưỡng', 'Trợ lý giám đốc', 'Thư ký', 'Phân tích dữ liệu', 'Quản trị mạng',
  'Nhân viên thiết kế', 'Biên tập viên', 'Quản lý dự án', 'Thực tập sinh',
];
const ABBR: Record<string, string> = {
  hcm: 'Hồ Chí Minh', sg: 'Hồ Chí Minh', tphcm: 'Hồ Chí Minh', hn: 'Hà Nội', dn: 'Đà Nẵng', bn: 'Bắc Ninh', hp: 'Hải Phòng', ct: 'Cần Thơ', bd: 'Bình Dương',
  cskh: 'Chăm sóc khách hàng', nvkd: 'Nhân viên kinh doanh', hr: 'Nhân sự', it: 'Công nghệ thông tin', kt: 'Kế toán', mkt: 'Marketing', ptdl: 'Phân tích dữ liệu', dev: 'Lập trình viên',
};

let POOL: string[] | null = null;
function pool() {
  if (!POOL) POOL = Array.from(new Set([...TITLES, ...(INDUSTRIES as string[]), ...PROVINCE_REGIONS.flatMap((r) => r.provinces)]));
  return POOL;
}

/** Gợi ý khi người dùng gõ không dấu / viết tắt. Trả về các cụm có dấu khác với chữ đã gõ. */
export function suggestQuery(q: string): string[] {
  const raw = q.trim();
  if (raw.length < 2) return [];
  const f = fold(raw);
  const out: string[] = [];
  const ab = ABBR[f];
  if (ab) out.push(ab);
  for (const item of pool()) {
    const fi = fold(item);
    if (item.toLowerCase() === raw.toLowerCase()) continue;
    if (fi === f || fi.startsWith(f) || (f.length >= 4 && fi.includes(f))) out.push(item);
    if (out.length >= 6) break;
  }
  return Array.from(new Set(out)).filter((x) => x.toLowerCase() !== raw.toLowerCase()).slice(0, 5);
}

const KEY = 'tvl_recent_searches';
export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}
export function rememberSearch(q: string) {
  const t = q.trim();
  if (t.length < 2) return;
  try {
    const next = [t, ...readRecent().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 5);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* bỏ qua */ }
}
export function clearRecent() {
  try { localStorage.removeItem(KEY); } catch { /* bỏ qua */ }
}
