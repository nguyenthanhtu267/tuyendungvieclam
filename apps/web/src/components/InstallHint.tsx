'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Đợt 103 — nhắc "Thêm vào màn hình chính" (mở như ứng dụng, nhanh hơn): chỉ điện thoại, từ lần ghé thứ 3, chưa cài, ẩn được 30 ngày.
// Android/Chrome: nút cài thật (beforeinstallprompt). iPhone/Safari: hướng dẫn Chia sẻ → Thêm vào MH chính (iOS không có nút cài tự động).
type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export default function InstallHint() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);
  const pathname = usePathname() ?? '/';
  useEffect(() => {
    try {
      if (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone) return;
      if (!window.matchMedia('(max-width: 767px)').matches) return;
      const hide = Number(localStorage.getItem('tvl_install_hide') || 0);
      if (Date.now() - hide < 30 * 86400000) return;
      const visits = Number(localStorage.getItem('tvl_visits') || 0) + (sessionStorage.getItem('tvl_visit_counted') ? 0 : 1);
      localStorage.setItem('tvl_visits', String(visits));
      sessionStorage.setItem('tvl_visit_counted', '1');
      if (visits < 3) return;
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
      if (isIos) {
        setIos(true);
        setShow(true);
      }
    } catch {
      return;
    }
    const on = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIP);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  // Không chen vào trang đang điền biểu mẫu.
  if (!show || (!evt && !ios) || pathname.startsWith('/dang-nhap') || pathname.startsWith('/nha-tuyen-dung')) return null;
  const close = () => {
    try { localStorage.setItem('tvl_install_hide', String(Date.now())); } catch { /* bỏ qua */ }
    setShow(false);
  };
  return (
    <div data-no-slop className="md:hidden fixed inset-x-3 z-30 rounded-xl bg-white border border-border-strong shadow-lg p-3 flex items-center gap-3" style={{ bottom: 'calc(130px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="flex-1 min-w-0 text-[13px]">
        <div className="font-extrabold text-ink">Thêm web vào màn hình chính</div>
        <div className="text-ink-muted text-[12px]">{ios ? 'Bấm nút Chia sẻ ⎋ rồi chọn "Thêm vào MH chính".' : 'Mở nhanh như ứng dụng, tiết kiệm dữ liệu.'}</div>
      </div>
      {evt && (
        <button type="button" onClick={async () => { await evt.prompt(); close(); }} className="h-10 px-3 rounded-lg bg-primary text-white text-[13px] font-bold">Cài</button>
      )}
      <button type="button" aria-label="Đóng" onClick={close} className="w-9 h-9 text-ink-faint text-lg">✕</button>
    </div>
  );
}
