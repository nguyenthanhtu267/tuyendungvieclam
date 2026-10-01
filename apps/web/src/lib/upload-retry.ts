import { ApiError } from './api';

// Đợt 111 — tải tệp lên mà đứt mạng giữa chừng: giữ tệp trong bộ nhớ trang, có mạng lại thì TỰ gửi lại (tối đa 3 lần).
// Lưu ý: chỉ giữ khi trang còn mở (không lưu tệp vào ổ đĩa).
export async function uploadWithRetry<T>(
  send: () => Promise<T>,
  onWaiting: () => void,
): Promise<T> {
  try {
    return await send();
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 0) throw e;
  }
  onWaiting();
  for (let i = 0; i < 3; i++) {
    if (navigator.onLine === false) {
      await new Promise<void>((res) => window.addEventListener('online', () => res(), { once: true }));
    } else {
      await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
    }
    try {
      return await send();
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 0 || i === 2) throw e;
    }
  }
  throw new ApiError('Không gửi được, vui lòng thử lại', 0);
}
