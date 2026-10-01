// Đợt 87 — vùng lương tối thiểu ước tính theo tỉnh (khớp apps/api/src/workers/min-wage.ts) — dùng để tính lương thực nhận.
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const R1 = ['ha noi', 'ho chi minh', 'hai phong', 'binh duong', 'dong nai', 'ba ria vung tau', 'da nang'];
const R2 = ['bac ninh', 'hai duong', 'hung yen', 'vinh phuc', 'quang ninh', 'thai nguyen', 'bac giang', 'long an', 'tay ninh', 'binh phuoc', 'khanh hoa', 'lam dong', 'can tho', 'ha nam', 'phu tho', 'quang nam', 'thua thien hue', 'nam dinh', 'thai binh'];
const R3 = ['thanh hoa', 'nghe an', 'ha tinh', 'quang binh', 'quang tri', 'quang ngai', 'binh dinh', 'phu yen', 'binh thuan', 'dak lak', 'gia lai', 'tien giang', 'ben tre', 'vinh long', 'an giang', 'kien giang', 'ca mau', 'ninh binh', 'lao cai', 'hoa binh', 'tuyen quang', 'lang son', 'soc trang', 'tra vinh', 'hau giang', 'dong thap', 'bac lieu', 'ninh thuan'];
export function regionOfProvince(p?: string | null): 1 | 2 | 3 | 4 {
  const f = fold(p ?? '');
  const has = (l: string[]) => l.some((x) => f.includes(x));
  return has(R1) ? 1 : has(R2) ? 2 : has(R3) ? 3 : 4;
}
