'use client';

import { useEffect, useRef, useState } from 'react';

// Đợt 110 — thanh tiến độ mỏng trên cùng: hiện khi có lời gọi dữ liệu kéo dài hơn 0,4 giây, để mạng yếu không có cảm giác "đứng im".
// Đồng thời: phím R (khi không đang gõ) = "thử lại phần đang lỗi" — các khối bị lỗi mạng lắng nghe sự kiện `tvl-retry`.
export default function TopProgress() {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const onBusy = (e: Event) => {
      const n = Number((e as CustomEvent<number>).detail) || 0;
      clearTimeout(timer.current);
      if (n > 0) timer.current = setTimeout(() => setOn(true), 400);
      else setOn(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'r' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      window.dispatchEvent(new Event('tvl-retry'));
    };
    window.addEventListener('tvl-api-busy', onBusy);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('tvl-api-busy', onBusy);
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer.current);
    };
  }, []);
  if (!on) return null;
  return (
    <div aria-hidden="true" className="fixed top-0 left-0 right-0 h-[3px] z-[100] overflow-hidden bg-primary/15 pointer-events-none">
      <div className="h-full w-1/3 bg-primary rounded-full tvl-progress-bar" />
    </div>
  );
}
