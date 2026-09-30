'use client';

import { useState } from 'react';
import { applicationsApi, ApiError, type Application } from '@/lib/api';
import { fmtDateTime } from '@/lib/datetime';

// Đợt 46 — ứng viên chọn giờ phỏng vấn trong các khung NTD đề xuất.
export default function InterviewChooser({ token, app, onChosen }: { token: string; app: Application; onChosen: (iso: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  if (app.interviewAt)
    return (
      <div className="mt-1 text-[12px] rounded-md bg-success-tint text-success px-2 py-1 font-semibold">
        📅 Phỏng vấn {fmtDateTime(app.interviewAt)}
        {app.interviewPlace ? ` · ${app.interviewPlace}` : ''}
        {app.interviewNote && <div className="font-normal text-ink-muted">{app.interviewNote}</div>}
      </div>
    );
  const future = (app.interviewSlots ?? []).filter((s) => new Date(s).getTime() > Date.now());
  if (!future.length) return null;
  return (
    <div className="mt-1 rounded-md bg-warning-tint px-2 py-1.5 text-[12px]">
      <div className="font-bold text-ink">Chọn giờ phỏng vấn{app.interviewPlace ? ` (${app.interviewPlace})` : ''}:</div>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {future.map((s) => (
          <button
            key={s}
            disabled={!!busy}
            onClick={async () => {
              setBusy(s);
              setErr('');
              try {
                const r = await applicationsApi.chooseInterview(token, app.id, s);
                onChosen(r.interviewAt);
              } catch (e) {
                setErr(e instanceof ApiError ? e.message : 'Không gửi được');
              } finally {
                setBusy(null);
              }
            }}
            className="rounded-md border border-primary bg-white text-primary font-semibold px-2 py-0.5 hover:bg-primary hover:text-white disabled:opacity-50"
          >
            {busy === s ? 'Đang gửi…' : fmtDateTime(s)}
          </button>
        ))}
      </div>
      {app.interviewNote && <div className="text-ink-muted mt-1">{app.interviewNote}</div>}
      {err && <div className="text-critical font-semibold">{err}</div>}
    </div>
  );
}
