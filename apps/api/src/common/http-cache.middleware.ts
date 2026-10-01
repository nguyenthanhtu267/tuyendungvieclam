import type { NextFunction, Request, Response } from 'express';

// Đợt 90 — bộ nhớ đệm cho dữ liệu CÔNG KHAI ít thay đổi (thống kê trang chủ, cài đặt nền, danh mục tỉnh/ngành…):
// 1) gắn Cache-Control để trình duyệt / CDN dùng lại trong vài phút;
// 2) giữ kết quả trong RAM máy chủ ngắn hạn → nhiều khách cùng lúc không bắt CSDL tính lại.
// Chỉ áp cho GET không kèm đăng nhập; mọi thứ khác đi thẳng như cũ.
const RULES: { re: RegExp; ttl: number }[] = [
  { re: /^\/public\/workers\/(catalog|geo\/)/, ttl: 86400 },
  { re: /^\/public\/settings\//, ttl: 120 },
  { re: /^\/public\/promos$/, ttl: 120 },
  { re: /^\/jobs\/stats\//, ttl: 120 },
  { re: /^\/jobs\/featured-employers$/, ttl: 300 },
  { re: /^\/jobs\/facets$/, ttl: 60 },
  { re: /^\/jobs\/district-facets$/, ttl: 60 },
  { re: /^\/jobs\/province-insights$/, ttl: 120 },
  { re: /^\/jobs\/home-bundle$/, ttl: 60 },
];
const MAX_ENTRIES = 500;
const mem = new Map<string, { exp: number; body: string; type: string }>();

export function httpCache(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' || req.headers.authorization) return next();
  const path = req.path;
  const rule = RULES.find((r) => r.re.test(path));
  if (!rule) return next();
  res.setHeader('Cache-Control', `public, max-age=${rule.ttl}, stale-while-revalidate=${rule.ttl * 5}`);
  const key = req.originalUrl;
  const hit = mem.get(key);
  const memTtl = Math.min(rule.ttl, 60) * 1000; // RAM chỉ giữ tối đa 60 giây để số liệu không cũ
  if (hit && hit.exp > Date.now()) {
    res.setHeader('Content-Type', hit.type);
    res.setHeader('X-Cache', 'HIT');
    res.status(200).send(hit.body);
    return;
  }
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
