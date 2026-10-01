import JobSearchClient from './JobSearchClient';
import { buildJobQuery, type JobFacets, type JobListResponse } from '@/lib/api';
import { JOB_PAGE_SIZE, parseJobFilters } from '@/lib/job-filters';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Đợt 90 — dựng sẵn trang 8 tin đầu ở máy chủ web theo đúng bộ lọc trên địa chỉ trang (lưu đệm 30 giây).
// API chậm quá 3,5 giây → bỏ qua, trình duyệt tự tải như trước.
export default async function ViecLamPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const sp = new URLSearchParams();
  Object.entries(searchParams).forEach(([k, v]) => {
    if (typeof v === 'string') sp.set(k, v);
    else if (Array.isArray(v) && v[0] !== undefined) sp.set(k, v[0]);
  });
  const filters = parseJobFilters((k) => sp.get(k));
  const page = Number(sp.get('page') ?? '1');
  let initial: { key: string; data: JobListResponse } | null = null;
  let initialFacets: { key: string; data: JobFacets } | null = null;
  // Đợt 93 — danh sách tin + bộ lọc (tỉnh/ngành kèm số lượng) lấy SONG SONG ở máy chủ web → bộ lọc hiện ngay,
  // không phải chờ thêm 1 vòng gọi API sau khi trang tải xong.
  const key = sp.toString();
  const listQs = buildJobQuery({ ...filters, page, pageSize: JOB_PAGE_SIZE });
  const facetQs = buildJobQuery(filters);
  const [listRes, facetRes] = await Promise.allSettled([
    fetch(`${API}/jobs?${listQs}`, { next: { revalidate: 30 }, signal: AbortSignal.timeout(3500) }),
    fetch(`${API}/jobs/facets${facetQs ? `?${facetQs}` : ''}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(3500) }),
  ]);
  try {
    if (listRes.status === 'fulfilled' && listRes.value.ok) initial = { key, data: await listRes.value.json() };
  } catch {
    initial = null;
  }
  try {
    if (facetRes.status === 'fulfilled' && facetRes.value.ok) initialFacets = { key, data: await facetRes.value.json() };
  } catch {
    initialFacets = null;
  }
  return <JobSearchClient initial={initial} initialFacets={initialFacets} />;
}
