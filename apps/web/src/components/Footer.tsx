'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';

// Đợt 12a (20/09/2026) — footer dùng chung toàn site, liên kết tới 2 trang pháp lý mới (trước đó
// chưa có footer nào trong dự án). Tên công ty/pháp lý ở đây giữ "Tuyển Dụng Việc Làm" tách biệt
// với dòng chữ marketing "ĐĂNG TUYỂN MIỄN PHÍ" dùng ở logo header (đợt 12c) — logo là câu kêu gọi
// thu hút NTD đăng tin, còn đây là tên đăng ký thật của dịch vụ.
// Đợt 13 (24/09/2026) — dịch theo lựa chọn Tiếng Việt/Tiếng Anh (chuyển thành client component để
// dùng useLanguage()); tên thương hiệu "Tuyển Dụng Việc Làm" giữ nguyên khi tiếng Việt, bản tiếng
// Anh dùng bản không dấu "Tuyen Dung Viec Lam" (không phải bản dịch nghĩa — đây là tên riêng).
export default function Footer() {
  const year = new Date().getFullYear();
  const { t } = useLanguage();
  return (
    <footer className="border-t border-border bg-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-faint">
        <div>© {year} {t('footer.rights')} — tuyendungvieclam</div>
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap justify-center">
          <Link href="/dieu-khoan-su-dung" className="hover:text-primary font-semibold">
            {t('footer.terms')}
          </Link>
          <Link href="/chinh-sach-bao-mat" className="hover:text-primary font-semibold">
            {t('footer.privacy')}
          </Link>
          {/* Đợt 18c (26/09/2026) — người thật yêu cầu gỡ / nhận lại hồ sơ "Nguồn tổng hợp". */}
          <Link href="/yeu-cau-ho-so" className="hover:text-primary font-semibold">
            {t('footer.profileRequest')}
          </Link>
        </div>
      </div>
    </footer>
  );
}
