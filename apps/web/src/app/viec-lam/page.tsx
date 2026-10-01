import JobSearchClient from './JobSearchClient';
import { buildJobQuery, type JobListResponse } from '@/lib/api';
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
  try {
    const qs = buildJobQuery({ ...filters, page, pageSize: JOB_PAGE_SIZE });
    const res = await fetch(`${API}/jobs?${qs}`, { next: { revalidate: 30 }, signal: AbortSignal.timeout(3500) });
    if (res.ok) initial = { key: sp.toString(), data: await res.json() };
  } catch {
    initial = null;
  }
  return <JobSearchClient initial={initial} />;
}
