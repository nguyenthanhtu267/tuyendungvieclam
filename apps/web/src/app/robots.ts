import type { MetadataRoute } from 'next';

// Đợt 12a (20/09/2026) — robots.txt tự sinh (Next.js metadata route), thay cho việc chưa có gì.
// Domain thật đang public là tuyendungvieclam.vercel.app (xem claude/00-quyet-dinh-yeu-cau.md);
// dùng biến môi trường NEXT_PUBLIC_SITE_URL để dễ đổi khi có tên miền riêng tuyendungvieclam.vn.
// Chặn Google index các trang riêng tư/đăng nhập bắt buộc (hồ sơ cá nhân, dashboard NTD, Admin,
// đăng nhập) — chỉ cho index các trang công khai (trang chủ, tìm việc, chi tiết tin, đăng ký NTD,
// điều khoản/chính sách).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tuyendungvieclam.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/ho-so', '/nha-tuyen-dung/dashboard', '/nha-tuyen-dung/tai-khoan', '/nha-tuyen-dung/tin-dang', '/nha-tuyen-dung/dang-tin', '/nha-tuyen-dung/ung-vien', '/nha-tuyen-dung/don-hang', '/nha-tuyen-dung/tim-ho-so', '/admin'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
