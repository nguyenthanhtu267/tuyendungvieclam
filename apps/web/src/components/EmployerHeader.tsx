'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/SmartLink';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { NavDropdown } from '@/components/nav/NavDropdown';
import { NotificationBell } from '@/components/NotificationBell';

// Đợt 138 — gọn lại từ 7 mục còn 5: 4 mục tách rời (Ứng Viên, Kho CV, Tìm CV, Công Nhân/SV) được gom
// theo đúng việc nhà tuyển dụng muốn làm: (1) xem người ĐÃ ứng tuyển / đã lưu → "Ứng Viên";
// (2) chủ động đi TÌM người → "Tìm Hồ Sơ" (văn phòng hoặc công nhân/sinh viên/thực tập). Địa chỉ
// các trang giữ nguyên, không chức năng nào bị bỏ.
type NavItem = { href: string; label: string };
export const EMPLOYER_CANDIDATE_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Ứng Viên',
    items: [
      { href: '/nha-tuyen-dung/ung-vien', label: 'Đơn ứng tuyển' },
      { href: '/nha-tuyen-dung/kho-cv', label: 'Kho CV' },
    ],
  },
  {
    label: 'Tìm Hồ Sơ',
    items: [
      { href: '/nha-tuyen-dung/tim-ho-so', label: 'Văn phòng' },
      { href: '/nha-tuyen-dung/lao-dong-pho-thong', label: 'Công nhân · SV · Thực tập' },
    ],
  },
];

const NAV_LINKS: NavItem[] = [
  { href: '/nha-tuyen-dung/dashboard', label: 'Dashboard' },
  { href: '/nha-tuyen-dung/dang-tin', label: 'Đăng Tuyển' },
  { href: '/nha-tuyen-dung/tin-dang', label: 'Quản Lý Tin' },
];

// Đợt 11 — gom "Tài Khoản" thành dropdown (Thông tin công ty, Đơn hàng, Đăng xuất) + thêm nút xanh
// lá "Dành cho Ứng Viên" để đổi sang giao diện ứng viên (theo mục 5 đặc tả — "khu vực NTD có header
// riêng ... nút xanh lá Dành cho Ứng Viên để đổi giao diện").
const ACCOUNT_MENU = [
  { label: 'Thông tin công ty', href: '/nha-tuyen-dung/tai-khoan' },
  { label: 'Đơn hàng & gói dịch vụ', href: '/nha-tuyen-dung/don-hang' },
];

