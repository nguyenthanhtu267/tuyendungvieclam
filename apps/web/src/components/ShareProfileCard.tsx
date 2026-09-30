'use client';

import { useState } from 'react';
import { smartApi3 } from '@/lib/api';

// Đợt 65 — tạo link chia sẻ hồ sơ tóm tắt (không có SĐT/email), hết hạn sau 14 ngày.
export default function ShareProfileCard({ token }: { token: string }) {
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setMsg('');
    try {
      const r = await smartApi3.share(token);
      const url = `${window.location.origin}/ho-so-chia-se/${r.token}`;
      setLink(url);
      try {
        await navigator.clipboard.writeText(url);
        setMsg(`Đã sao chép liên kết. Có hiệu lực ${r.days} ngày.`);
      } catch {
        setMsg(`Liên kết có hiệu lực ${r.days} ngày.`);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Không tạo được liên kết');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-[18px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-extrabold text-[15px]">Chia sẻ hồ sơ tóm tắt</h2>
          <p className="text-[12.5px] text-ink-muted">Gửi cho bạn bè hoặc nhà tuyển dụng xem nhanh. Không kèm số điện thoại, email; tự hết hạn sau 14 ngày.</p>
        </div>
        <button type="button" onClick={create} disabled={busy} className="rounded-lg bg-primary text-white font-bold text-[13px] px-4 py-2 disabled:opacity-60">
          {busy ? 'Đang tạo...' : 'Tạo liên kết'}
        </button>
      </div>
      {link && (
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="mt-3 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-[12.5px]" aria-label="Liên kết chia sẻ" />
      )}
      {msg && <div className="mt-2 text-[12.5px] text-ink">{msg}</div>}
    </div>
  );
}
