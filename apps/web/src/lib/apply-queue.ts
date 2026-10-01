// Đợt 109 — hàng chờ ứng tuyển: bấm nộp lúc mạng đứt → lưu ở máy, có mạng lại thì tự gửi.
import { applicationsApi, ApiError } from './api';

const KEY = 'tvl_apply_queue';
export type QueuedApply = {
  jobId: string;
  title: string;
  at: number;
  dto: { cvId?: string; useOnlineProfile?: boolean; coverLetter?: string; screeningAnswers?: string[] };
};

export function readQueue(): QueuedApply[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function save(q: QueuedApply[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q.slice(-10)));
  } catch {
    /* bỏ qua */
  }
  window.dispatchEvent(new Event('tvl-apply-queue'));
}
export function enqueueApply(item: QueuedApply) {
  save([...readQueue().filter((x) => x.jobId !== item.jobId), item]);
}
export function isQueued(jobId: string): boolean {
  return readQueue().some((x) => x.jobId === jobId);
}
export function dropQueued(jobId: string) {
  save(readQueue().filter((x) => x.jobId !== jobId));
}

let flushing = false;
// Trả về danh sách kết quả để hiện thông báo.
export async function flushQueue(token: string): Promise<{ title: string; ok: boolean; msg: string }[]> {
  if (flushing) return [];
  flushing = true;
  const out: { title: string; ok: boolean; msg: string }[] = [];
  try {
    for (const it of readQueue()) {
      try {
        await applicationsApi.apply(token, it.jobId, it.dto);
        dropQueued(it.jobId);
        out.push({ title: it.title, ok: true, msg: 'Đã gửi hồ sơ' });
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) break; // vẫn chưa có mạng — giữ lại, thử sau
        if (e instanceof ApiError && (e.status === 401 || e.status >= 500)) break;
        dropQueued(it.jobId); // lỗi rõ ràng (đã nộp rồi, tin hết hạn…) — bỏ khỏi hàng chờ và báo lý do
        out.push({ title: it.title, ok: false, msg: e instanceof Error ? e.message : 'Không gửi được' });
      }
    }
  } finally {
    flushing = false;
  }
  return out;
}
