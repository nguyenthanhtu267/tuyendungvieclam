'use client';
import { shareDeviceQuery } from '@/lib/social';

import { useState } from 'react';
import { JobNoteButton } from '@/components/JobNote';

// Đợt 98 — hàng nút nhanh dưới tiêu đề tin (điện thoại): Gọi ngay (nếu tin có SĐT) · Chia sẻ (bảng chia sẻ của điện thoại:
// Zalo/Messenger/…; máy không hỗ trợ thì chép liên kết). Nút cao 40px, không cần cuộn xuống mới thấy.
export function JobQuickActions({ jobId, title, company, phone, light = false }: { jobId?: string; title: string; company: string; phone?: string; light?: boolean }) {
  const [msg, setMsg] = useState('');
  async function share() {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const url = jobId ? `${base}/s/${jobId}${shareDeviceQuery()}` : window.location.href;
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string; url: string }) => Promise<void> };
    try {
      if (nav.share) {
        await nav.share({ title, text: `${title} — ${company}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMsg('Đã chép liên kết');
      setTimeout(() => setMsg(''), 2000);
    } catch {
      /* người dùng đóng bảng chia sẻ */
    }
  }
  const btn = light
    ? 'inline-flex items-center justify-center gap-1 h-8 px-3 rounded-full text-[12px] font-semibold border whitespace-nowrap bg-surface-alt text-ink-muted border-border hover:text-primary hover:border-primary'
    : 'inline-flex items-center justify-center gap-1 h-10 flex-1 basis-0 min-w-[68px] px-2 rounded-full text-[13px] font-bold border whitespace-nowrap bg-white/15 text-white border-white/30';
  return (
    <div className={`flex items-center flex-wrap ${light ? 'gap-1.5' : 'gap-2 md:max-w-lg'}`}>
      {phone && (
        <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className={btn}>
          📞 Gọi
        </a>
      )}
      {phone && (
        <a href={`https://zalo.me/${phone.replace(/[^\d]/g, '').replace(/^84/, '0')}`} target="_blank" rel="noopener noreferrer" className={btn}>
          💬 Zalo
        </a>
      )}
      <button type="button" onClick={share} className={btn}>
        ↗ Chia sẻ
      </button>
      {jobId && <JobNoteButton jobId={jobId} light={light} />}
      {msg && <span className={`basis-full text-[12.5px] ${light ? 'text-ink-muted' : 'text-white'}`}>{msg}</span>}
    </div>
  );
}