// Header riêng cho khu vực Nhà tuyển dụng — theo màn B1/B2/B3 mockup (topnav-ntd, nền primary).
export default function EmployerHeader() {
  const { me, token, logout } = useAuth();
  const pathname = usePathname();
  // Đợt 18 (26/09/2026) — sửa lỗi: trên điện thoại menu điều hướng NTD bị ẩn hoàn toàn (chỉ còn
  // "Tài Khoản") → thêm nút ☰ mở ngăn kéo chứa đủ các mục.
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => setDrawerOpen(false), [pathname]);

  return (
    <div className="flex items-center gap-5 px-4 sm:px-6 lg:px-10 h-14 bg-primary text-white sticky top-0 z-30">
      <Link href="/nha-tuyen-dung/dashboard" className="flex items-center gap-2 shrink-0">
        {/* Đợt 12j (21/09/2026) — đổi biểu tượng logo từ icon dấu tích sang chữ "V" đơn giản. */}
        <span className="w-[26px] h-[26px] rounded-md bg-white flex items-center justify-center">
          <span className="text-primary font-extrabold text-sm leading-none select-none">V</span>
        </span>
        {/* Đợt 12c (21/09/2026) — cùng đổi chữ "ĐĂNG TUYỂN MIỄN PHÍ" như SiteHeader, vì đây chính
            là khu vực NTD (đối tượng lời kêu gọi này nhắm tới) sẽ thấy nhiều nhất. */}
        <span className="font-extrabold text-[12.5px] whitespace-nowrap tracking-tight">
          ĐĂNG TUYỂN <span className="text-accent">MIỄN PHÍ</span>
        </span>
      </Link>

      <nav className="hidden lg:flex items-center gap-5 text-[13px] font-semibold flex-1">
        {NAV_LINKS.slice(0, 3).map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className={pathname?.startsWith(link.href) ? 'text-white' : 'text-white/95 hover:text-white transition-colors'}
          >
            {link.label}
          </Link>
        ))}
        {EMPLOYER_CANDIDATE_GROUPS.map((g) => (
          <NavDropdown
            key={g.label}
            trigger={
              <span className={g.items.some((i) => pathname?.startsWith(i.href)) ? 'text-white' : 'text-white/95'}>{g.label}</span>
            }
            triggerClassName="!border-b-0 !text-white !text-[15px] !font-semibold px-0"
            panelClassName="w-56 p-2 text-ink"
          >
            {g.items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={`block truncate px-3 py-2 text-[12.3px] font-semibold rounded-lg hover:bg-surface-alt ${
                  pathname?.startsWith(i.href) ? 'text-primary' : 'text-ink-muted hover:text-primary'
                }`}
              >
                {i.label}
              </Link>
            ))}
          </NavDropdown>
        ))}
      </nav>
      <div className="flex-1 lg:hidden" />

      <div className="flex items-center gap-3">
        <button
          className="lg:hidden w-9 h-9 rounded-lg border border-white/30 flex items-center justify-center text-white"
          onClick={() => setDrawerOpen(true)}
          aria-label="Mở menu nhà tuyển dụng"
        >
          ☰
        </button>
        <Link
          href="/"
          className="hidden sm:inline-flex items-center rounded-lg bg-success text-white text-xs font-bold px-3 py-1.5 hover:bg-success/85 transition-colors"
        >
          Dành cho Ứng Viên
        </Link>

        {/* Đợt 12m (21/09/2026) — chuông thông báo hoạt động thật cho NTD (trước đây EmployerHeader
            không có chuông); dùng chung component với SiteHeader, biến thể "dark" cho nền primary. */}
        {me && token && <NotificationBell token={token} variant="dark" />}

        <div className="hidden lg:block">
        <NavDropdown
          trigger={
            <span className={pathname?.startsWith('/nha-tuyen-dung/tai-khoan') ? 'text-white' : 'text-white/95'}>
              Tài Khoản
            </span>
          }
          triggerClassName="!border-b-0 !text-white !text-[13px] !font-semibold px-1"
          align="right"
          panelClassName="w-60 p-2 text-ink"
        >
          {me && <div className="px-3 py-2 text-[11px] text-ink-faint truncate border-b border-border mb-1">{me.email}</div>}
          {ACCOUNT_MENU.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="block truncate px-3 py-2 text-[12.3px] font-semibold text-ink-muted hover:text-primary hover:bg-surface-alt rounded-lg"
            >
              {item.label}
            </Link>
          ))}
          <div className="border-t border-border my-1.5" />
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 text-[12.3px] font-semibold text-critical hover:bg-critical-tint rounded-lg"
          >
            Đăng xuất
          </button>
        </NavDropdown>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden text-ink">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <nav className="absolute right-0 top-0 bottom-0 w-72 max-w-[86vw] bg-white shadow-xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
              <span className="font-extrabold text-[13px] tracking-tight">Nhà tuyển dụng</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-lg"
                aria-label="Đóng menu"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col p-3 gap-0.5 text-sm font-semibold">
              {me && <div className="px-3 py-2 text-[11px] text-ink-faint truncate">{me.email}</div>}
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setDrawerOpen(false)}
                  className={`px-3 py-2.5 rounded-lg ${
                    pathname?.startsWith(link.href) ? 'bg-primary/10 text-primary' : 'text-ink hover:bg-surface-alt'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {EMPLOYER_CANDIDATE_GROUPS.map((g) => (
                <div key={g.label} className="mt-1.5">
                  <div className="px-3 pt-1 pb-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{g.label}</div>
                  {g.items.map((i) => (
                    <Link
                      key={i.href}
                      href={i.href}
                      onClick={() => setDrawerOpen(false)}
                      className={`block px-3 py-2.5 rounded-lg ${
                        pathname?.startsWith(i.href) ? 'bg-primary/10 text-primary' : 'text-ink hover:bg-surface-alt'
                      }`}
                    >
                      {i.label}
                    </Link>
                  ))}
                </div>
              ))}
              <div className="border-t border-border my-2" />
              {ACCOUNT_MENU.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-ink-muted hover:bg-surface-alt"
                >
                  {item.label}
                </Link>
              ))}
              <Link href="/" onClick={() => setDrawerOpen(false)} className="px-3 py-2.5 rounded-lg text-success">
                Dành cho Ứng Viên
              </Link>
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  logout();
                }}
                className="text-left px-3 py-2.5 rounded-lg text-critical hover:bg-critical-tint"
              >
                Đăng xuất
              </button>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
