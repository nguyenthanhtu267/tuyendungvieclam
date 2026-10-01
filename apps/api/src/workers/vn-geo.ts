import { readFileSync } from 'fs';
import { join } from 'path';

// Đợt 79 — địa giới hành chính VN: 63 tỉnh cũ → quận/huyện cũ → phường/xã cũ, quy đổi sang phường/xã mới
// (NQ 202/2025/QH15). Nguồn: gói npm vietnam-address-database@1.0.0 (bảng ward_mappings), rút gọn thành vn-geo.json.
// Không có toạ độ phường/xã ⇒ khoảng cách ước tính theo cấp hành chính + toạ độ trung tâm tỉnh; nếu cả hai bên
// có toạ độ GPS (bấm "Dùng vị trí hiện tại") thì tính km thật theo đường chim bay.
interface GeoFile {
  old: Record<string, Record<string, [string, string][]>>; // tỉnh → huyện → [phường cũ, mã phường mới]
  new: Record<string, [string, string]>; // mã phường mới → [tên, tỉnh mới]
}

let cache: { g: GeoFile; byNew: Map<string, Set<string>>; newOfProv: Map<string, Set<string>> } | null = null;
function load() {
  if (cache) return cache;
  const g = JSON.parse(readFileSync(join(__dirname, 'vn-geo.json'), 'utf8')) as GeoFile;
  const byNew = new Map<string, Set<string>>(); // mã mới → {"tỉnh|huyện"}
  const newOfProv = new Map<string, Set<string>>();
  for (const [p, ds] of Object.entries(g.old)) {
    const set = new Set<string>();
    for (const [d, ws] of Object.entries(ds)) {
      for (const [, code] of ws) {
        set.add(code);
        if (!byNew.has(code)) byNew.set(code, new Set());
        byNew.get(code)!.add(`${p}|${d}`);
      }
    }
    newOfProv.set(p, set);
  }
  cache = { g, byNew, newOfProv };
  return cache;
}

