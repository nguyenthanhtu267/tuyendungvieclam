'use client';

import { useEffect, useRef, useState } from 'react';
import { presenceApi } from '@/lib/api';

// Đợt 12d (21/09/2026) — banner nhỏ "X người đang truy cập" ở trang chủ, theo quyết định người
// dùng 18/09/2026 ("Banner nhỏ ở trang chủ"). Gửi heartbeat định kỳ để PresenceService (đợt 12a)
// tính số phiên THẬT đang mở web, đồng thời đọc số hiển thị (thật + nền "ảo" dao động theo giờ
// trong ngày, tối đa >1000 vào buổi tối) mỗi cùng chu kỳ để số nhảy mượt, không giật cục.
const HEARTBEAT_MS = 20_000;

function genSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function OnlineBanner() {
  const [count, setCount] = useState<number | null>(null);
  const sessionIdRef = useRef<string>('');

  useEffect(() => {
    if (!sessionIdRef.current) sessionIdRef.current = genSessionId();
    const sessionId = sessionIdRef.current;

    function ping() {
      presenceApi.ping(sessionId).catch(() => {
        // Im lặng bỏ qua — banner không quan trọng tới mức làm phiền người dùng bằng lỗi.
      });
    }
    function refreshCount() {
      presenceApi
        .getCount()
        .then((res) => setCount(res.displayed))
        .catch(() => {});
    }

    ping();
    refreshCount();
    const pingTimer = setInterval(ping, HEARTBEAT_MS);
    const countTimer = setInterval(refreshCount, HEARTBEAT_MS);
    return () => {
      clearInterval(pingTimer);
      clearInterval(countTimer);
    };
  }, []);

  // Chưa có số (đang tải hoặc API lỗi) — ẩn hẳn banner thay vì hiện số 0 trông giả/lỗi.
  if (count == null) return null;

  return (
    <div className="bg-success/10 border-b border-success/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-1.5 flex items-center justify-center gap-2 text-[12px] font-semibold text-success">
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
        {count.toLocaleString('vi-VN')} người đang truy cập Tuyển Dụng Việc Làm
      </div>
    </div>
  );
}
