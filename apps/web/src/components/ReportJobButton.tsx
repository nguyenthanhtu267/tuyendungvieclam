'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { smartApi3 } from '@/lib/api';

const REASONS: [string, string][] = [
  ['scam', 'Nghi ngờ lừa đảo (đặt cọc, nộp phí...)'],
  ['duplicate', 'Tin trùng lặp / sao chép'],
  ['expired', 'Đã hết hạn hoặc không còn tuyển'],
  ['wrong_info', 'Thông tin sai (lương, địa điểm, công ty)'],
  ['discrimination', 'Phân biệt giới tính, tuổi, ngoại hình'],
  ['other', 'Lý do khác'],
];

// Đợt 65 — báo cáo tin: hệ thống tự phân loại và đưa Admin xử lý theo mức ưu tiên.
export default function ReportJobButton({ jobId }: { jobId: string }) {
  const { token, me } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('scam');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  if (!token || !me) return <span className="text-[12.5px] text-ink-faint">Đăng nhập để báo cáo tin có vấn đề.</span>;
  async function send() {
    setBusy(true);
    setMsg('');
    try {
      await smartApi3.report(token!, jobId, reason, note.trim() || undefined);
      setMsg('Cảm ơn bạn, chúng tôi sẽ kiểm tra tin này sớm.');
      setOpen(false);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Không gửi được báo cáo.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="text-[12.5px]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="font-bold text-ink-muted hover:text-critical">⚑ Báo cáo tin này</button>
      {msg && <span className="ml-2 font-semibold text-ink">{msg}</span>}
      {open && (
        <div className="mt-2 rounded-lg border border-border bg-white p-3 grid gap-2 max-w-md">
          {/* Đợt 105 — điện thoại: chọn lý do bằng nút chạm lớn thay cho ô xổ xuống. */}
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Lý do báo cáo">
            {REASONS.map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={reason === v} onClick={() => setReason(v)} className={`text-left min-h-[44px] px-3 rounded-lg border text-[13.5px] font-semibold ${reason === v ? 'border-primary bg-primary-tint text-primary' : 'border-border-strong text-ink'}`}>
                {reason === v ? '● ' : '○ '}{l}
              </button>
            ))}
          </div>
          <textarea id="report-note" className="tvl-input" rows={3} maxLength={1000} placeholder="Mô tả thêm (không bắt buộc)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={send} className="tvl-btn-primary !w-auto px-4">{busy ? 'Đang gửi…' : 'Gửi báo cáo'}</button>
            <button type="button" onClick={() => setOpen(false)} className="tvl-btn-ghost !w-auto px-4">Huỷ</button>
          </div>
        </div>
      )}
    </div>
  );
}
