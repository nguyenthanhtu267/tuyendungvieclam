import { BadRequestException } from '@nestjs/common';
import { oldDistricts } from '../workers/vn-geo';

// Đợt 89 — chuẩn hoá DỮ LIỆU TIN ở phía máy chủ (không tin giao diện): lương luôn là TRIỆU ĐỒNG, min ≤ max,
// quận/huyện phải thuộc một trong các tỉnh đã chọn. Dùng chung cho NTD đăng/sửa tin và Admin đăng hộ.

/** 15000000 → 15 (triệu). Số < 1.000.000 coi là đã đúng đơn vị triệu. */
export function toMillions(v: number | null | undefined): number | null | undefined {
  if (v === null || v === undefined) return v;
  if (!Number.isFinite(v) || v <= 0) return null;
  return v >= 1_000_000 ? Math.round(v / 1_000_000) : Math.round(v);
}

/** Số lương dạng triệu (an toàn cho SQL/so sánh) — dùng cho thống kê. */
export const SQL_MILLIONS = (col: string) => `(CASE WHEN ${col} >= 100000 THEN ${col} / 1000000.0 ELSE ${col} END)`;

export function normalizeSalaryFields<T extends { salaryMin?: number | null; salaryMax?: number | null }>(o: T): T {
  if ('salaryMin' in o) o.salaryMin = toMillions(o.salaryMin) as number | null | undefined;
  if ('salaryMax' in o) o.salaryMax = toMillions(o.salaryMax) as number | null | undefined;
  if (o.salaryMin && o.salaryMax && o.salaryMin > o.salaryMax) [o.salaryMin, o.salaryMax] = [o.salaryMax, o.salaryMin];
  return o;
}

/** Quận/huyện không thuộc tỉnh đã chọn → báo lỗi rõ ràng (VD "Quận 7" khi chọn Bắc Ninh). Danh mục lạ/không có → bỏ qua. */
export function assertDistrictInProvinces(district?: string | null, provinces?: string[] | string | null) {
  const d = (district ?? '').trim();
  const list = (Array.isArray(provinces) ? provinces : String(provinces ?? '').split(',')).map((x) => x.trim()).filter(Boolean);
  if (!d || !list.length) return;
  const catalogs = list.map((p) => oldDistricts(p)).filter((c) => c.length > 0);
  if (!catalogs.length) return;
  const low = d.toLowerCase();
  if (catalogs.some((c) => c.some((x) => x.toLowerCase() === low))) return;
  throw new BadRequestException(`Quận/huyện "${d}" không thuộc ${list.join(', ')}. Hãy chọn lại quận/huyện của đúng tỉnh.`);
}
