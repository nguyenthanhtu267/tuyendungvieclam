import type { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

// Đợt 91 — đếm số dòng theo nhóm trong MỘT truy vấn (GROUP BY) thay vì mỗi mục một truy vấn `count` (kiểu N+1).
// VD: danh sách 50 tin đăng của nhà tuyển dụng trước đây = 50 lần đếm hồ sơ; nay = 1. CSDL Supabase miễn phí chỉ có ít kết nối,
// nên bớt số truy vấn song song là bớt nguy cơ nghẽn khi nhiều người cùng mở trang.
export async function countByColumn<T extends ObjectLiteral>(
  repo: Repository<T>,
  property: string, // tên thuộc tính của entity, VD 'jobPostingId'
  ids: string[],
  extra?: (qb: SelectQueryBuilder<T>) => void,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const qb = repo
    .createQueryBuilder('t')
    .select(`t.${property}`, 'id')
    .addSelect('COUNT(*)', 'c')
    .where(`t.${property} IN (:...ids)`, { ids })
    .groupBy(`t.${property}`);
  extra?.(qb);
  const rows = await qb.getRawMany<{ id: string; c: string }>();
  rows.forEach((r) => out.set(String(r.id), Number(r.c)));
  return out;
}
