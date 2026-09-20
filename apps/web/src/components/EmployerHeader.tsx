'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { NavDropdown } from '@/components/nav/NavDropdown';

const NAV_LINKS = [
  { href: '/nha-tuyen-dung/dashboard', label: 'Dashboard', enabled: true },
  { href: '/nha-tuyen-dung/dang-tin', label: 'Đăng Tuyển', enabled: true },
  { href: '/nha-tuyen-dung/tin-dang', label: 'Quản Lý Tin', enabled: true },
  { href: '/nha-tuyen-dung/ung-vien', label: 'Ứng Viên', enabled: true },
  { href: '/nha-tuyen-dung/tim-ho-so', label: 'Tìm CV', enabled: true },
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
  const { me, logout } = useAuth();
  const pathname = usePathname();

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

      <nav className="hidden md:flex items-center gap-5 text-[13px] font-semibold flex-1">
        {NAV_LINKS.map((link) =>
          link.enabled ? (
            <Link
              key={link.label}
              href={link.href}
              className={
                pathname?.startsWith(link.href) ? 'text-white' : 'text-white/65 hover:text-white transition-colors'
              }
            >
              {link.label}
            </Link>
          ) : (
            <span key={link.label} className="text-white/40 cursor-default" title="Sắp ra mắt">
              {link.label}
            </span>
          ),
        )}
      </nav>
      <div className="flex-1 md:hidden" />

      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="hidden sm:inline-flex items-center rounded-lg bg-success text-white text-xs font-bold px-3 py-1.5 hover:bg-success/85 transition-colors"
        >
          Dành cho Ứng Viên
        </Link>

        <NavDropdown
          trigger={
            <span className={pathname?.startsWith('/nha-tuyen-dung/tai-khoan') ? 'text-white' : 'text-white/80'}>
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
  );
}
