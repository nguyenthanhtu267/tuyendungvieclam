'use client';

import { useEffect, useRef, useState } from 'react';
import { detectWeakNet, readTextOnly, setTextOnly, useSavedKb } from '@/lib/data-saver';

// Đợt 90 — khi API trả lời chậm (> 4 giây, thường do máy chủ miễn phí đang "thức dậy" sau thời gian không ai truy cập)
// hiện một dải nhỏ báo cho người dùng biết hệ thống vẫn đang chạy, thay vì để họ tưởng web bị treo/lỗi.
export default function ServerWaking() {
  const [slow, setSlow] = useState(false);
  const [offline, setOffline] = useState(false);
  // Đợt 109 — chỉ báo "Mạng yếu": theo trình duyệt báo (3G/độ trễ cao) HOẶC ≥2 lần API chậm trong 2 phút. Gợi ý bật "Chỉ chữ".
  const [weak, setWeak] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [textOnly, setTO] = useState(false);
  const slowTimes = useRef<number[]>([]);
  const savedKb = useSavedKb();
  useEffect(() => {
    const onSlow = (e: Event) => {
      const on = Boolean((e as CustomEvent<boolean>).detail);
      setSlow(on);
      if (on) {
        const now = Date.now();
        slowTimes.current = [...slowTimes.current.filter((t) => now - t < 120_000), now];
        if (slowTimes.current.length >= 2) setWeak(true);
      }
    };
    try { setHidden(sessionStorage.getItem('tvl_weak_hide') === '1'); } catch { /* bỏ qua */ }
    setTO(readTextOnly());
    setWeak(detectWeakNet());
    const syncTO = () => setTO(readTextOnly());
    window.addEventListener('tvl-textonly', syncTO);
    const iv = window.setInterval(() => {
      if (slowTimes.current.length && Date.now() - slowTimes.current[slowTimes.current.length - 1] > 180_000 && !detectWeakNet()) {
        slowTimes.current = [];
        setWeak(false);
      }
    }, 30_000);
    const net = () => setOffline(navigator.onLine === false);
    net();
    window.addEventListener('tvl-api-slow', onSlow);
    window.addEventListener('online', net);
    window.addEventListener('offline', net);
    return () => {
      window.removeEventListener('tvl-api-slow', onSlow);
      window.removeEventListener('online', net);
      window.removeEventListener('offline', net);
      window.removeEventListener('tvl-textonly', syncTO);
      clearInterval(iv);
    };
  }, []);
  const chip =
    weak && !hidden && !offline ? (
      <div role="status" className="fixed bottom-3 right-3 z-[59] max-w-[300px] rounded-xl bg-white border border-border-strong shadow-lg px-3 py-2 text-[12.5px] text-ink flex items-center gap-2 flex-wrap max-sm:bottom-[76px]">
        <span className="font-bold">📶 Mạng yếu</span>
        {textOnly && savedKb > 0 && <span className="text-success font-semibold">Chỉ chữ: tiết kiệm ≈ {savedKb} KB</span>}
        {!textOnly && (
          <button type="button" onClick={() => setTextOnly(true)} className="rounded-md bg-primary text-white font-bold px-2.5 py-1">Bật chế độ chỉ chữ</button>
        )}
        <button
          type="button"
          aria-label="Ẩn"
          onClick={() => {
            setHidden(true);
            try { sessionStorage.setItem('tvl_weak_hide', '1'); } catch { /* bỏ qua */ }
          }}
          className="ml-auto text-ink-muted px-1"
        >
          ✕
        </button>
      </div>
    ) : null;
  if (!slow && !offline) return chip;
  return (
    <>
    {chip}
    <div role="status" aria-live="polite" className="tvl-above-bnav fixed bottom-3 left-1/2 -translate-x-1/2 z-[60] rounded-full bg-ink text-white text-[13px] font-semibold px-4 py-2 shadow-lg flex items-center gap-2 max-w-[calc(100vw-32px)]">
      {offline ? (
        <>📶 Mất kết nối mạng — trang sẽ tự cập nhật khi có mạng lại</>
      ) : (
        <>
          <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Máy chủ đang khởi động, chờ chút nhé…
        </>
      )}
    </div>
    </>
  );
}