const collator = new Intl.Collator('vi');
export function geoProvinces() {
  return Object.keys(load().g.old).sort(collator.compare);
}
export function oldDistricts(province: string) {
  return Object.keys(load().g.old[province] ?? {}).sort(collator.compare);
}
export function oldWards(province: string, district: string) {
  return (load().g.old[province]?.[district] ?? []).map((w) => w[0]).sort(collator.compare);
}
export function newWards(province: string) {
  const c = load();
  return Array.from(c.newOfProv.get(province) ?? [])
    .map((code) => ({ code, name: c.g.new[code]?.[0] ?? code }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

export interface ResolvedPlace {
  province: string;
  oldDistrict: string | null;
  oldWard: string | null;
  newWardCode: string | null;
  newWard: string | null;
}
/** Kiểm tra & quy đổi địa chỉ (cũ hoặc mới) về mã phường/xã mới. Trả null nếu không hợp lệ. */
export function resolvePlace(input: { province: string; mode?: string; oldDistrict?: string | null; oldWard?: string | null; newWardCode?: string | null }): ResolvedPlace | null {
  const c = load();
  const prov = c.g.old[input.province];
  if (!prov) return null;
  if (input.mode === 'new') {
    if (!input.newWardCode) return { province: input.province, oldDistrict: null, oldWard: null, newWardCode: null, newWard: null };
    if (!c.newOfProv.get(input.province)?.has(input.newWardCode)) return null;
    return { province: input.province, oldDistrict: null, oldWard: null, newWardCode: input.newWardCode, newWard: c.g.new[input.newWardCode]?.[0] ?? null };
  }
  if (!input.oldDistrict) return { province: input.province, oldDistrict: null, oldWard: null, newWardCode: null, newWard: null };
  const ws = prov[input.oldDistrict];
  if (!ws) return null;
  if (!input.oldWard) return { province: input.province, oldDistrict: input.oldDistrict, oldWard: null, newWardCode: null, newWard: null };
  const hit = ws.find((w) => w[0] === input.oldWard);
  if (!hit) return null;
  return { province: input.province, oldDistrict: input.oldDistrict, oldWard: hit[0], newWardCode: hit[1], newWard: c.g.new[hit[1]]?.[0] ?? null };
}

/** Các quận/huyện cũ ứng với một vị trí (để so "cùng quận/huyện"). */
function districtsOf(p: { province: string; oldDistrict?: string | null; newWardCode?: string | null }): Set<string> {
  if (p.oldDistrict) return new Set([`${p.province}|${p.oldDistrict}`]);
  if (p.newWardCode) return load().byNew.get(p.newWardCode) ?? new Set();
  return new Set();
}

// Toạ độ trung tâm tỉnh (giống apps/web/src/lib/geo.ts)
const PC: Record<string, [number, number]> = {
  'Hà Nội': [21.03, 105.85], 'Hồ Chí Minh': [10.78, 106.7], 'An Giang': [10.38, 105.44], 'Bạc Liêu': [9.29, 105.72],
  'Bến Tre': [10.24, 106.38], 'Cà Mau': [9.18, 105.15], 'Cần Thơ': [10.03, 105.78], 'Đồng Tháp': [10.46, 105.63],
  'Hậu Giang': [9.78, 105.47], 'Kiên Giang': [10.01, 105.08], 'Long An': [10.54, 106.41], 'Sóc Trăng': [9.6, 105.97],
  'Tiền Giang': [10.36, 106.36], 'Trà Vinh': [9.93, 106.34], 'Vĩnh Long': [10.25, 105.97], 'Bắc Ninh': [21.19, 106.08],
  'Hà Nam': [20.54, 105.91], 'Hải Dương': [20.94, 106.33], 'Hải Phòng': [20.86, 106.68], 'Hưng Yên': [20.65, 106.05],
  'Nam Định': [20.43, 106.18], 'Ninh Bình': [20.25, 105.97], 'Thái Bình': [20.45, 106.34], 'Vĩnh Phúc': [21.31, 105.6],
  'Hà Tĩnh': [18.34, 105.91], 'Nghệ An': [18.68, 105.68], 'Quảng Bình': [17.47, 106.6], 'Quảng Trị': [16.82, 107.1],
  'Thanh Hóa': [19.81, 105.78], 'Thừa Thiên Huế': [16.46, 107.59], 'Bắc Giang': [21.27, 106.19], 'Bắc Kạn': [22.15, 105.83],
  'Cao Bằng': [22.67, 106.26], 'Hà Giang': [22.82, 104.98], 'Lạng Sơn': [21.85, 106.76], 'Phú Thọ': [21.32, 105.4],
  'Quảng Ninh': [20.95, 107.08], 'Thái Nguyên': [21.59, 105.85], 'Tuyên Quang': [21.82, 105.21],
  'Bà Rịa - Vũng Tàu': [10.5, 107.17], 'Bình Dương': [10.98, 106.65], 'Bình Phước': [11.54, 106.9], 'Đồng Nai': [10.95, 106.82],
  'Tây Ninh': [11.31, 106.1], 'Bình Định': [13.78, 109.22], 'Bình Thuận': [10.93, 108.1], 'Đà Nẵng': [16.05, 108.2],
  'Khánh Hòa': [12.24, 109.19], 'Ninh Thuận': [11.56, 108.99], 'Phú Yên': [13.09, 109.3], 'Quảng Nam': [15.57, 108.47],
  'Quảng Ngãi': [15.12, 108.8], 'Điện Biên': [21.39, 103.02], 'Hòa Bình': [20.82, 105.34], 'Lai Châu': [22.4, 103.46],
  'Lào Cai': [22.48, 103.97], 'Sơn La': [21.33, 103.91], 'Yên Bái': [21.72, 104.9], 'Đắk Lắk': [12.67, 108.04],
  'Đắk Nông': [12.0, 107.69], 'Gia Lai': [13.98, 108.0], 'Kon Tum': [14.35, 108.0], 'Lâm Đồng': [11.94, 108.44],
};

export function haversineKm(a: [number, number], b: [number, number]) {
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(b[0] - a[0]);
  const dLon = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export interface Loc {
  province: string;
  oldDistrict?: string | null;
  newWardCode?: string | null;
  lat?: number | null;
  lon?: number | null;
}
/** Độ gần: km ước tính (để so với bán kính ứng viên chọn) + nhãn dễ hiểu + có phải km thật hay không. */
export function proximity(a: Loc, b: Loc): { km: number; label: string; exact: boolean } {
  if (a.lat != null && a.lon != null && b.lat != null && b.lon != null) {
    const km = Math.round(haversineKm([a.lat, a.lon], [b.lat, b.lon]) * 10) / 10;
    return { km, label: `~${km < 1 ? '<1' : Math.round(km)} km`, exact: true };
  }
  if (a.newWardCode && a.newWardCode === b.newWardCode) return { km: 2, label: 'Cùng phường/xã', exact: false };
  const da = districtsOf(a);
  const db = districtsOf(b);
  for (const d of da) if (db.has(d)) return { km: 7, label: 'Cùng quận/huyện', exact: false };
  if (a.province === b.province) return { km: 20, label: 'Cùng tỉnh/thành', exact: false };
  const pa = PC[a.province];
  const pb = PC[b.province];
  if (!pa || !pb) return { km: 999, label: 'Khác tỉnh', exact: false };
  const km = Math.round(haversineKm(pa, pb));
  return { km: Math.max(km, 25), label: `Khác tỉnh · ~${km} km`, exact: false };
}

/** Đoán tỉnh từ một chuỗi địa chỉ tự do (vd địa chỉ công ty). */
export function guessProvince(text?: string | null): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  const alias: [string, string][] = [['tp.hcm', 'Hồ Chí Minh'], ['tp hcm', 'Hồ Chí Minh'], ['sài gòn', 'Hồ Chí Minh'], ['hcm', 'Hồ Chí Minh'], ['huế', 'Thừa Thiên Huế'], ['vũng tàu', 'Bà Rịa - Vũng Tàu']];
  // ưu tiên tên tỉnh xuất hiện cuối chuỗi (địa chỉ VN viết từ nhỏ đến lớn)
  let best: { p: string; at: number } | null = null;
  for (const p of Object.keys(PC)) {
    const at = t.lastIndexOf(p.toLowerCase());
    if (at >= 0 && (!best || at > best.at)) best = { p, at };
  }
  if (best) return best.p;
  for (const [k, p] of alias) if (t.includes(k)) return p;
  return null;
}

/** Quận/huyện cũ đại diện cho một vị trí (để gom nhóm thống kê nguồn lao động). */
export function districtLabel(p: { province: string; oldDistrict?: string | null; newWardCode?: string | null }): string {
  if (p.oldDistrict) return p.oldDistrict;
  const set = p.newWardCode ? load().byNew.get(p.newWardCode) : null;
  const first = set ? Array.from(set).find((x) => x.startsWith(`${p.province}|`)) : null;
  return first ? first.split('|')[1] : 'Chưa rõ quận/huyện';
}
export function provinceCentroid(p: string) {
  return PC[p] ?? null;
}
/** Chuẩn hoá vị trí nơi làm việc của tin (giống địa chỉ ứng viên). */
export function resolveWorkPlace(v: unknown) {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const r = resolvePlace({ province: String(o.province ?? ''), mode: String(o.mode ?? 'old'), oldDistrict: (o.oldDistrict as string) || null, oldWard: (o.oldWard as string) || null, newWardCode: (o.newWardCode as string) || null });
  if (!r) return null;
  const num = (x: unknown, lo: number, hi: number) => (typeof x === 'number' && x >= lo && x <= hi ? x : null);
  return { province: r.province, mode: (o.mode === 'new' ? 'new' : 'old') as 'old' | 'new', oldDistrict: r.oldDistrict, oldWard: r.oldWard, newWardCode: r.newWardCode, newWard: r.newWard, lat: num(o.lat, 8, 24), lon: num(o.lon, 102, 110) };
}
