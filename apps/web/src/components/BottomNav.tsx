'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/SmartLink';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { NotificationBell } from '@/components/NotificationBell';
import { useSavedCount, setSavedCount } from '@/lib/saved-count';
import { candidatesApi, applicationsApi } from '@/lib/api';

// Đợt 91 — thanh điều hướng DƯỚI cho điện thoại (ngón cái với tới được, không phải mở menu ☰):
// Trang chủ · Văn phòng · Đã lưu · Thông báo · Tài khoản. Mỗi mục cao 56px, có số đếm. Chỉ hiện ở màn hình < 768px,
// ẩn khi bàn phím đang mở (đang gõ) và ở khu vực Admin/Nhà tuyển dụng (đã có thanh riêng).
const SHOW_PREFIXES = ['/viec-lam', '/cong-ty', '/ho-so', '/lao-dong-pho-thong', '/tien-ich'];

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const f = () => setM(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return m;
}

function Tab({ href, icon, label, active, badge }: { href: string; icon: string; label: string; active: boolean; badge?: number | null }) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={active ? 'page' : undefined}
      className={`flex-1 min-w-0 h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? 'text-primary' : 'text-ink-muted'}`}
    >
      <span className="relative text-[20px] leading-none">
        {icon}
        {!!badge && (
          <span className="absolute -top-1.5 -right-3 min-w-[16px] h-4 px-1 rounded-full bg-critical text-white text-[9.5px] font-bold flex items-center justify-center leading-none">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span className="truncate max-w-full px-0.5">{label}</span>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname() ?? '/';
  const { me, token } = useAuth();
  const mobile = useIsMobile();
  const saved = useSavedCount();
  const [typing, setTyping] = useState(false);
  const [appNews, setAppNews] = useState(0);

  const allowed = pathname === '/' || SHOW_PREFIXES.some((p) => pathname.startsWith(p));
  const role = me?.role;
  const visible = mobile && allowed && role !== 'admin' && role !== 'employer';

  // Chưa biết số việc đã lưu → hỏi MỘT lần (lúc rảnh) để có số trên biểu tượng ♡.
  const hasToken = !!token;
  useEffect(() => {
    if (!visible || !hasToken || saved != null) return;
    let done = false;
    const run = () => {
      if (done) return;
      candidatesApi
        .listSavedJobs(token as string)
        .then((l) => setSavedCount(l.length))
        .catch(() => undefined);
    };
    const w = window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (n: number) => void };
    const id = w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 4000 }) : window.setTimeout(run, 2500);
    return () => {
      done = true;
      if (w.requestIdleCallback && w.cancelIdleCallback) w.cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, [visible, hasToken, saved, token]);

  // Đợt 100 — chấm đỏ ở "Tài khoản" = số đơn ứng tuyển có thay đổi (NTD đã xem / đổi trạng thái / hẹn phỏng vấn) kể từ lần bạn mở trang Hồ sơ.
  // Hỏi API 1 lần mỗi 10 phút (lúc rảnh), lần đầu chỉ ghi nhận mốc, không báo. Mở /ho-so thì coi như đã xem.
  const isCandidate = role === 'candidate';
  useEffect(() => {
    if (!visible || !hasToken || !isCandidate) return;
    const KEY = 'tvl_app_seen';
    const sig = (a: { status: string; viewedAt?: string | null; interviewAt?: string | null }) => `${a.status}|${a.viewedAt ? 1 : 0}|${a.interviewAt ?? ''}`;
    let off = false;
    const run = async () => {
      try {
        const list = await applicationsApi.listOwn(token as string);
        const raw = localStorage.getItem(KEY);
        const seen: Record<string, string> = raw ? JSON.parse(raw) : {};
        const now: Record<string, string> = {};
        list.forEach((a) => (now[a.id] = sig(a)));
        if (!raw || pathname.startsWith('/ho-so')) {
          localStorage.setItem(KEY, JSON.stringify(now));
          sessionStorage.setItem('tvl_app_news', '0');
          if (!off) setAppNews(0);
        } else if (!off) {
          const n = list.filter((a) => seen[a.id] !== now[a.id]).length;
          sessionStorage.setItem('tvl_app_news', String(n));
          setAppNews(n);
        }
        sessionStorage.setItem('tvl_app_chk', String(Date.now()));
      } catch {
        /* bỏ qua */
      }
    };
    const checked = Number(sessionStorage.getItem('tvl_app_chk') || 0);
    if (Date.now() - checked < 10 * 60 * 1000 && !pathname.startsWith('/ho-so')) {
      setAppNews(Number(sessionStorage.getItem('tvl_app_news') || 0));
      return;
    }
    const w = window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(() => void run(), { timeout: 5000 }) : window.setTimeout(() => void run(), 3000);
    return () => {
      off = true;
      if (!w.requestIdleCallback) clearTimeout(id);
    };
  }, [visible, hasToken, isCandidate, token, pathname]);

  useEffect(() => {
    if (!visible) return;
    document.body.classList.add('has-bottom-nav');
    return () => document.body.classList.remove('has-bottom-nav');
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !['checkbox', 'radio', 'button', 'submit'].includes((t as HTMLInputElement).type);
    const on = (e: FocusEvent) => isField(e.target) && setTyping(true);
    const off = () => setTyping(false);
    document.addEventListener('focusin', on);
    document.addEventListener('focusout', off);
    return () => {
      document.removeEventListener('focusin', on);
      document.removeEventListener('focusout', off);
    };
  }, [visible]);

  if (!visible || typing) return null;

  const logged = !!(me && token);
  const is = (p: string) => (p === '/' ? pathname === '/' : pathname.startsWith(p));

  return (
    <nav
      aria-label="Điều hướng nhanh"
      data-no-slop
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-border-strong flex items-stretch h-[56px]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', boxSizing: 'content-box' }}
    >
      <Tab href="/" icon="🏠" label="Trang chủ" active={is('/')} />
      <Tab href="/viec-lam" icon="🔎" label="Văn phòng" active={is('/viec-lam')} />
      {/* Đợt 134 — "Công nhân" luôn có (cả khi đã đăng nhập) và mở thẳng DANH SÁCH VIỆC; "Đã lưu" xem trong Tài khoản. */}
      <Tab href="/lao-dong-pho-thong/viec-lam" icon="🧰" label="Công nhân" active={is('/lao-dong-pho-thong')} />
      {logged ? (
        <>
          <div className="flex-1 min-w-0 h-full">
            <NotificationBell token={token as string} variant="tab" />
          </div>
          <Tab href="/ho-so" icon="👤" label="Tài khoản" active={is('/ho-so')} badge={appNews} />
        </>
      ) : (
        <Tab href={pathname && pathname !== '/' && !pathname.startsWith('/dang-nhap') ? `/dang-nhap?next=${encodeURIComponent(pathname)}` : '/dang-nhap'} icon="👤" label="Đăng nhập" active={false} />
      )}
    </nav>
  );
}
