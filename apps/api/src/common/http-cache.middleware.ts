import type { NextFunction, Request, Response } from 'express';
import { loadMonitor } from './load-monitor';

// Đợt 90 — bộ nhớ đệm cho dữ liệu CÔNG KHAI ít thay đổi (thống kê trang chủ, cài đặt nền, danh mục tỉnh/ngành…):
// 1) gắn Cache-Control để trình duyệt / CDN dùng lại trong vài phút;
// 2) giữ kết quả trong RAM máy chủ ngắn hạn → nhiều khách cùng lúc không bắt CSDL tính lại.
// Chỉ áp cho GET không kèm đăng nhập; mọi thứ khác đi thẳng như cũ.
const RULES: { re: RegExp; ttl: number; mem?: number; query?: RegExp }[] = [
  { re: /^\/public\/workers\/(catalog|geo\/)/, ttl: 86400 },
  { re: /^\/public\/settings\//, ttl: 120 },
  { re: /^\/public\/promos$/, ttl: 120 },
  { re: /^\/public\/boot$/, ttl: 120 },
  { re: /^\/jobs\/stats\//, ttl: 120 },
  { re: /^\/jobs\/featured-employers$/, ttl: 300 },
  { re: /^\/jobs\/facets$/, ttl: 60 },
  { re: /^\/jobs\/district-facets$/, ttl: 60 },
  { re: /^\/jobs\/province-insights$/, ttl: 120 },
  { re: /^\/jobs\/home-bundle$/, ttl: 60 },
  // Đợt 94 — danh sách tin (tìm việc) và chi tiết tin (chỉ khi ?noview=1, tức không cần đếm lượt xem): giữ ngắn 15 giây — đủ để một
  // đợt khách vào cùng lúc với cùng bộ lọc chỉ chạm CSDL 1 lần, mà tin mới đăng vẫn hiện sau chưa tới 15 giây.
  { re: /^\/jobs$/, ttl: 15, mem: 15 },
  { re: /^\/jobs\/[0-9a-f-]{36}$/i, ttl: 15, mem: 15, query: /(^|&)noview=1(&|$)/ },
];
const MAX_ENTRIES = 500;
const mem = new Map<string, { exp: number; body: string; type: string }>();
// Đợt 94 — gộp yêu cầu trùng: nhiều người cùng gọi 1 địa chỉ khi bộ nhớ đệm đang trống → chỉ yêu cầu đầu tiên chạy, những người sau
// chờ nó xong rồi nhận cùng kết quả (thay vì cùng lúc đổ vào CSDL — "cache stampede").
const pending = new Map<string, Promise<void>>();

export function httpCache(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' || req.headers.authorization) return next();
  const path = req.path;
  const rule = RULES.find((r) => r.re.test(path) && (!r.query || r.query.test(req.originalUrl.split('?')[1] ?? '')));
  if (!rule) return next();
  // s-maxage: bộ đệm biên (Vercel/CDN) dùng; max-age: trình duyệt dùng.
  res.setHeader('Cache-Control', `public, max-age=${rule.ttl}, s-maxage=${rule.ttl}, stale-while-revalidate=${rule.ttl * 5}`);
  const key = req.originalUrl;
  // Quá tải → dùng bản cũ lâu hơn (×4) để dành CPU cho việc khác.
  const memTtl = Math.min(rule.mem ?? rule.ttl, 60) * 1000 * (loadMonitor.level() >= 1 ? 4 : 1);
  const serve = (hit: { body: string; type: string }) => {
    res.setHeader('Content-Type', hit.type);
    res.setHeader('X-Cache', 'HIT');
    res.status(200).send(hit.body);
  };
  const hit = mem.get(key);
  if (hit && hit.exp > Date.now()) return serve(hit);
  if (hit && loadMonitor.level() >= 2) return serve(hit); // quá tải: thà trả bản cũ còn hơn không trả kịp

  const wait = pending.get(key);
  if (wait) {
    // Đã có người đang lấy cùng dữ liệu → chờ (tối đa 8s) rồi dùng kết quả của họ.
    void Promise.race([wait, new Promise<void>((r) => setTimeout(r, 8000))]).then(() => {
      const h2 = mem.get(key);
      if (h2) serve(h2);
      else next();
    });
    return;
  }
  let done!: () => void;
  pending.set(key, new Promise<void>((r) => (done = r)));
  const release = () => {
    pending.delete(key);
    done();
  };
  res.on('finish', release);
  res.on('close', release);
  const send = res.send.bind(res);
  res.send = ((body?: unknown) => {
    if (res.statusCode === 200 && typeof body === 'string') {
      if (mem.size >= MAX_ENTRIES) mem.delete(mem.keys().next().value as string);
      mem.set(key, { exp: Date.now() + memTtl, body, type: String(res.getHeader('Content-Type') ?? 'application/json; charset=utf-8') });
    }
    return send(body);
  }) as Response['send'];
  next();
}
