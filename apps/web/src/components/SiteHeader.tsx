'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { NavDropdown } from '@/components/nav/NavDropdown';
import { NotificationBell } from '@/components/NotificationBell';
import { CANDIDATE_ACCOUNT_MENU, EMPLOYER_CTA_MENU, JOBS_MEGA_MENU, UTILITY_TOOLS } from '@/lib/nav-menu';

// Đợt 11 — mega-menu điều hướng nhiều cấp theo claude/06-spec-tim-kiem-nang-cao.md mục 5:
// "Tìm Việc Làm" (mega-menu 4 cột/5 nhóm), "Tiện Ích" (8 công cụ, placeholder), khối navy
// "Dành cho Nhà Tuyển Dụng" (4 mục), menu tài khoản ứng viên (8 mục). "Mẫu CV"/"Cẩm Nang Nghề
// Nghiệp" giữ nguyên placeholder "Sắp ra mắt" đã chốt trước đó.
const SIMPLE_PLACEHOLDER_LINKS = [
  { label: 'Mẫu CV' },
  { label: 'Cẩm Nang Nghề Nghiệp' },
];

function initialsOf(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export default function SiteHeader() {
  const { me, token, logout } = useAuth();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const jobsActive = pathname?.startsWith('/viec-lam');

  return (
    <>
      <div className="flex items-center gap-4 px-4 sm:px-6 lg:px-10 h-16 border-b border-border bg-surface sticky top-0 z-30">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          {/* Đợt 12j (21/09/2026) — đổi biểu tượng logo từ icon dấu tích sang chữ "V" đơn giản
              theo yêu cầu người dùng. */}
          <span className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <span className="text-white font-extrabold text-sm leading-none select-none">V</span>
          </span>
          {/* Đợt 12c (21/09/2026) — đổi chữ logo hiển thị thành lời kêu gọi "ĐĂNG TUYỂN MIỄN PHÍ"
              (quyết định người dùng: kích thích doanh nghiệp đăng tin tuyển dụng). Tên đăng ký thật
              của dịch vụ "Tuyển Dụng Việc Làm" vẫn giữ nguyên ở footer, trang Điều khoản/Chính sách
              và metadata trang (không đổi domain/thương hiệu pháp lý, chỉ đổi câu chữ hiển thị logo). */}
          <span className="font-extrabold text-[13px] whitespace-nowrap tracking-tight">
            ĐĂNG TUYỂN <span className="text-accent">MIỄN PHÍ</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-4 lg:gap-5 text-[13px] font-semibold text-ink-muted flex-1 min-w-0">
          <NavDropdown
            trigger={<span className={jobsActive ? 'text-primary' : ''}>Tìm Việc Làm</span>}
            panelClassName="w-[min(760px,90vw)] p-5"
          >
            <div className="grid grid-cols-4 gap-5">
              {JOBS_MEGA_MENU.columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-4 min-w-0">
                  {col.map((group) => (
                    <div key={group.title}>
                      <div className="text-[11px] font-extrabold text-primary uppercase tracking-wide mb-1.5">
                        {group.title}
                      </div>
                      <ul className="flex flex-col gap-0.5">
                        {group.items.map((item) => (
                          <li key={item.label}>
                            <Link
                              href={item.href}
                              title={item.label}
                              className="block truncate text-[12.3px] text-ink-muted hover:text-primary py-0.5"
                            >
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {group.more && (
                        <Link href={group.more.href} className="block text-[11.5px] font-bold text-primary mt-1.5">
                          {group.more.label}
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </NavDropdown>

          <NavDropdown trigger="Tiện Ích" panelClassName="w-64 p-2">
            <div className="px-2.5 py-1.5 text-[10.5px] font-bold text-ink-faint uppercase tracking-wide">
              Sắp ra mắt
            </div>
            {UTILITY_TOOLS.map((tool) => (
              <div
                key={tool}
                title="Sắp ra mắt"
                className="px-3 py-2 text-[12.3px] text-ink-faint cursor-default rounded-lg"
              >
                {tool}
              </div>
            ))}
          </NavDropdown>

          {SIMPLE_PLACEHOLDER_LINKS.map((link) => (
            <span key={link.label} className="text-ink-faint cursor-default whitespace-nowrap" title="Sắp ra mắt">
              {link.label}
            </span>
          ))}
        </nav>
        <div className="hidden md:flex flex-1" />

        <div className="hidden md:flex items-center gap-3">
          <NavDropdown
            trigger={<span className="text-white font-bold text-[12.5px]">Dành Cho Nhà Tuyển Dụng</span>}
            triggerClassName="!border-b-0 !text-white bg-primary-dark hover:bg-primary rounded-lg px-3.5 py-2"
            align="right"
            panelClassName="w-64 p-2"
          >
            {EMPLOYER_CTA_MENU.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                title={item.label}
                className="block truncate px-3 py-2 text-[12.3px] font-semibold text-ink-muted hover:text-primary hover:bg-surface-alt rounded-lg"
              >
                {item.label}
              </Link>
            ))}
          </NavDropdown>

          <span
            className="text-[11px] font-bold text-ink-faint border border-border-strong rounded-md px-1.5 py-1 cursor-default"
            title="Tiếng Anh sẽ hỗ trợ ở bản cập nhật sau"
          >
            🌐 VI
          </span>

          {me && token && <NotificationBell token={token} />}

          {me === undefined ? null : me ? (
            <NavDropdown
              trigger={
                <span className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-primary-tint text-primary flex items-center justify-center text-xs font-bold">
                    {initialsOf(me.email)}
                  </span>
                  <span className="max-w-[120px] truncate" title={me.email}>
                    Chào {me.email.split('@')[0]}
                  </span>
                </span>
              }
              align="right"
              panelClassName="w-60 p-2"
            >
              {CANDIDATE_ACCOUNT_MENU.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  title={item.label}
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
          <nav className="absolute right-0 top-0 bottom-0 w-80 max-w-[86vw] bg-white shadow-xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-4 h-16 border-b border-border shrink-0">
              <span className="font-extrabold text-[13px] tracking-tight">
                ĐĂNG TUYỂN <span className="text-accent">MIỄN PHÍ</span>
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
              <details className="group" open>
                <summary className="px-3 py-2.5 rounded-lg hover:bg-surface-alt text-ink cursor-pointer list-none flex items-center justify-between">
                  Tìm Việc Làm
                  <span className="text-[10px] transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="pl-3 flex flex-col gap-2.5 pb-2 pt-1">
                  {JOBS_MEGA_MENU.columns.flat().map((group) => (
                    <div key={group.title}>
                      <div className="text-[10.5px] font-extrabold text-primary uppercase tracking-wide mb-1">
                        {group.title}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {group.items.slice(0, 6).map((item) => (
                          <Link
                            key={item.label}
                            href={item.href}
                            onClick={() => setDrawerOpen(false)}
                            className="text-[12px] font-medium text-ink-muted py-0.5 truncate"
                            title={item.label}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Link
                    href="/viec-lam"
                    onClick={() => setDrawerOpen(false)}
                    className="text-[12px] font-bold text-primary"
                  >
                    Xem tất cả việc làm →
                  </Link>
                </div>
              </details>

              <details className="group">
                <summary className="px-3 py-2.5 rounded-lg hover:bg-surface-alt text-ink cursor-pointer list-none flex items-center justify-between">
                  Tiện Ích
                  <span className="text-[10px] transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="pl-3 flex flex-col gap-0.5 pb-2 pt-1">
                  {UTILITY_TOOLS.map((tool) => (
                    <span key={tool} className="text-[12px] text-ink-faint py-0.5">
                      {tool} <span className="text-[10px] font-normal">(Sắp ra mắt)</span>
                    </span>
                  ))}
                </div>
              </details>

              {SIMPLE_PLACEHOLDER_LINKS.map((link) => (
                <span key={link.label} className="px-3 py-2.5 rounded-lg text-ink-faint">
                  {link.label} <span className="text-[10px] font-normal">(Sắp ra mắt)</span>
                </span>
              ))}

              <details className="group">
                <summary className="px-3 py-2.5 rounded-lg bg-primary-tint text-primary cursor-pointer list-none flex items-center justify-between mt-1">
                  Dành Cho Nhà Tuyển Dụng
                  <span className="text-[10px] transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="pl-3 flex flex-col gap-0.5 pb-2 pt-1">
                  {EMPLOYER_CTA_MENU.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className="text-[12px] font-medium text-ink-muted py-1 truncate"
                      title={item.label}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </details>
            </div>
            <div className="mt-auto p-4 border-t border-border">
              {me === undefined ? null : me ? (
                <div className="flex flex-col gap-2">
                  <div className="text-xs text-ink-muted truncate">Đang đăng nhập: {me.email}</div>
                  {CANDIDATE_ACCOUNT_MENU.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className="text-[12.5px] font-semibold text-ink py-1"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    onClick={() => {
                      logout();
                      setDrawerOpen(false);
                    }}
                    className="tvl-btn-ghost mt-1"
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
