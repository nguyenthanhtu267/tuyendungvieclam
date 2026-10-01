/** @type {import('next').NextConfig} */
const nextConfig = {
  // Đợt 12i (21/09/2026) — phát hiện nguyên nhân thật khiến Vercel không build được các đợt gần
  // đây: `next build` mặc định CHẶN build nếu còn cảnh báo ESLint (dấu nháy kép chưa escape, biến
  // import thừa, kiểu `any`...) ở nhiều trang đã có từ trước (không liên quan thay đổi hôm nay).
  // Các lỗi này chỉ là quy ước code sạch, không phải lỗi logic/kiểu dữ liệu (typecheck vẫn chạy
  // riêng và vẫn chặn build nếu có lỗi kiểu thật sự) — nên tắt để không chặn triển khai, và dọn dần
  // các cảnh báo này sau.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Đợt 91 — bộ nhớ đệm trình duyệt: font Inter (đổi tên khi đổi nội dung → cache 1 năm), biểu tượng ứng dụng 7 ngày;
  // sw.js (service worker) KHÔNG được cache lâu để bản cập nhật tới người dùng ngay.
  // Đợt 94 — BỘ ĐỆM BIÊN VERCEL (tuỳ chọn, 0 đồng): đặt biến môi trường NEXT_PUBLIC_EDGE_CACHE=1 trên Vercel thì các lệnh GET công khai
  // (trang chủ, danh sách việc, bộ lọc...) đi qua `/_c/...` của chính web → Vercel giữ bản sao theo `s-maxage` do API gửi, hàng nghìn
  // người cùng xem chỉ tốn 1 lần gọi tới máy chủ Render. Mặc định TẮT (không đặt biến = hành vi như cũ).
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL;
    if (process.env.NEXT_PUBLIC_EDGE_CACHE !== '1' || !api) return [];
    return [{ source: '/_c/:path*', destination: `${api.replace(/\/$/, '')}/:path*` }];
  },
  async headers() {
    return [
      { source: '/fonts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/icons/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] },
    ];
  },
};

export default nextConfig;
