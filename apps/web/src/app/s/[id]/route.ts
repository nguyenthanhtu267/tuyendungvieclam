// Đợt 154 — LINK CHIA SẺ QUA HỆ THỐNG: https://www.vieclamngay.vn/s/<mã tin>
// Mọi nút "Chia sẻ / Sao chép link / Facebook" đều tạo link này (thay vì link trang tin). Khi dán vào Facebook/Zalo/Messenger…,
// công cụ xem trước (bot) đọc được trang HTML nhẹ có đủ thẻ og (tiêu đề, mô tả, ẢNH tự vẽ /chia-se/<id>.png) — không phụ thuộc
// trang tin nặng. Người dùng thật bấm vào thì được chuyển thẳng (302) sang trang tin. Bot lạ không nhận diện được cũng được
// chuyển sang trang tin (trang tin cũng có đủ thẻ og) nên không bao giờ mất xem trước.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.vieclamngay.vn').replace(/\/$/, '');
const BOT = /facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|zalo|twitterbot|telegrambot|slackbot|linkedinbot|whatsapp|discordbot|skypeuripreview|viber|line-poker|pinterest|embedly|bot|crawl|spider|preview/i;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = params.id.replace(/\.(png|html)$/i, '');
  const target = `${SITE}/viec-lam/${encodeURIComponent(id)}`;
  const ua = req.headers.get('user-agent') ?? '';
  if (!BOT.test(ua)) return Response.redirect(`${target}?utm_source=share`, 302);

  let title = 'Tin tuyển dụng - Việc Làm Ngay';
  let desc = 'Xem chi tiết và ứng tuyển miễn phí trên Việc Làm Ngay';
  try {
    const r = await fetch(`${API}/jobs/${encodeURIComponent(id)}/share-meta`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const j = (await r.json()) as { title: string; company: string; salaryMin: number | null; salaryMax: number | null; location: string };
      const salary = j.salaryMax ? `${j.salaryMin ? j.salaryMin + ' – ' : ''}${j.salaryMax} triệu` : 'Lương thỏa thuận';
      title = `${j.title} - ${j.company}`;
      desc = `${salary}${j.location ? ' · ' + j.location : ''} · Ứng tuyển miễn phí trên Việc Làm Ngay`;
    }
  } catch { /* dùng chữ mặc định, ảnh vẫn có */ }
  // Đợt 158 — khổ ảnh theo cấu hình admin: ngang 1200×630, vuông 1080×1080, hoặc tự chọn theo thiết bị người chia sẻ (?f=m|d)
  const f = new URL(req.url).searchParams.get('f');
  let fmt: 'wide' | 'square' | 'auto' = 'wide';
  try {
    const r = await fetch(`${API}/public/share-bg?only=${encodeURIComponent(id)}`, { next: { revalidate: 120 }, signal: AbortSignal.timeout(5000) });
    if (r.ok) { const c = (await r.json()) as { format?: string }; if (c.format === 'square' || c.format === 'auto') fmt = c.format; }
  } catch { /* mặc định ngang */ }
  const square = fmt === 'square' || (fmt === 'auto' && f === 'm');
  const [W, H] = square ? [1080, 1080] : [1200, 630];
  const img = `${SITE}/chia-se/${encodeURIComponent(id)}.png${fmt === 'auto' && (f === 'm' || f === 'd') ? `?f=${f}` : ''}`;
  const share = `${SITE}/s/${encodeURIComponent(id)}${f === 'm' || f === 'd' ? `?f=${f}` : ''}`;
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(target)}">
<meta property="og:type" content="website"><meta property="og:locale" content="vi_VN"><meta property="og:site_name" content="Việc Làm Ngay">
<meta property="og:url" content="${esc(share)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:image:secure_url" content="${esc(img)}"><meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="${W}"><meta property="og:image:height" content="${H}"><meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}"></head>
<body><p><a href="${esc(target)}">${esc(title)}</a></p></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=3600' } });
}
