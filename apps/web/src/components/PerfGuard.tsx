'use client';

import { useEffect } from 'react';

// Đợt 91 — "bảo vệ hiệu năng" nhỏ chạy ngầm:
//  • Tab bị ẩn / thu nhỏ → gắn data-hidden="1" lên <html> để CSS tạm dừng MỌI animation (đỡ CPU/pin khi không ai xem).
//  • Tạm dừng nền động khi tab ẩn là phần việc; việc gọi API định kỳ đã tự dừng khi tab ẩn từ Đợt 90.
export default function PerfGuard() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      if (document.visibilityState === 'hidden') root.dataset.hidden = '1';
      else delete root.dataset.hidden;
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  return null;
}
