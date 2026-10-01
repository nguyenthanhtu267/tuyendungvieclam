'use client';

import { useEffect } from 'react';

// Đợt 91 — đăng ký service worker (chỉ bản chạy thật, sau khi trang đã tải xong và trình duyệt rảnh → không làm chậm lần mở đầu).
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const w = window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
    const reg = () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    const go = () => (w.requestIdleCallback ? w.requestIdleCallback(reg, { timeout: 6000 }) : window.setTimeout(reg, 3000));
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
  }, []);
  return null;
}
