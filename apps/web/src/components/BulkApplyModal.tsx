'use client';

import { useEffect, useMemo, useState } from 'react';
import { applicationsApi, profileApi, type SavedJob } from '@/lib/api';
import { draftCoverLetter } from '@/lib/job-insights';

interface Row {
  sj: SavedJob;
  letter: string;
  on: boolean;
  status: 'idle' | 'sending' | 'ok' | 'error';
  error?: string;
}

// Đợt 64 — nộp nhiều việc một lần: chọn tin đã lưu, hệ thống soạn thư riêng cho từng tin, ứng viên xem lại rồi gửi hết.
export default function BulkApplyModal({
  token,
  savedJobs,
  appliedJobIds,
  onClose,
  onApplied,
}: {
  token: string;
  savedJobs: SavedJob[];
  appliedJobIds: Set<string>;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    profileApi
      .getFull(token)
      .then((r) => {
        const last = r.sections.experiences[0];
        const prof = { fullName: r.profile.fullName, yearsOfExperience: r.profile.yearsOfExperience, profileTitle: r.profile.profileTitle, desiredPosition: r.profile.desiredPosition };
        void last;
        setRows(
          savedJobs
            .filter((s) => !appliedJobIds.has(s.jobPostingId))
            .slice(0, 15)
            .map((sj) => ({ sj, letter: draftCoverLetter(sj.jobPosting as never, prof as never), on: true, status: 'idle' as const })),
        );
      })
      .catch(() => setErr('Bạn cần có hồ sơ trực tuyến để nộp hàng loạt.'))
      .finally(() => setLoading(false));
  }, [token, savedJobs, appliedJobIds]);

  const selected = useMemo(() => rows.filter((r) => r.on && r.status !== 'ok'), [rows]);

  async function sendAll() {
    setBusy(true);
    setErr('');
    let okCount = 0;
    for (const r of selected) {
      setRows((l) => l.map((x) => (x.sj.id === r.sj.id ? { ...x, status: 'sending' } : x)));
      try {
        await applicationsApi.apply(token, r.sj.jobPostingId, { useOnlineProfile: true, coverLetter: r.letter });
        okCount++;
        setRows((l) => l.map((x) => (x.sj.id === r.sj.id ? { ...x, status: 'ok' } : x)));
      } catch (e) {
        setRows((l) => l.map((x) => (x.sj.id === r.sj.id ? { ...x, status: 'error', error: e instanceof Error ? e.message : 'Lỗi' } : x)));
      }
    }
    setBusy(false);
    if (okCount) onApplied();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <div className="font-extrabold text-[16px]">Nộp nhiều việc một lần</div>
            <div className="text-[12.5px] text-ink-muted">Thư ứng tuyển đã soạn riêng cho từng tin. Bạn nên đọc và sửa trước khi gửi. Đơn nộp bằng hồ sơ trực tuyến của bạn.</div>
          </div>
          <button type="button" onClick={onClose} className="text-ink-faint text-xl leading-none" aria-label="Đóng">×</button>
        </div>
        <div className="p-4 overflow-y-auto flex flex-col gap-3">
          {loading && <div className="text-sm text-ink-faint">Đang chuẩn bị…</div>}
          {err && <div className="text-critical text-sm">{err}</div>}
          {!loading && !err && rows.length === 0 && <div className="text-sm text-ink-muted">Không còn tin đã lưu nào chưa nộp.</div>}
          {rows.map((r) => (
            <div key={r.sj.id} className="rounded-lg border border-border p-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  id={`bulk-${r.sj.id}`}
                  type="checkbox"
                  checked={r.on}
                  disabled={r.status === 'ok' || busy}
                  onChange={(e) => setRows((l) => l.map((x) => (x.sj.id === r.sj.id ? { ...x, on: e.target.checked } : x)))}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="font-bold text-[13.5px] block">{r.sj.jobPosting.title}</span>
                  <span className="text-[12.5px] text-ink-muted block co-name">{r.sj.jobPosting.company.name}</span>
                </span>
                <span className="ml-auto text-[12.5px] font-bold shrink-0">
                  {r.status === 'ok' && <span className="text-success">✓ Đã nộp</span>}
                  {r.status === 'sending' && <span className="text-ink-faint">Đang gửi…</span>}
                  {r.status === 'error' && <span className="text-critical">{r.error}</span>}
                </span>
              </label>
              {r.status !== 'ok' && (
                <textarea
                  id={`bulk-letter-${r.sj.id}`}
                  className="tvl-input mt-2 text-[13px]"
                  rows={4}
                  value={r.letter}
                  disabled={busy}
                  onChange={(e) => setRows((l) => l.map((x) => (x.sj.id === r.sj.id ? { ...x, letter: e.target.value } : x)))}
                />
              )}
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-border flex items-center justify-between gap-3">
          <span className="text-[13px] text-ink-muted">{selected.length} tin sẽ được nộp</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="tvl-btn-ghost !w-auto px-4">Đóng</button>
            <button type="button" disabled={busy || selected.length === 0} onClick={sendAll} className="tvl-btn-primary !w-auto px-5 disabled:opacity-50">
              {busy ? 'Đang gửi…' : `Gửi ${selected.length} đơn`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
