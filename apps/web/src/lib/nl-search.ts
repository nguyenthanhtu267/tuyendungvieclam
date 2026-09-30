import { INDUSTRIES, PROVINCES, SALARY_TIERS } from './catalogs';

// Đợt 40 — Hiểu câu tìm kiếm tự nhiên tiếng Việt ("kế toán ở Hà Nội lương trên 15 triệu") và
// đổi thành bộ lọc. Chạy hoàn toàn trên trình duyệt, không gọi dịch vụ ngoài.
export interface NlFilters {
  q?: string;
  provinces?: string[];
  industries?: string[];
  salaryTier?: number;
  postedWithin?: string;
  employmentType?: string;
  urgentOnly?: boolean;
}
export interface NlResult {
  filters: NlFilters;
  chips: string[]; // mô tả bằng chữ những gì đã hiểu
}

export const fold = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();

const PROVINCE_ALIAS: Record<string, string> = {
  hcm: 'Hồ Chí Minh', 'tp hcm': 'Hồ Chí Minh', 'tphcm': 'Hồ Chí Minh', 'sai gon': 'Hồ Chí Minh', 'tp.hcm': 'Hồ Chí Minh',
  hn: 'Hà Nội', 'ha noi': 'Hà Nội', 'da nang': 'Đà Nẵng',
};
const INDUSTRY_ALIAS: [RegExp, string][] = [
  [/\b(it|lap trinh|developer|dev|phan mem|software|cntt)\b/, 'CNTT / Phần mềm'],
  [/\b(ke toan|kiem toan)\b/, 'Kế toán / Kiểm toán'],
  [/\b(marketing|digital|seo)\b/, 'Marketing'],
  [/\b(nhan su|hr|tuyen dung vien)\b/, 'Nhân sự'],
  [/\b(kinh doanh|sale|sales|ban hang)\b/, 'Kinh doanh / Bán hàng'],
  [/\b(ngan hang)\b/, 'Ngân hàng'],
  [/\b(giao duc|giao vien|gia su)\b/, 'Giáo dục / Đào tạo'],
  [/\b(xay dung|kien truc su|ky su xay dung)\b/, 'Xây dựng'],
  [/\b(logistics|kho van)\b/, 'Logistics'],
  [/\b(thiet ke|designer|do hoa)\b/, 'Thiết kế / Mỹ thuật'],
  [/\b(y te|duoc si|dieu duong|bac si)\b/, 'Y tế / Dược'],
  [/\b(nha hang|khach san)\b/, 'Nhà hàng / Khách sạn'],
];

function pickTier(min: number): number {
  const vals = SALARY_TIERS.map((t) => t.value).filter((v) => v > 0);
  let best = 0;
  for (const v of vals) if (v <= min) best = v;
  return best;
}

export function parseNaturalQuery(input: string): NlResult {
  let text = ' ' + fold(input) + ' ';
  const filters: NlFilters = {};
  const chips: string[] = [];

  // Lương: "trên 15 triệu", "từ 15tr", "15-20 triệu", "lương 20tr"
  const salaryRe = /(?:luong\s*)?(?:tren|tu|hon|it nhat|>=?)?\s*(\d{1,3})(?:\s*-\s*\d{1,3})?\s*(?:trieu|tr\b|m\b)/;
  const sm = text.match(salaryRe);
  if (sm) {
    const tier = pickTier(Number(sm[1]));
    if (tier > 0) {
      filters.salaryTier = tier;
      chips.push(`Lương từ ${tier} triệu`);
      text = text.replace(sm[0], ' ');
    }
  }
  text = text.replace(/\bluong\b/g, ' ');

  // Tỉnh thành
  const provs: string[] = [];
  for (const [alias, name] of Object.entries(PROVINCE_ALIAS)) {
    const re = new RegExp(`(^|\\s)${alias.replace('.', '\\.')}(?=\\s|$)`);
    if (re.test(text) && !provs.includes(name)) {
      provs.push(name);
      text = text.replace(re, ' ');
    }
  }
  for (const p of [...PROVINCES].sort((a, b) => b.length - a.length)) {
    const fp = fold(p);
    if (fp.length < 4) continue;
    const re = new RegExp(`(^|\\s)${fp}(?=\\s|$)`);
    if (re.test(text) && !provs.includes(p)) {
      provs.push(p);
      text = text.replace(re, ' ');
    }
  }
  if (provs.length) {
    filters.provinces = provs;
    chips.push(provs.join(', '));
  }
  text = text.replace(/\b(tai|o|khu vuc|thanh pho|tp|tinh)\b/g, ' ');

  // Ngành: chỉ gán khi khớp; từ khoá vẫn giữ lại để tìm chính xác chức danh
  const inds: string[] = [];
  for (const [re, name] of INDUSTRY_ALIAS) if (re.test(text) && INDUSTRIES.includes(name)) inds.push(name);
  if (inds.length) {
    filters.industries = inds.slice(0, 1);
    chips.push(inds[0]);
  }

  // Loại hình, độ mới, khẩn
  if (/\b(thuc tap|intern)\b/.test(text)) { filters.employmentType = 'Thực tập'; chips.push('Thực tập'); }
  else if (/\b(part ?time|ban thoi gian|thoi vu)\b/.test(text)) { filters.employmentType = 'Thời vụ - Nghề tự do'; chips.push('Thời vụ / bán thời gian'); }
  if (/\b(hom nay|moi dang|moi nhat|24h)\b/.test(text)) { filters.postedWithin = '3d'; chips.push('Đăng trong 3 ngày'); }
  else if (/\b(tuan nay|7 ngay)\b/.test(text)) { filters.postedWithin = '7d'; chips.push('Đăng trong 7 ngày'); }
  if (/\b(gap|khan cap|tuyen gap)\b/.test(text)) { filters.urgentOnly = true; chips.push('Tuyển gấp'); }

  // Phần còn lại là từ khoá: dùng lại chữ gốc (có dấu) của người dùng, bỏ các cụm đã hiểu
  const stop = new Set(['tim', 'viec', 'cong', 'can', 'muon', 'tuyen', 'gap', 'moi', 'nhat', 'hom', 'nay', 'tuan', 'lam', 'cho', 'toi', 'nganh', 'part', 'time', 'thuc', 'tap', 'intern', 'thoi', 'vu', 'ban', 'khan', 'dang', 'va', 'la', 'co', 'nao']);
  const rest = text.split(' ').filter((w) => w && !stop.has(w) && !/^\d+$/.test(w));
  const origWords = input.split(/\s+/).filter((w) => rest.includes(fold(w)));
  const q = origWords.join(' ').trim();
  if (q) {
    filters.q = q;
    // Đã có từ khoá cụ thể thì không ép thêm bộ lọc ngành (tránh loại nhầm tin đúng chức danh)
    if (filters.industries) {
      const i = chips.indexOf(filters.industries[0]);
      if (i >= 0) chips.splice(i, 1);
      delete filters.industries;
    }
  }
  return { filters, chips };
}

export function nlToParams(f: NlFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.provinces?.length) p.set('provinces', f.provinces.join(','));
  if (f.industries?.length) p.set('industries', f.industries.join(','));
  if (f.salaryTier) p.set('salaryTier', String(f.salaryTier));
  if (f.postedWithin) p.set('postedWithin', f.postedWithin);
  if (f.employmentType) p.set('employmentType', f.employmentType);
  if (f.urgentOnly) p.set('urgentOnly', '1');
  return p;
}
