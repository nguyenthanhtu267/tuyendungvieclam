'use client';

import { useEffect, useState } from 'react';
import { workersApi, type WorkerJobCard, type ApplyResult, type JobPosting, type LaborIncome, type WorkerKind } from '@/lib/api';
import { KIND_LABEL, KIND_SLUG, PERK_LABEL, fmtM, slotText } from '@/lib/labor';
import { ShareButtons } from './ShareButtons';
import { GroupInvite } from './GroupInvite';
import { WorkerCredsBox, useWorkerApply, whoOf } from './WorkerCreds';
import { LaborJobList, TrustBadge, introText } from './LaborJobList';
import { interviewChecklist } from '@/lib/labor-extra';
import { useSavedJobs } from './saved';
import { RefreshReminder } from './RefreshReminder';
import { AnswerTips, FitBox, extraLines } from './JobExtraBlocks';

// Đợt 79/80 — tin kênh phổ thông: ứng tuyển nhanh bằng SĐT, nơi làm việc, quyền lợi, thu nhập ước tính,
// tiến độ đủ người, rủ bạn đi làm cùng (?nhom=MÃ), chia sẻ.
export function LaborApplyPanel({ job, inviteCode }: { job: JobPosting; inviteCode?: string }) {
  const channel = job.channel as WorkerKind;
  const w = useWorkerApply();
  const [msg, setMsg] = useState('');
  const [res, setRes] = useState<ApplyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<{ headcount: number; hired: number; filled: boolean; income: LaborIncome | null } | null>(null);
  const [card, setCard] = useState<WorkerJobCard | null>(null);
  const [similar, setSimilar] = useState<WorkerJobCard[]>([]);
  const saved = useSavedJobs();
  const [copied, setCopied] = useState(false);
  const [rep, setRep] = useState<{ open: boolean; reason: string; note: string; done: boolean; err: string }>({ open: false, reason: 'scam', note: '', done: false, err: '' });
  const [invite, setInvite] = useState<{ valid: boolean; size: number; leader: string | null } | null>(null);

  useEffect(() => {
    workersApi.progress(job.id).then(setProg).catch(() => undefined);
    workersApi.cards([job.id]).then((r) => setCard(r.items[0] ?? null)).catch(() => undefined);
    if (inviteCode) workersApi.groupInfo(job.id, inviteCode).then(setInvite).catch(() => undefined);
  }, [job.id, inviteCode]);

  async function go() {
    setMsg('');
    setBusy(true);
    try {
      const r = await w.apply(job.id, invite?.valid ? inviteCode : undefined);
      setRes(r);
      setMsg(
        r.already
          ? 'Bạn đã ứng tuyển tin này trước đó. Nhà tuyển dụng sẽ gọi cho bạn.'
          : r.joinedGroup
            ? `Đã gửi và vào nhóm của ${invite?.leader ?? 'bạn bè'}! Nhà tuyển dụng sẽ gọi vào số điện thoại của bạn.`
            : 'Đã gửi! Nhà tuyển dụng sẽ gọi vào số điện thoại của bạn.',
      );
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const who = whoOf(w);
  async function copyIntro() {
    if (!who) return;
    const text = introText({ title: job.title, company: job.company ? { id: job.company.id, name: job.company.name, logoUrl: null } : null }, who);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Chép tin nhắn này:', text);
    }
  }
  async function sendReport() {
    setRep((r) => ({ ...r, err: '' }));
    try {
      await workersApi.reportJob(job.id, rep.reason, rep.note.trim() || undefined);
      setRep((r) => ({ ...r, done: true }));
    } catch (e) {
      setRep((r) => ({ ...r, err: (e as Error).message }));
    }
  }
  useEffect(() => {
    if (prog?.filled) workersApi.similar(job.id).then((r) => setSimilar(r.items)).catch(() => undefined);
  }, [prog?.filled, job.id]);
  const wageWarn = (card?.warnings ?? []).filter((x) => /lương tối thiểu/i.test(x));
  const wp = job.workPlace;
  const place = wp ? [wp.mode === 'new' ? wp.newWard : wp.oldWard, wp.mode === 'old' ? wp.oldDistrict : null, wp.province].filter(Boolean).join(', ') : null;
  const inc = prog?.income;
  const filled = prog?.filled;
  return (
    <section id="labor-apply" className="mt-3 rounded-xl border-2 border-accent bg-white p-4 flex flex-col gap-2.5">
      <RefreshReminder />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-extrabold text-[18px] text-ink">Ứng tuyển nhanh — không cần CV</h2>
        <span className="rounded-full bg-[#FFD84D] text-[#C8102E] font-extrabold text-[12.5px] px-2.5 py-1 uppercase">Tin tuyển {KIND_LABEL[channel].toLowerCase()}</span>
      </div>

      {card?.trust && <div><TrustBadge t={card.trust} /></div>}
      {wageWarn.length > 0 && (
        <div role="alert" className="rounded-lg border border-critical bg-critical-tint px-3 py-2 text-[13.5px] font-bold text-critical">
          Cảnh báo lương: {wageWarn.join('; ')}. Mức thấp hơn lương tối thiểu là trái luật — hãy hỏi rõ nhà tuyển dụng hoặc góp ý về tin.
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-2 text-[14px] text-ink">
        {place && <div><b>Nơi làm việc:</b> {place}</div>}
        {prog && prog.headcount > 1 && (
          <div>
            <b>Tiến độ:</b> {filled ? <span className="font-extrabold text-critical">Đã tuyển đủ {prog.headcount} người</span> : <>đã nhận {prog.hired}/{prog.headcount} người</>}
            {!filled && prog.headcount > 1 && (
              <div className="mt-1 h-2 rounded-full bg-surface-alt overflow-hidden"><div className="h-full bg-success" style={{ width: `${Math.min(100, (prog.hired / prog.headcount) * 100)}%` }} /></div>
            )}
          </div>
        )}
        {extraLines(channel, job.laborExtra).length > 0 && <div className="md:col-span-2"><b>{channel === 'intern' ? 'Thông tin thực tập' : 'Yêu cầu & điều kiện'}:</b> {extraLines(channel, job.laborExtra).join(' · ')}</div>}
        {card?.hourly?.monthEstimate ? <div className="md:col-span-2"><b>Ước tính thu nhập:</b> <span className="font-extrabold text-success">~{(card.hourly.monthEstimate / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} triệu/tháng</span> nếu làm đủ số giờ</div> : null}
        {(job.laborSchedule ?? []).length > 0 && <div><b>Ca cần người:</b> {slotText(job.laborSchedule ?? [])}</div>}
        {(job.laborPerks ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 md:col-span-2">
            {(job.laborPerks ?? []).map((p) => (
              <span key={p} className={`rounded font-bold text-[12.5px] px-2 py-0.5 ${p === 'no_fee' ? 'bg-success-tint text-success' : 'bg-primary-tint text-primary'}`}>{PERK_LABEL[p]}</span>
            ))}
          </div>
        )}
      </div>

      {inc && (
        <div className="rounded-lg border border-border p-2.5 text-[13.5px] text-ink">
          <div className="font-extrabold text-[15px]">Ước tính thu nhập: <span className="text-success">~{fmtM(inc.net)}/tháng thực nhận</span></div>
          <div className="text-ink mt-0.5">
            Lương cơ bản {fmtM(inc.base)}
            {inc.ot > 0 && <> + tăng ca {inc.otHours} giờ ×150% ≈ {fmtM(inc.ot)}</>}
            {inc.night > 0 && <> + làm đêm {inc.nightHours} giờ (+30%) ≈ {fmtM(inc.night)}</>}
            {inc.allowance > 0 && <> + phụ cấp {fmtM(inc.allowance)}</>} = <b>{fmtM(inc.gross)}</b>, trừ BHXH-BHYT-BHTN 10,5% lương cơ bản ({fmtM(inc.insurance)}).
          </div>
          <div className="text-[12px] text-ink-muted mt-0.5">Tính theo Bộ luật Lao động 2019 (26 ngày × 8 giờ/tháng); con số thực tế phụ thuộc chính sách công ty.</div>
        </div>
      )}

      {invite && invite.size > 0 && !res && (
        <div className="rounded-lg border border-primary bg-primary-tint px-3 py-2 text-[14px] text-ink">
          {invite.valid ? (
            <><b>{invite.leader ?? 'Bạn của bạn'}</b> rủ bạn đi làm cùng (nhóm {invite.size}/5). Ứng tuyển bên dưới để vào chung nhóm.</>
          ) : (
            <>Nhóm rủ bạn này đã đủ 5 người — bạn vẫn có thể ứng tuyển riêng.</>
          )}
        </div>
      )}

      {!filled && <WorkerCredsBox w={w} slug={KIND_SLUG[channel]} />}
      {!filled && <FitBox jobId={job.id} w={w} />}
      <div className="flex flex-wrap items-center gap-2">
        {filled ? (
          <span className="rounded-lg bg-surface-alt border border-border-strong font-extrabold text-ink px-4 py-2">Tin đã tuyển đủ người</span>
        ) : (
          <button type="button" onClick={go} disabled={busy || !!res || !w.ready} className="tvl-btn-accent !w-auto px-6 disabled:!bg-ink-faint">
            {res ? 'Đã ứng tuyển ✓' : busy ? 'Đang gửi…' : 'Ứng tuyển ngay'}
          </button>
        )}
        <button type="button" aria-pressed={saved.has(job.id)} onClick={() => saved.toggle(job.id)} className={`rounded-lg border font-bold text-[14px] px-3 py-2 ${saved.has(job.id) ? 'border-critical bg-critical-tint text-critical' : 'border-border-strong bg-white text-ink'}`}>
          {saved.has(job.id) ? '♥ Đã lưu tin' : '♡ Lưu tin'}
        </button>
        <ShareButtons jobId={job.id} title={job.title} />
      </div>
      {msg && <div className={`text-[14px] font-bold ${res ? 'text-success' : 'text-critical'}`}>{msg}</div>}
      {res && !res.already && (res.missing ?? []).length > 0 && <div className="text-[13.5px] text-ink">Lưu ý khi được gọi: {(res.missing ?? []).join('; ')}.</div>}
      <details className="rounded-lg border border-border bg-white">
        <summary className="cursor-pointer px-3 py-2 text-[14px] font-extrabold text-ink">Chuẩn bị đi phỏng vấn — mang gì, hỏi gì</summary>
        <ul className="list-disc pl-8 pr-3 pb-3 text-[13.5px] text-ink flex flex-col gap-0.5">
          {interviewChecklist(channel, job.laborGroup).map((x) => (<li key={x}>{x}</li>))}
        </ul>
      </details>
      <AnswerTips kind={channel} />
      {filled && (
        <div className="flex flex-col gap-1.5">
          <div className="font-extrabold text-[15px] text-ink">Tin này đã đủ người — các tin tương tự còn nhận</div>
          {similar.length === 0 ? <div className="text-[13.5px] text-ink-muted">Đang tìm tin tương tự…</div> : <LaborJobList jobs={similar} compare={false} who={who} onApply={(id) => w.apply(id)} />}
        </div>
      )}
      {who && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={copyIntro} className="rounded-lg border border-primary bg-white text-primary font-bold text-[13.5px] px-3 py-1.5">
            {copied ? 'Đã chép — dán vào Zalo/tin nhắn' : 'Chép tin nhắn tự giới thiệu gửi nhà tuyển dụng'}
          </button>
        </div>
      )}
      {res?.groupCode && <GroupInvite jobId={job.id} title={job.title} code={res.groupCode} size={res.groupSize ?? 1} />}
      <div className="border-t border-border pt-2">
        {!rep.open ? (
          <button type="button" onClick={() => setRep({ ...rep, open: true })} className="text-[13px] font-bold text-ink underline">Góp ý về tin này (thông tin chưa đúng, có thu phí…)</button>
        ) : rep.done ? (
          <div className="text-[13.5px] font-bold text-success">Cảm ơn bạn. Quản trị viên sẽ kiểm tra tin này.</div>
        ) : (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border-strong bg-white p-2.5">
            <label className="text-[13px] font-bold text-ink flex flex-col gap-1" htmlFor="lr-reason">Lý do
              <select id="lr-reason" className="tvl-input" value={rep.reason} onChange={(e) => setRep({ ...rep, reason: e.target.value })}>
                <option value="scam">Có dấu hiệu lừa đảo / thu phí / giữ giấy tờ</option>
                <option value="wrong_info">Thông tin sai sự thật (lương, nơi làm…)</option>
                <option value="expired">Đã tuyển đủ / không còn tuyển</option>
                <option value="duplicate">Tin trùng lặp</option>
                <option value="other">Lý do khác</option>
              </select>
            </label>
            <textarea id="lr-note" aria-label="Ghi chú" className="tvl-input" rows={2} maxLength={500} placeholder="Mô tả ngắn (không bắt buộc)" value={rep.note} onChange={(e) => setRep({ ...rep, note: e.target.value })} />
            {rep.err && <div className="text-[13px] font-bold text-critical">{rep.err}</div>}
            <div className="flex gap-2">
              <button type="button" onClick={sendReport} className="rounded-lg bg-critical text-white font-extrabold text-[13px] px-3 py-1.5">Gửi báo cáo</button>
              <button type="button" onClick={() => setRep({ ...rep, open: false })} className="rounded-lg border border-border-strong bg-white font-bold text-[13px] px-3 py-1.5 text-ink">Huỷ</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
