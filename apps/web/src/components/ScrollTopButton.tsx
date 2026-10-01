'use client';

import { useEffect, useState } from 'react';

// Đợt 98 — nút tròn "↑" nổi (chỉ điện thoại): hiện sau khi cuộn quá ~2 màn hình, nằm trên thanh điều hướng dưới, 1 chạm về đầu trang.
export default function ScrollTopButton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setShow(window.scrollY > window.innerHeight * 1.5));
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      window.removeEventListener('scroll', on);
      cancelAnimationFrame(raf);
    };
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      aria-label="Lên đầu trang"
      data-no-slop
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
      className="md:hidden fixed right-3 z-30 w-11 h-11 rounded-full bg-white/95 border border-border-strong shadow text-primary text-lg font-extrabold"
      style={{ bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}
    >
      ↑
    </button>
  );
}
