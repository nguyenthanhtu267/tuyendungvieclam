'use client';

import { useState } from 'react';
import Link from 'next/link';
import { workersApi, type MyApplication } from '@/lib/api';
import { CALL_LABEL, ago, fmtDateTime } from '@/lib/labor';
import { downloadIcs, interviewChecklist } from '@/lib/labor-extra';
import type { useWorkerApply } from './WorkerCreds';

const STATUS_NOTE: Record<string, string> = {
  new: 'Đã gửi — chờ nhà tuyển dụng gọi',
  no_answer: 'Nhà tuyển dụng gọi chưa được — hãy nghe máy nhé',
  callback: 'Nhà tuyển dụng hẹn gọi lại',
  interview: 'Đã hẹn phỏng vấn',
  hired: 'Đã nhận việc',
  rejected: 'Chưa phù hợp',
  no_show: 'Đã ghi nhận không đi làm',
};

// Đợt 81 — lịch sử ứng tuyển của người lao động + nút "tôi đã có việc / tìm lại".
export function ApplicationHistory({ w }: { w: ReturnType<typeof useWorkerApply> }) {
  const [data, setData] = useState<{ isSeeking: boolean; examMode?: string | null; examUntil?: string | null; kind?: string; items: MyApplication[] } | null>(null);
  const [examDate, setExamDate] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const hasId = w.isCandidate ? !!w.mine : !!w.creds;
  if (!hasId) return null;

  async function requestCert(appId: string) {
    try {
      if (w.isCandidate) await workersApi.requestCertMine(authToken(w), appId);
      else await workersApi.requestCert(w.creds!.phone, w.creds!.birthDate, appId);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function load() {
    setErr('');
    try {
      const r = w.isCandidate ? await workersApi.myApplicationsMine(authToken(w)) : await workersApi.myApplications(w.creds!.phone, w.creds!.birthDate);
      setData(r);
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function setExam(mode: string) {
    if (!data) return;
    setBusy(true);
    setErr('');
    try {
      const r = w.isCandidate ? await workersApi.setExamMine(w.token ?? '', mode, examDate) : await workersApi.setExam(w.creds!.phone, w.creds!.birthDate, mode, examDate);
      setData({ ...data, examMode: r.examMode, examUntil: r.examUntil });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggleSeeking() {
    if (!data) return;
    setBusy(true);
    try {
      const next = !data.isSeeking;
      if (w.isCandidate) await workersApi.setSeekingMine(authToken(w), next);
      else await workersApi.setSeeking(w.creds!.phone, w.creds!.birthDate, next);
      setData({ ...data, isSeeking: next });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border border-border bg-white" open={open} onToggle={(e) => { const o = (e.target as HTMLDetailsElement).open; setOpen(o); if (o && !data) void load(); }}>
      <summary className="cursor-pointer px-3 py-2 text-[14.5px] font-extrabold text-ink">Lịch sử ứng tuyển của tôi</summary>
      <div className="px-3 pb-3 flex flex-col gap-2">
        {err && <div className="text-[13px] font-bold text-critical">{err}</div>}
        {!data && !err && <div className="text-[13.5px] text-ink-muted">Đang tải…</div>}
        {data && (
          <>
            <div className={`rounded-lg border px-2.5 py-2 text-[13.5px] text-ink flex flex-wrap items-center gap-2 ${data.isSeeking ? 'border-border bg-white' : 'border-warning bg-warning-tint'}`}>
              {data.isSeeking ? <>Hồ sơ của bạn đang hiện cho nhà tuyển dụng.</> : <b>Hồ sơ đang tạm ẩn — nhà tuyển dụng không thấy bạn.</b>}
              <button type="button" disabled={busy} onClick={toggleSeeking} className="rounded-lg border border-primary bg-white text-primary font-bold text-[13px] px-2.5 py-1">
                {data.isSeeking ? 'Tôi đã có việc — tạm ngừng tìm' : 'Tìm việc lại'}
              </button>
            </div>
            <div className="rounded-lg border border-border bg-white px-2.5 py-2 text-[13.5px] text-ink flex flex-col gap-1.5">
              <div className="font-extrabold">Chế độ mùa thi</div>
              {data.examMode ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span>{data.examMode === 'pause' ? 'Hồ sơ đang ẩn' : 'Chỉ nhận ca cuối tuần'} đến hết <b>{data.examUntil ? new Date(data.examUntil).toLocaleDateString('vi-VN') : ''}</b>, sau đó tự hiện lại.</span>
                  <button type="button" disabled={busy} onClick={() => setExam('off')} className="rounded-lg border border-primary bg-white text-primary font-bold text-[13px] px-2.5 py-1">Tắt ngay</button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="exam-until" className="font-semibold">Hết mùa thi ngày</label>
                  <input id="exam-until" type="date" className="tvl-input !w-auto !py-1" value={examDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setExamDate(e.target.value)} />
                  <button type="button" disabled={busy || !examDate} onClick={() => setExam('pause')} className="rounded-lg border border-border-strong bg-white text-ink font-bold text-[13px] px-2.5 py-1 disabled:text-ink-faint">Tạm ẩn hồ sơ</button>
                  <button type="button" disabled={busy || !examDate} onClick={() => setExam('weekend')} className="rounded-lg border border-border-strong bg-white text-ink font-bold text-[13px] px-2.5 py-1 disabled:text-ink-faint">Chỉ nhận ca T7, CN</button>
                </div>
              )}
            </div>
            {data.kind !== 'worker' && (
              <Link href="/lao-dong-pho-thong/cv" className="self-start rounded-lg border border-primary bg-white text-primary font-bold text-[13.5px] px-3 py-1.5">Tạo CV một trang từ hồ sơ của tôi (in / lưu PDF)</Link>
            )}
            {data.items.length === 0 ? (
              <div className="text-[13.5px] text-ink-muted">Bạn chưa ứng tuyển tin nào.</div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {data.items.map((a) => (
                  <li key={a.id} className="rounded-lg border border-border bg-white px-2.5 py-2 text-[13.5px] text-ink">
                    <Link href={`/viec-lam/${a.jobId}`} className="font-extrabold text-primary hover:underline">{a.title}</Link>
                    <span className="uppercase font-bold"> — {a.company}</span>
                    <div className="text-ink-muted">{ago(a.createdAt)} · <b className="text-ink">{CALL_LABEL[a.status] ?? a.status}</b> · {STATUS_NOTE[a.status] ?? ''}{a.filled && a.status !== 'hired' ? ' · Tin đã đủ người' : ''}</div>
                    {a.interviewAt && (
                      <div className="mt-1 rounded border border-primary bg-primary-tint px-2 py-1 text-ink">
                        <b>Hẹn phỏng vấn: {fmtDateTime(a.interviewAt)}</b>{a.interviewPlace || a.workPlace ? <> tại {a.interviewPlace || a.workPlace}</> : null}
                        <div className="flex flex-wrap gap-2 mt-1">
                          <button type="button" onClick={() => downloadIcs({ id: a.id, title: a.title, company: a.company, interviewAt: a.interviewAt!, interviewPlace: a.interviewPlace, workPlace: a.workPlace })} className="rounded border border-primary bg-white text-primary font-bold text-[12.5px] px-2 py-0.5">Thêm vào lịch điện thoại (.ics)</button>
                        </div>
                        <ul className="list-disc pl-5 mt-1 text-[12.5px]">{interviewChecklist(a.channel, a.laborGroup).slice(0, 4).map((x) => (<li key={x}>{x}</li>))}</ul>
                      </div>
                    )}
                    {a.channel === 'intern' && (a.status === 'hired' || a.startedAt) && (
                      <div className="mt-1 text-[13px]">
                        {a.certRequestedAt ? (
                          <span className="font-bold text-success">Đã gửi yêu cầu xác nhận thực tập ({ago(a.certRequestedAt)}) — nhà tuyển dụng sẽ thấy trong danh sách ứng tuyển.</span>
                        ) : (
                          <button type="button" onClick={() => void requestCert(a.id)} className="rounded border border-primary bg-white text-primary font-bold text-[12.5px] px-2 py-0.5">Xin xác nhận thực tập</button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </details>
  );
}
function authToken(w: ReturnType<typeof useWorkerApply>) {
  return w.token ?? '';
}
