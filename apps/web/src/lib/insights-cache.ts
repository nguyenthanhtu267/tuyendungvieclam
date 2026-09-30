import { smartApi, type JobInsights } from './api';

// Đợt 65 — dùng chung 1 lần gọi /jobs/:id/insights cho nhiều khối trên trang tin.
const cache = new Map<string, Promise<JobInsights | null>>();
export function getJobInsights(token: string, jobId: string): Promise<JobInsights | null> {
  const k = `${jobId}`;
  let p = cache.get(k);
  if (!p) {
    p = smartApi.jobInsights(token, jobId).catch(() => null);
    cache.set(k, p);
    if (cache.size > 30) cache.delete(cache.keys().next().value as string);
  }
  return p;
}
