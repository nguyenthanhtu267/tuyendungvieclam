/* Đợt 91 — Service worker của Tuyển Dụng Việc Làm.
 * Mục tiêu: mở lại web NHANH (tệp tĩnh lấy từ máy), không "trắng trang" khi mất mạng (hiện trang offline + việc đã lưu).
 * KHÔNG chặn/ghi nhớ lời gọi API (API ở máy chủ khác, luôn lấy dữ liệu mới). Đổi VERSION khi cần xoá sạch bộ nhớ đệm cũ. */
const VERSION = 'v150-1';
const STATIC = 'tvl-static-' + VERSION;
const PAGES = 'tvl-pages-' + VERSION;
const OFFLINE_URL = '/offline.html';
const MAX_PAGES = 24;
const MAX_STATIC = 120;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => c.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  const extra = keys.length - max;
  for (let i = 0; i < extra; i++) await c.delete(keys[i]); // cũ nhất trước
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:woff2?|png|jpe?g|webp|svg|ico)$/i.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API / ảnh ngoài: để trình duyệt tự xử lý
  if (url.pathname.startsWith('/api/')) return;

  // Tệp tĩnh (đã băm tên, không đổi nội dung) → lấy từ bộ nhớ trước.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          c.put(req, res.clone());
          trim(STATIC, MAX_STATIC);
        }
        return res;
      }),
    );
    return;
  }

  // Mở trang: ưu tiên mạng (luôn mới); mạng chậm >3,5s mà đã có bản cũ → cho xem bản cũ trước; mất mạng → trang offline.
  if (req.mode === 'navigate') {
    const skipCache = url.pathname.startsWith('/admin') || url.pathname.startsWith('/nha-tuyen-dung');
    event.respondWith(
      (async () => {
        const c = await caches.open(PAGES);
        const cached = skipCache ? undefined : await c.match(req);
        const net = fetch(req).then((res) => {
          if (res.ok && !skipCache) {
            c.put(req, res.clone());
            trim(PAGES, MAX_PAGES + 1);
          }
          return res;
        });
        try {
          if (!cached) return await net;
          return await Promise.race([net, new Promise((resolve) => setTimeout(() => resolve(cached), 3500))]);
        } catch (_) {
          return cached || (await c.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
  }
});
