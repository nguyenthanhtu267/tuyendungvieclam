'use client';

import { useEffect, useRef, useState } from 'react';
import { presenceApi } from '@/lib/api';

// Đợt 12d (21/09/2026) — banner nhỏ "X người đang truy cập" ở trang chủ, theo quyết định người
// dùng 18/09/2026 ("Banner nhỏ ở trang chủ"). Gửi heartbeat định kỳ để PresenceService (đợt 12a)
// tính số phiên THẬT đang mở web, đồng thời đọc số hiển thị (thật + nền "ảo" dao động theo giờ
// trong ngày, tối đa >1000 vào buổi tối) mỗi cùng chu kỳ để số nhảy mượt, không giật cục.
// Đợt 90 — 45 giây (máy chủ coi là online nếu có ping trong 90 giây) và DỪNG khi tab bị ẩn → giảm ~60% lượt gọi.
const HEARTBEAT_MS = 45_000;

function genSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function OnlineBanner() {
  const [count, setCount] = useState<number | null>(null);
  // Đợt 91 — lỗi API → thu gọn hẳn; đang tải → GIỮ CHỖ đúng chiều cao để toàn trang không bị đẩy xuống khi số về.
  const [failed, setFailed] = useState(false);
  const sessionIdRef = useRef<string>('');

  useEffect(() => {
    if (!sessionIdRef.current) sessionIdRef.current = genSessionId();
    const sessionId = sessionIdRef.current;

    // Đợt 94 — dùng /presence/beat (1 lần gọi thay 2) và để MÁY CHỦ quyết định khoảng chờ kế tiếp (45s lúc vắng → 4 phút lúc rất đông/quá tải).
    // Cộng ±15% ngẫu nhiên để hàng nghìn người không "đập" máy chủ cùng một giây.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    function schedule(ms: number) {
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(beat, ms * (0.85 + Math.random() * 0.3));
    }
    function beat() {
      if (stopped) return;
      if (document.visibilityState !== 'visible') {
        schedule(HEARTBEAT_MS); // tab ẩn: không gọi; khi quay lại sẽ gọi ngay (onVis)
        return;
      }
      presenceApi
        .beat(sessionId)
        .then((res) => {
          setCount(res.displayed);
          setFailed(false);
          schedule(Math.min(Math.max(res.next || HEARTBEAT_MS, 30_000), 300_000));
        })
        .catch(() => {
          setFailed(true);
          schedule(120_000); // lỗi → thử lại thưa, không dồn dập
        });
    }
    beat();
    const onVis = () => document.visibilityState === 'visible' && beat();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Lỗi API (và chưa từng có số) → ẩn hẳn thay vì hiện số 0 trông giả/lỗi.
  if (failed && count == null) return null;

  return (
    <div aria-hidden={count == null} className="bg-[#E9F7F2] border-b border-success/20 h-[26px] overflow-hidden">
      <div
        className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-full flex items-center justify-center gap-2 text-[12px] leading-tight font-semibold text-success transition-opacity ${count == null ? 'opacity-0' : 'opacity-100'}`}
      >
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
        {(count ?? 0).toLocaleString('vi-VN')} người đang truy cập Tuyển Dụng Việc Làm
      </div>
    </div>
  );
}
