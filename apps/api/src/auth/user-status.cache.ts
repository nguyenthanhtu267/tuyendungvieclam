// Đợt 18e (26/09/2026) — bộ nhớ đệm ngắn (30 giây) trạng thái + vai trò tài khoản cho JwtStrategy, để
// Admin "Khoá tài khoản" có hiệu lực NGAY (trước đây token cũ vẫn dùng được tới khi hết hạn 7 ngày, và
// đăng nhập cũng không hề kiểm tra trạng thái) mà không phải truy vấn CSDL ở MỌI request.
type Entry = { status: string; role: string; at: number };

const TTL_MS = 30_000;
const cache = new Map<string, Entry>();

export const UserStatusCache = {
  get(userId: string): Entry | undefined {
    const e = cache.get(userId);
    if (!e) return undefined;
    if (Date.now() - e.at > TTL_MS) {
      cache.delete(userId);
      return undefined;
    }
    return e;
  },
  set(userId: string, status: string, role: string) {
    if (cache.size > 20_000) cache.clear();
    cache.set(userId, { status, role, at: Date.now() });
  },
  invalidate(userId: string) {
    cache.delete(userId);
  },
};
