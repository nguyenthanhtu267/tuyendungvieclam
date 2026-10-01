'use client';

import { useEffect, useState } from 'react';

// Đợt 90 — khi API trả lời chậm (> 4 giây, thường do máy chủ miễn phí đang "thức dậy" sau thời gian không ai truy cập)
// hiện một dải nhỏ báo cho người dùng biết hệ thống vẫn đang chạy, thay vì để họ tưởng web bị treo/lỗi.
export default function ServerWaking() {
  const [slow, setSlow] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const onSlow = (e: Event) => setSlow(Boolean((e as CustomEvent<boolean>).detail));
    const net = () => setOffline(navigator.onLine === false);
    net();
    window.addEventListener('tvl-api-slow', onSlow);
    window.addEventListener('online', net);
    window.addEventListener('offline', net);
    return () => {
      window.removeEventListener('tvl-api-slow', onSlow);
      window.removeEventListener('online', net);
      window.removeEventListener('offline', net);
    };
  }, []);
  if (!slow && !offline) return null;
  return (
    <div role="status" aria-live="polite" className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[60] rounded-full bg-ink text-white text-[13px] font-semibold px-4 py-2 shadow-lg flex items-center gap-2 max-w-[calc(100vw-32px)]">
      {offline ? (
        <>📶 Mất kết nối mạng — trang sẽ tự cập nhật khi có mạng lại</>
      ) : (
        <>
          <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Máy chủ đang khởi động, chờ chút nhé…
        </>
      )}
    </div>
  );
}
