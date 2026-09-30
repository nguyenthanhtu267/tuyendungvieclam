'use client';

import { useState } from 'react';
import { employerApi, ApiError, type EmployerApplication } from '@/lib/api';
import { fmtDateTime } from '@/lib/datetime';

// Đợt 46 — NTD đề xuất tối đa 3 khung giờ phỏng vấn; ứng viên chọn 1 trong trang Hồ sơ.
export default function InterviewScheduler({ token, app, onDone }: { token: string; app: EmployerApplication; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<string[]>(['', '', '']);
  const [place, setPlace] = useState(app.interviewPlace ?? '');
  const [note, setNote] = useState(app.interviewNote ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const hasAccount = !!app.cv?.candidateProfile;

  async function submit() {
    const picked = slots.filter(Boolean).map((s) => new Date(s).toISOString());
    if (!picked.length) return setErr('Chọn ít nhất 1 khung giờ');
    setBusy(true);
    setErr('');
    try {
      await employerApi.proposeInterview(token, app.id, { slots: picked, place, note });
      setOpen(false);
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Không gửi được, thử lại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-left">
      {app.interviewAt ? (
        <div className="text-[12px] font-semibold text-success whitespace-nowrap">📅 {fmtDateTime(app.interviewAt)}</div>
      ) : app.interviewSlots?.length ? (
        <div className="text-[12px] text-warning font-semibold whitespace-nowrap">⏳ Chờ ứng viên chọn giờ</div>
      ) : null}
      {app.status === 'rejected' ? null : hasAccount ? (
        <button onClick={() => setOpen((v) => !v)} className="text-primary text-[12px] font-semibold hover:underline whitespace-nowrap">
          {app.interviewSlots?.length ? 'Đổi lịch phỏng vấn' : '📅 Hẹn phỏng vấn'}
        </button>
      ) : (
        <span className="text-[11px] text-ink-faint" title="Khách ứng tuyển không có tài khoản — liên hệ qua email/điện thoại">
          Liên hệ trực tiếp để hẹn
        </span>
      )}
      {open && (
        <div className="mt-2 rounded-lg border border-border bg-white p-3 flex flex-col gap-2 w-[300px] shadow-lg text-[13px]">
          <div className="font-bold text-ink">Đề xuất tối đa 3 khung giờ</div>
          {slots.map((v, i) => (
            <input
              key={i}
              id={`iv-slot-${app.id}-${i}`}
              type="datetime-local"
              className="tvl-input !py-1"
              value={v}
              onChange={(e) => setSlots((s) => s.map((x, j) => (j === i ? e.target.value : x)))}
            />
          ))}
          <input id={`iv-place-${app.id}`} className="tvl-input !py-1" placeholder="Địa điểm / link họp online" value={place} onChange={(e) => setPlace(e.target.value)} />
          <textarea id={`iv-note-${app.id}`} className="tvl-input !py-1 min-h-[50px]" placeholder="Ghi chú (mang theo gì, gặp ai…)" value={note} onChange={(e) => setNote(e.target.value)} />
          {err && <div className="text-critical font-semibold">{err}</div>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setOpen(false)} className="tvl-btn-ghost !w-auto px-3 py-1">Huỷ</button>
            <button onClick={submit} disabled={busy} className="tvl-btn-primary !w-auto px-3 py-1">{busy ? 'Đang gửi…' : 'Gửi lời mời'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
