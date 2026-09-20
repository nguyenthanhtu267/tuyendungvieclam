'use client';

import { useEffect, useRef, useState } from 'react';

// Đợt 11 — dropdown/mega-menu dùng chung cho thanh điều hướng: mở khi click hoặc rê chuột vào, đóng
// khi rê ra (có độ trễ nhỏ để không đóng nhầm lúc di chuột qua khe hở), click ra ngoài, hoặc Esc.
// Gạch chân xanh 3px khi hover/đang mở (theo mục 5 đặc tả).
export function NavDropdown({
  trigger,
  triggerClassName,
  panelClassName,
  align = 'left',
  children,
}: {
  trigger: React.ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  align?: 'left' | 'right';
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 220);
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => {
          // Không dùng toggle: khi rê chuột vào (desktop) đã tự mở sẵn rồi, nếu click lại toggle sẽ
          // đóng ngay lập tức (mouseenter mở → click tắt trong cùng thao tác). Bấm luôn đảm bảo mở;
          // đóng lại thì dựa vào rê chuột ra / click ra ngoài / Esc — vẫn dùng được tốt trên di động
          // (không có hover) vì bấm lần đầu đã mở, bấm lần 2 coi như "đã xem" rồi bấm ra ngoài đóng.
          cancelClose();
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1 whitespace-nowrap border-b-[3px] py-1 transition-colors ${
          open ? 'border-primary text-primary' : 'border-transparent hover:border-primary/60'
        } ${triggerClassName ?? ''}`}
        aria-expanded={open}
      >
        {trigger}
        <span className={`text-[9px] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div
          className={`absolute z-40 mt-2 rounded-xl border border-border bg-white shadow-lg text-ink ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${panelClassName ?? ''}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
