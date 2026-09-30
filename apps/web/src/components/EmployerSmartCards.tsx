'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { smartApi2, smartApi5, type JobPerf, type PendingApps, type TitleTestData } from '@/lib/api';
import { formatDate } from '@/lib/format';

const QUICK: { label: string; status: string; message: string; cls: string }[] = [
  { label: 'Đang xem xét', status: 'reviewing', message: 'Chúng tôi đã nhận hồ sơ và đang xem xét, sẽ phản hồi bạn trong vài ngày tới.', cls: 'border-border text-ink' },
  { label: 'Phù hợp', status: 'suitable', message: 'Hồ sơ của bạn phù hợp, chúng tôi sẽ liên hệ sớm để trao đổi thêm.', cls: 'border-success text-success' },
  { label: 'Từ chối lịch sự', status: 'rejected', message: 'Cảm ơn bạn đã quan tâm. Rất tiếc hồ sơ chưa phù hợp với vị trí lúc này; chúc bạn sớm tìm được công việc ưng ý.', cls: 'border-critical text-critical' },
];

// Đợt 75 — bảng điều khiển NTD: hồ sơ chờ trả lời + hiệu quả từng tin (gia hạn, thử tiêu đề A/B).
export default function EmployerSmartCards() {
  const { token } = useAuth();
  const [pend, setPend] = useState<PendingApps | null>(null);
  const [perf, setPerf] = useState<JobPerf[]>([]);
  const [done, setDone] = useState<Record<string, string>>({});
  const [abFor, setAbFor] = useState<string | null>(null);
  useEffect(() => {
    if (!token) return;
    smartApi5.pending(token, 3).then(setPend).catch(() => {});
    smartApi5.performance(token).then((r) => setPerf(r.items)).catch(() => {});
  }, [token]);
  async function reply(id: string, q: (typeof QUICK)[number]) {
    if (!token) return;
    setDone((d) => ({ ...d, [id]: '…' }));
    try {
      await smartApi2.updateStatusWithMessage(token, id, q.status, q.message);
      setDone((d) => ({ ...d, [id]: `✓ ${q.label}` }));
    } catch {
      setDone((d) => ({ ...d, [id]: 'Lỗi, thử lại' }));
    }
  }
  async function extend(jobId: string, days: number) {
    if (!token) return;
    try {
      const r = await smartApi5.extend(token, jobId, days);
      setPerf((p) => p.map((x) => (x.id === jobId ? { ...x, daysLeft: Math.ceil((new Date(r.deadline).getTime() - Date.now()) / 86400000), advice: `Đã gia hạn đến ${formatDate(r.deadline)}.`, level: 'good' } : x)));
    } catch { /* bỏ qua */ }
  }
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      {pend && pend.total > 0 && (
        <div className="rounded-xl bg-white border border-border p-5">
          <h2 className="font-bold text-[15px]">Hồ sơ đang chờ bạn trả lời <span className="text-critical">({pend.total})</span></h2>
          <div className="text-[13px] text-ink-muted mb-2">Chưa phản hồi quá {pend.days} ngày — trả lời nhanh giúp giữ ứng viên tốt.</div>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {pend.items.slice(0, 8).map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-2.5">
                <div className="text-[14px]"><b>{a.name}</b> · {a.jobTitle} · <span className="text-critical font-bold">chờ {a.waitDays} ngày</span></div>
                {done[a.id] ? (
                  <div className="text-[13px] font-bold text-success mt-1">{done[a.id]}</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {QUICK.map((q) => (
                      <button key={q.status} type="button" onClick={() => reply(a.id, q)} className={`rounded-full border px-2.5 py-1 text-[12.5px] font-bold bg-white hover:bg-surface-alt ${q.cls}`}>{q.label}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {perf.length > 0 && (
        <div className="rounded-xl bg-white border border-border p-5">
          <h2 className="font-bold text-[15px] mb-2">Hiệu quả tin đang đăng</h2>
          <div className="flex flex-col gap-2">
            {perf.slice(0, 6).map((j) => (
              <div key={j.id} className="rounded-lg border border-border p-2.5">
                <div className="font-bold text-[14px] truncate">{j.title}</div>
                <div className="text-[13px] text-ink-muted tabular-nums">{j.views} lượt xem (14 ngày) · {j.applications} đơn · {j.rate}% nộp{j.daysLeft != null ? ` · còn ${Math.max(0, j.daysLeft)} ngày` : ''}</div>
                <div className={`text-[13px] mt-0.5 ${j.level === 'bad' ? 'text-critical' : j.level === 'warn' ? 'text-[#7A4A00]' : 'text-success'}`}>{j.advice}</div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <button type="button" onClick={() => extend(j.id, 7)} className="rounded-full border border-primary text-primary px-2.5 py-1 text-[12.5px] font-bold hover:bg-primary-tint">Gia hạn +7 ngày</button>
                  <button type="button" onClick={() => extend(j.id, 15)} className="rounded-full border border-primary text-primary px-2.5 py-1 text-[12.5px] font-bold hover:bg-primary-tint">+15 ngày</button>
                  <button type="button" onClick={() => setAbFor(abFor === j.id ? null : j.id)} className="rounded-full border border-border px-2.5 py-1 text-[12.5px] font-bold hover:border-primary">🧪 Thử tiêu đề khác</button>
                </div>
                {abFor === j.id && <TitleTest jobId={j.id} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TitleTest({ jobId }: { jobId: string }) {
  const { token } = useAuth();
  const [d, setD] = useState<TitleTestData | null>(null);
  const [b, setB] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    if (token) smartApi5.titleTest(token, jobId).then(setD).catch(() => setD({ test: null }));
  }, [token, jobId]);
  async function run(fn: () => Promise<TitleTestData>) {
    setErr('');
    try { setD(await fn()); } catch (e) { setErr(e instanceof Error ? e.message : 'Không thực hiện được'); }
  }
  const t = d?.test;
  if (!d) return <div className="text-[13px] text-ink-muted mt-2">Đang tải…</div>;
  return (
    <div className="mt-2 rounded-lg bg-surface-alt border border-border p-3 text-[13px]">
      {(!t || t.status !== 'running') && (
        <>
          {t?.status === 'done' && <div className="mb-2 text-ink-muted">Thử nghiệm trước: {t.winner === 'b' ? 'tiêu đề B thắng' : 'giữ tiêu đề A'} ({t.a.ctr}% vs {t.b.ctr}% lượt bấm).</div>}
          <label htmlFor={`ab-${jobId}`} className="font-bold">Tiêu đề B để thử</label>
          <input id={`ab-${jobId}`} value={b} onChange={(e) => setB(e.target.value)} maxLength={120} placeholder="VD: Nhân viên kinh doanh lương 12–20 triệu tại Hà Nội" className="mt-1 w-full rounded border border-border bg-white px-2 py-1.5 text-[14px]" />
          <div className="text-ink-muted mt-1">Khách xem danh sách việc làm sẽ thấy ngẫu nhiên tiêu đề hiện tại (A) hoặc B. Cần khoảng 100 lượt hiển thị mỗi bên để so sánh.</div>
          <button type="button" disabled={b.trim().length < 8 || !token} onClick={() => token && run(() => smartApi5.startTitleTest(token, jobId, b))} className="tvl-btn-primary !w-auto px-3 py-1.5 mt-2 disabled:opacity-50">Bắt đầu thử</button>
        </>
      )}
      {t?.status === 'running' && (
        <>
          {(['a', 'b'] as const).map((k) => (
            <div key={k} className="flex justify-between gap-2 py-0.5">
              <span className="min-w-0 truncate"><b>{k.toUpperCase()}</b> · {t[k].title}</span>
              <span className="tabular-nums shrink-0">{t[k].views} xem · {t[k].clicks} bấm · <b>{t[k].ctr}%</b></span>
            </div>
          ))}
          <div className="text-ink-muted mt-1">{t.enough ? (t.leader ? `Tiêu đề ${t.leader.toUpperCase()} đang dẫn.` : 'Hai bên đang ngang nhau.') : 'Chưa đủ dữ liệu để kết luận.'}</div>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => token && run(() => smartApi5.finishTitleTest(token, jobId, true))} className="tvl-btn-primary !w-auto px-3 py-1.5">Kết thúc & dùng tiêu đề thắng</button>
            <button type="button" onClick={() => token && run(() => smartApi5.finishTitleTest(token, jobId, false))} className="tvl-btn-ghost !w-auto px-3 py-1.5">Kết thúc, giữ nguyên</button>
          </div>
        </>
      )}
      {err && <div className="text-critical mt-1">{err}</div>}
    </div>
  );
}
