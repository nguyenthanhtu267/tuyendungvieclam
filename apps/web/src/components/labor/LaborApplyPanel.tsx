'use client';

import { useEffect, useState } from 'react';
import { workersApi, type ApplyResult, type JobPosting, type LaborIncome, type WorkerKind } from '@/lib/api';
import { KIND_LABEL, KIND_SLUG, PERK_LABEL, fmtM, slotText } from '@/lib/labor';
import { ShareButtons } from './ShareButtons';
import { GroupInvite } from './GroupInvite';
import { WorkerCredsBox, useWorkerApply } from './WorkerCreds';
import { RefreshReminder } from './RefreshReminder';

// Đợt 79/80 — tin kênh phổ thông: ứng tuyển nhanh bằng SĐT, nơi làm việc, quyền lợi, thu nhập ước tính,
// tiến độ đủ người, rủ bạn đi làm cùng (?nhom=MÃ), chia sẻ.
export function LaborApplyPanel({ job, inviteCode }: { job: JobPosting; inviteCode?: string }) {
  const channel = job.channel as WorkerKind;
  const w = useWorkerApply();
  const [msg, setMsg] = useState('');
  const [res, setRes] = useState<ApplyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<{ headcount: number; hired: number; filled: boolean; income: LaborIncome | null } | null>(null);
  const [invite, setInvite] = useState<{ valid: boolean; size: number; leader: string | null } | null>(null);

  useEffect(() => {
    workersApi.progress(job.id).then(setProg).catch(() => undefined);
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
      <div className="flex flex-wrap items-center gap-2">
        {filled ? (
          <span className="rounded-lg bg-surface-alt border border-border-strong font-extrabold text-ink px-4 py-2">Tin đã tuyển đủ người</span>
        ) : (
          <button type="button" onClick={go} disabled={busy || !!res || !w.ready} className="tvl-btn-accent !w-auto px-6 disabled:!bg-ink-faint">
            {res ? 'Đã ứng tuyển ✓' : busy ? 'Đang gửi…' : 'Ứng tuyển ngay'}
          </button>
        )}
        <ShareButtons jobId={job.id} title={job.title} />
      </div>
      {msg && <div className={`text-[14px] font-bold ${res ? 'text-success' : 'text-critical'}`}>{msg}</div>}
      {res?.groupCode && <GroupInvite jobId={job.id} title={job.title} code={res.groupCode} size={res.groupSize ?? 1} />}
    </section>
  );
}
