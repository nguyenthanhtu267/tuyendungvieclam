'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { flushQueue, readQueue } from '@/lib/apply-queue';

// Đợt 109 — gửi nốt hồ sơ đang chờ khi có mạng lại, rồi báo kết quả.
export default function ApplyQueueFlusher() {
  const { token } = useAuth();
  const [msgs, setMsgs] = useState<{ title: string; ok: boolean; msg: string }[]>([]);
  const [pending, setPending] = useState(0);

  const run = useCallback(async () => {
    setPending(readQueue().length);
    if (!token || !readQueue().length || navigator.onLine === false) return;
    const res = await flushQueue(token);
    setPending(readQueue().length);
    if (res.length) {
      setMsgs(res);
      setTimeout(() => setMsgs([]), 9000);
    }
  }, [token]);

  useEffect(() => {
    run();
    const sync = () => setPending(readQueue().length);
    window.addEventListener('online', run);
    window.addEventListener('tvl-apply-queue', sync);
    const iv = window.setInterval(run, 45_000);
    return () => {
      window.removeEventListener('online', run);
      window.removeEventListener('tvl-apply-queue', sync);
      clearInterval(iv);
    };
  }, [run]);

  if (!msgs.length && !pending) return null;
  return (
    <div role="status" aria-live="polite" className="fixed bottom-16 left-3 z-[60] max-w-[320px] rounded-xl bg-ink text-white text-[13px] shadow-lg px-3.5 py-2.5 flex flex-col gap-1">
      {msgs.map((m) => (
        <div key={m.title}>{m.ok ? '✅' : '⚠'} {m.title}: {m.msg}</div>
      ))}
      {!msgs.length && pending > 0 && <div>📤 {pending} hồ sơ đang chờ gửi — sẽ tự gửi khi có mạng</div>}
    </div>
  );
}
