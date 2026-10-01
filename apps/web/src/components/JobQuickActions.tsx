'use client';

import { useState } from 'react';
import { JobNoteButton } from '@/components/JobNote';

// Đợt 98 — hàng nút nhanh dưới tiêu đề tin (điện thoại): Gọi ngay (nếu tin có SĐT) · Chia sẻ (bảng chia sẻ của điện thoại:
// Zalo/Messenger/…; máy không hỗ trợ thì chép liên kết). Nút cao 40px, không cần cuộn xuống mới thấy.
export function JobQuickActions({ jobId, title, company, phone }: { jobId?: string; title: string; company: string; phone?: string }) {
  const [msg, setMsg] = useState('');
  async function share() {
    const url = window.location.href;
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
  const btn = 'inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-white/15 text-white text-[13.5px] font-bold border border-white/30';
  return (
    <div className="flex items-center gap-2 flex-wrap mt-2.5">
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
      {jobId && <JobNoteButton jobId={jobId} />}
      {msg && <span className="text-[12.5px] text-white">{msg}</span>}
    </div>
  );
}
