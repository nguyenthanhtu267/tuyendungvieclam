'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const NAV_LINKS = [
  { href: '/viec-lam', label: 'Tìm Việc Làm', enabled: true },
  { href: '#', label: 'Mẫu CV', enabled: false },
  { href: '#', label: 'Cẩm Nang Nghề Nghiệp', enabled: false },
  { href: '#', label: 'Doanh Nghiệp', enabled: false },
];

function initialsOf(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export default function SiteHeader() {
  const { me, logout } = useAuth();
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-4 px-4 sm:px-6 lg:px-10 h-16 border-b border-border bg-surface sticky top-0 z-30">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 14.5L10 8.5L14 12.5L20 6.5"
                stroke="#fff"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="font-bold text-sm whitespace-nowrap">
            tuyển dụng<b>việc làm</b>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-5 text-[13px] font-semibold text-ink-muted flex-1">
          {NAV_LINKS.map((link) =>
            link.enabled ? (
              <Link
                key={link.label}
                href={link.href}
                className={
                  pathname?.startsWith(link.href) && link.href !== '#'
                    ? 'text-primary'
                    : 'hover:text-ink transition-colors'
                }
              >
                {link.label}
              </Link>
            ) : (
              <span key={link.label} className="text-ink-faint cursor-default" title="Sắp ra mắt">
                {link.label}
              </span>
            ),
          )}
        </nav>
        <div className="hidden md:flex flex-1" />

        <div className="hidden md:flex items-center gap-3">
          {me && (
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="w-9 h-9 rounded-full border border-border-strong flex items-center justify-center text-sm hover:bg-surface-alt transition-colors"
                aria-label="Thông báo"
              >
                🔔
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-white shadow-lg overflow-hidden text-sm">
                  <div className="px-4 py-3 font-bold border-b border-border">Thông báo</div>
                  <div className="px-4 py-6 text-center text-ink-faint text-xs">Chưa có thông báo nào</div>
                </div>
              )}
            </div>
          )}

          {me === undefined ? null : me ? (
            <div className="flex items-center gap-2.5">
              <Link
                href="/ho-so"
                className="w-8 h-8 rounded-full bg-primary-tint text-primary flex items-center justify-center text-xs font-bold"
                title="My Center"
              >
                {initialsOf(me.email)}
              </Link>
              <button
                onClick={logout}
                className="text-xs font-semibold text-ink-muted hover:text-ink px-2 py-1"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <Link href="/dang-nhap" className="tvl-btn-primary !w-auto px-5 whitespace-nowrap">
              Đăng nhập / Đăng ký
            </Link>
          )}
        </div>

        <button
          className="md:hidden ml-auto w-9 h-9 rounded-lg border border-border-strong flex items-center justify-center"
          onClick={() => setDrawerOpen(true)}
          aria-label="Mở menu"
        >
          ☰
        </button>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <nav className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-16 border-b border-border">
              <span className="font-bold text-sm">
                tuyển dụng<b>việc làm</b>
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-lg"
                aria-label="Đóng menu"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col p-4 gap-1 text-sm font-semibold">
              {NAV_LINKS.map((link) =>
                link.enabled ? (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setDrawerOpen(false)}
                    className="px-3 py-2.5 rounded-lg hover:bg-surface-alt text-ink"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <span key={link.label} className="px-3 py-2.5 rounded-lg text-ink-faint">
                    {link.label} <span className="text-[10px] font-normal">(Sắp ra mắt)</span>
                  </span>
                ),
              )}
            </div>
            <div className="mt-auto p-4 border-t border-border">
              {me === undefined ? null : me ? (
                <div className="flex flex-col gap-2">
                  <div className="text-xs text-ink-muted">Đang đăng nhập: {me.email}</div>
                  <Link href="/ho-so" onClick={() => setDrawerOpen(false)} className="tvl-btn-primary block text-center">
                    My Center
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setDrawerOpen(false);
                    }}
                    className="tvl-btn-ghost"
                  >
                    Đăng xuất
                  </button>
                </div>
              ) : (
                <Link href="/dang-nhap" onClick={() => setDrawerOpen(false)} className="tvl-btn-primary block text-center">
                  Đăng nhập / Đăng ký
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
