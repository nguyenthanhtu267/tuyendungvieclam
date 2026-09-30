// Đợt 52 — "Tin vừa xem": ghi nhớ tối đa 10 tin ứng viên xem gần nhất (lưu trên trình duyệt, không cần đăng nhập).
export interface RecentJob {
  id: string;
  title: string;
  company: string;
  at: number;
}
const KEY = 'tvl_recent_jobs';
const MAX = 10;

export function readRecentJobs(): RecentJob[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => x && x.id && x.title) : [];
  } catch {
    return [];
  }
}

export function pushRecentJob(j: { id: string; title: string; company: string }) {
  try {
    const list = readRecentJobs().filter((x) => x.id !== j.id);
    list.unshift({ ...j, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* bỏ qua */
  }
}

export function clearRecentJobs() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* bỏ qua */
  }
}
