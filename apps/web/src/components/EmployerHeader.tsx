'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const NAV_LINKS = [
  { href: '/nha-tuyen-dung/dashboard', label: 'Dashboard', enabled: true },
  { href: '/nha-tuyen-dung/dang-tin', label: 'Đăng Tuyển', enabled: true },
  { href: '/nha-tuyen-dung/ung-vien', label: 'Ứng Viên', enabled: true },
  { href: '#', label: 'Tìm CV', enabled: false },
  { href: '/nha-tuyen-dung/don-hang', label: 'Đơn Hàng', enabled: true },
  { href: '/nha-tuyen-dung/tai-khoan', label: 'Tài Khoản', enabled: true },
];

// Header riêng cho khu vực Nhà tuyển dụng — theo màn B1/B2/B3 mockup (topnav-ntd, nền primary).
export default function EmployerHeader() {
  const { me, logout } = useAuth();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-5 px-4 sm:px-6 lg:px-10 h-14 bg-primary text-white sticky top-0 z-30">
      <Link href="/nha-tuyen-dung/dashboard" className="flex items-center gap-2 shrink-0">
        <span className="w-[26px] h-[26px] rounded-md bg-white flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 14.5L10 8.5L14 12.5L20 6.5"
              stroke="#163B7A"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="font-bold text-[13.5px] whitespace-nowrap">
          tuyển dụng<b>việc làm</b>
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
        {me && <span className="hidden sm:inline text-xs text-white/70">{me.email}</span>}
        <button onClick={logout} className="text-xs font-semibold text-white/80 hover:text-white px-2 py-1">
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
