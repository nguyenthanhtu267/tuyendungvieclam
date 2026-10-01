'use client';

import { useState } from 'react';
import { openFacebookShare } from '@/lib/social';
import { laborShareUrl } from '@/lib/labor';

// Đợt 79 — chia sẻ tin cho bạn bè: điện thoại mở bảng chia sẻ của máy (Zalo, Messenger, SMS…); máy tính sao chép link / Facebook.
export function ShareButtons({ jobId, title, compact = false }: { jobId: string; title: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = laborShareUrl(jobId);
  async function share() {
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string; url: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title, text: `${title} — đang tuyển, ứng tuyển nhanh bằng số điện thoại`, url });
        return;
      } catch {
        /* người dùng huỷ */
        return;
      }
    }
    copy();
  }
  function copy() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  const btn = 'rounded-lg border border-border-strong bg-white font-bold text-ink hover:bg-surface-alt px-2.5 py-1.5 text-[13px]';
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button type="button" onClick={share} className={btn}>↗ Chia sẻ bạn bè</button>
      {!compact && (
        <>
          <button type="button" onClick={copy} className={btn}>{copied ? 'Đã sao chép' : 'Sao chép link'}</button>
          <button type="button" onClick={() => openFacebookShare(url)} className={btn}>Facebook</button>
        </>
      )}
      {compact && copied && <span className="text-[12px] text-success font-bold">Đã sao chép link</span>}
    </div>
  );
}
