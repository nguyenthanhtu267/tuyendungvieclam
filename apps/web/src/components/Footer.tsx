import Link from 'next/link';

// Đợt 12a (20/09/2026) — footer dùng chung toàn site, liên kết tới 2 trang pháp lý mới (trước đó
// chưa có footer nào trong dự án). Tên công ty/pháp lý ở đây giữ "Tuyển Dụng Việc Làm" tách biệt
// với dòng chữ marketing "ĐĂNG TUYỂN MIỄN PHÍ" dùng ở logo header (đợt 12c) — logo là câu kêu gọi
// thu hút NTD đăng tin, còn đây là tên đăng ký thật của dịch vụ.
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-faint">
        <div>© {year} Tuyển Dụng Việc Làm — tuyendungvieclam.vn</div>
        <div className="flex items-center gap-4">
          <Link href="/dieu-khoan-su-dung" className="hover:text-primary font-semibold">
            Điều khoản sử dụng
          </Link>
          <Link href="/chinh-sach-bao-mat" className="hover:text-primary font-semibold">
            Chính sách bảo mật
          </Link>
        </div>
      </div>
    </footer>
  );
}
