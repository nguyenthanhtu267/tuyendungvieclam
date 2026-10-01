// Đợt 83 — lương tối thiểu vùng theo Nghị định 293/2025/NĐ-CP (hiệu lực từ 01/01/2026).
// Vùng thật được xác định theo phường/xã; ở đây ước tính theo TỈNH (danh sách nhỏ, chắc chắn) — tỉnh không có
// trong danh sách tính theo vùng IV (mức thấp nhất) để tránh báo nhầm.
export const MIN_MONTH: Record<number, number> = { 1: 5_310_000, 2: 4_730_000, 3: 4_140_000, 4: 3_700_000 };
export const MIN_HOUR: Record<number, number> = { 1: 25_500, 2: 22_700, 3: 20_000, 4: 17_800 };

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const R1 = ['ha noi', 'ho chi minh', 'hai phong', 'binh duong', 'dong nai', 'ba ria vung tau', 'da nang'];
const R2 = ['bac ninh', 'hai duong', 'hung yen', 'vinh phuc', 'quang ninh', 'thai nguyen', 'bac giang', 'long an', 'tay ninh', 'binh phuoc', 'khanh hoa', 'lam dong', 'can tho', 'ha nam', 'phu tho', 'quang nam', 'thua thien hue', 'nam dinh', 'thai binh'];
const R3 = ['thanh hoa', 'nghe an', 'ha tinh', 'quang binh', 'quang tri', 'quang ngai', 'binh dinh', 'phu yen', 'binh thuan', 'dak lak', 'gia lai', 'tien giang', 'ben tre', 'vinh long', 'an giang', 'kien giang', 'ca mau', 'ninh binh', 'lao cai', 'hoa binh', 'tuyen quang', 'lang son', 'soc trang', 'tra vinh', 'hau giang', 'dong thap', 'bac lieu', 'ninh thuan'];

export function regionOf(province?: string | null): 1 | 2 | 3 | 4 {
  const f = fold(province ?? '');
  const has = (l: string[]) => l.some((x) => f.includes(x));
  if (has(R1)) return 1;
  if (has(R2)) return 2;
  if (has(R3)) return 3;
  return 4;
}
export function minWageOf(province?: string | null) {
  const region = regionOf(province);
  return { region, month: MIN_MONTH[region], hour: MIN_HOUR[region], known: region < 4 };
}
/** Cảnh báo nếu lương cơ bản (triệu/tháng) thấp hơn mức tối thiểu vùng ước tính. */
export function wageWarning(province: string | undefined | null, baseMillion: number | null | undefined): string | null {
  if (!baseMillion || baseMillion <= 0) return null;
  const m = minWageOf(province);
  if (baseMillion * 1_000_000 + 1 < m.month) {
    const f = (v: number) => (v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    return `Lương cơ bản ${baseMillion.toLocaleString('vi-VN')} triệu thấp hơn lương tối thiểu vùng ${m.region} (${f(m.month)} triệu/tháng, từ 01/2026)`;
  }
  return null;
}
