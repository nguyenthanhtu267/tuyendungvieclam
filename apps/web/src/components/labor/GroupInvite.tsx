'use client';

import { useState } from 'react';
import { laborShareUrl } from '@/lib/labor';

// Đợt 80 — "Rủ bạn đi làm cùng": link có mã nhóm; bạn bè mở link, ứng tuyển là vào cùng nhóm (tối đa 5 người).
export function GroupInvite({ jobId, title, code, size, compact = false }: { jobId: string; title: string; code: string; size: number; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = `${laborShareUrl(jobId)}?nhom=${code}`;
  async function share() {
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string; url: string }) => Promise<void> };
    const text = `Đi làm cùng mình không? ${title} — bấm link, ứng tuyển nhanh bằng số điện thoại để vào cùng nhóm.`;
    if (nav.share) {
      try {
        await nav.share({ title, text, url });
      } catch {
        /* huỷ */
      }
      return;
    }
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  if (size >= 5) return <div className="text-[12.5px] text-ink">Nhóm của bạn đã đủ 5 người.</div>;
  return (
    <div className={`rounded-lg border border-primary bg-primary-tint ${compact ? 'px-2 py-1.5' : 'p-3'} flex flex-wrap items-center gap-2 text-[13px] text-ink`}>
      <span>
        <b>Rủ bạn đi làm cùng</b> (nhóm {size}/5, mã <b>{code}</b>): nhà tuyển dụng sẽ thấy các bạn ứng tuyển chung một nhóm.
      </span>
      <button type="button" onClick={share} className="rounded-lg bg-primary text-white font-bold text-[13px] px-2.5 py-1">{copied ? 'Đã sao chép link' : 'Gửi link rủ bạn'}</button>
    </div>
  );
}
