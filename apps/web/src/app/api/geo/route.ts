// Đợt 19 (26/09/2026) — trả vị trí ƯỚC LƯỢNG (quốc gia, thành phố) của người đang xem, đọc từ header địa lý
// Vercel tự gắn vào mỗi request. Không đọc/không lưu IP. Bộ ghi truy cập gọi 1 lần/phiên.
export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const h = req.headers;
  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  return Response.json(
    {
      country: h.get('x-vercel-ip-country'),
      region: h.get('x-vercel-ip-country-region'),
      city: decode(h.get('x-vercel-ip-city')),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
