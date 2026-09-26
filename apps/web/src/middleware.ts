import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';

// Đợt 19 (26/09/2026) — bot/công cụ tự động (Googlebot, xem trước link Facebook/Zalo...) thường KHÔNG chạy
// JavaScript nên bộ ghi truy cập trong trình duyệt không thấy chúng. Middleware này chỉ báo về API khi
// User-Agent giống bot (API phân loại chính xác), để Admin biết bot nào ghé — KHÔNG tính vào số liệu
// người thật. Người dùng thật không bị ảnh hưởng (không chờ, không gọi thêm gì).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const BOT_HINT = /bot|crawl|spider|slurp|facebookexternalhit|meta-externalagent|preview|lighthouse|pagespeed|headless|curl|wget|python|axios|go-http|okhttp|scrapy|gptbot|bytespider/i;

export function middleware(req: NextRequest, ev: NextFetchEvent) {
  const ua = req.headers.get('user-agent') ?? '';
  if (!ua || BOT_HINT.test(ua)) {
    ev.waitUntil(
      fetch(`${API_URL}/analytics/bot-hit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ua }),
      }).catch(() => undefined),
    );
  }
  return NextResponse.next();
}

export const config = {
  // Chỉ trang thật — bỏ qua file tĩnh, ảnh, API nội bộ.
  matcher: ['/((?!_next/|api/|favicon.ico|robots.txt|sitemap.xml|.*\\.[a-zA-Z0-9]+$).*)'],
};
