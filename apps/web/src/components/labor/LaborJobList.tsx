'use client';

import Link from '@/components/SmartLink';
import { useState } from 'react';
import { CompanyLogo } from '@/components/CompanyLogo';
import { formatSalary } from '@/lib/format';
import type { ApplyResult, WorkerJobCard, WorkerKind } from '@/lib/api';
import { extraLines } from './JobExtraBlocks';
import { PERK_LABEL, PERK_SHORT, fmtM, slotText } from '@/lib/labor';
import { travelCostMonth } from '@/lib/labor-extra';
import { useSavedJobs } from './saved';
import type { TrustInfo } from '@/lib/api';

/** Đợt 83 — nhãn uy tín nhà tuyển dụng (phản hồi ứng viên). */
export function TrustBadge({ t }: { t?: TrustInfo | null }) {
  if (!t) return null;
  if (t.score == null) return <span className="rounded bg-surface-alt border border-border text-ink text-[12px] font-bold px-1.5 py-0.5">Nhà tuyển dụng mới</span>;
  const good = t.score >= 75;
  const mid = t.score >= 50;
  return (
    <span title={`Gọi lại ${t.callRate}% ứng viên · phản hồi trung bình ${t.avgHours ?? '—'} giờ · ${t.reports} báo cáo`} className={`rounded border text-[12px] font-bold px-1.5 py-0.5 ${good ? 'border-success bg-success-tint text-success' : mid ? 'border-warning bg-warning-tint text-ink' : 'border-critical bg-critical-tint text-critical'}`}>
      Uy tín {t.score}/100 — {t.label}
    </span>
  );
}
import { ShareButtons } from './ShareButtons';
import { GroupInvite } from './GroupInvite';

// Đợt 79/80 — thẻ tin kênh phổ thông: gần/xa, KTX/xe, thu nhập ước tính, hợp lịch, tiến độ đủ người, ứng tuyển nhanh + rủ bạn.
export interface IntroWho { name: string; phone?: string; kindLabel: string; place?: string; slots?: string }
/** Đợt 81 — câu giới thiệu soạn sẵn để ứng viên nhắn Zalo/SMS cho nhà tuyển dụng. */
export function introText(j: Pick<WorkerJobCard, 'title' | 'company'>, w: IntroWho) {
  return `Chào anh/chị, em là ${w.name}, ${w.kindLabel.toLowerCase()}${w.place ? `, đang ở ${w.place}` : ''}. Em thấy tin tuyển "${j.title}"${j.company?.name ? ` của ${j.company.name}` : ''} trên Tuyển Dụng Việc Làm và muốn ứng tuyển.${w.slots ? ` Em có thể đi làm: ${w.slots}.` : ''}${w.phone ? ` Anh/chị gọi hoặc nhắn giúp em theo số ${w.phone}.` : ''} Em cảm ơn ạ!`;
}

export function LaborJobList({
  jobs,
  onApply,
  who,
  compare = true,
  emptyText = 'Chưa có tin phù hợp — hồ sơ của bạn vẫn được nhà tuyển dụng tìm thấy và liên hệ.',
}: {
  jobs: WorkerJobCard[];
  onApply?: (jobId: string) => Promise<ApplyResult>;
  who?: IntroWho | null;
  compare?: boolean;
  emptyText?: string;
}) {
  const saved = useSavedJobs();
  const [picked, setPicked] = useState<WorkerJobCard[]>([]);
  const [showCmp, setShowCmp] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const togglePick = (j: WorkerJobCard) => setPicked((p) => (p.some((x) => x.id === j.id) ? p.filter((x) => x.id !== j.id) : p.length >= 3 ? p : [...p, j]));
  async function copyIntro(j: WorkerJobCard) {
    if (!who) return;
    try {
      await navigator.clipboard.writeText(introText(j, who));
      setCopied(j.id);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      window.prompt('Chép tin nhắn này:', introText(j, who));
    }
  }
  const [state, setState] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<Record<string, ApplyResult>>({});
  async function apply(id: string) {
    if (!onApply) return;
    setState((s) => ({ ...s, [id]: 'busy' }));
    try {
      const r = await onApply(id);
      setState((s) => ({ ...s, [id]: r.already ? 'already' : 'done' }));
      if (r.groupCode) setGroups((g) => ({ ...g, [id]: r }));
    } catch (e) {
      setState((s) => ({ ...s, [id]: (e as Error).message || 'Lỗi' }));
    }
  }
  if (!jobs.length) return <div className="rounded-xl border border-border bg-white p-4 text-[14px] text-ink-muted">{emptyText}</div>;
  return (
    <>
    <div className="grid md:grid-cols-2 gap-2">
      {jobs.map((j) => {
        const st = state[j.id];
        const perks = (j.perks ?? []).filter((p) => p !== 'no_fee');
        return (
          <article key={j.id} className={`rounded-xl border bg-white p-3 flex gap-3 ${j.filled ? 'border-border opacity-100' : 'border-border'}`}>
            <CompanyLogo name={j.company?.name ?? ''} logoUrl={j.company?.logoUrl ?? undefined} size={48} />
            <div className="min-w-0 flex-1 flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/viec-lam/${j.id}`} className="font-extrabold text-[15.5px] text-ink hover:text-primary leading-snug">
                  {j.title}
                  {j.isUrgent && <span className="ml-1.5 align-middle rounded bg-critical text-white text-[11px] font-extrabold px-1.5 py-0.5">URGENT</span>}
                </Link>
                {j.distance && <span className="shrink-0 rounded-lg bg-success-tint text-success font-extrabold text-[12.5px] px-2 py-0.5">{j.distance.label}</span>}
              </div>
              <div className="text-[13px] font-bold text-ink uppercase truncate">{j.company?.name}</div>
              {j.trust && <div><TrustBadge t={j.trust} /></div>}
              {(j.warnings ?? []).length > 0 && (
                <div role="alert" className="rounded-lg border border-critical bg-critical-tint px-2 py-1 text-[12.5px] font-bold text-critical">
                  Cẩn trọng: {(j.warnings ?? []).join('; ')}. Không nộp tiền hay giao giấy tờ gốc trước khi đến công ty xác minh.
                </div>
              )}
              <div className="text-[13.5px] text-ink flex flex-wrap gap-x-3">
                <span className="font-bold text-critical">{formatSalary(j.salaryMin ?? undefined, j.salaryMax ?? undefined)}</span>
                <span>{j.workPlaceText ?? j.provinces.join(', ')}</span>
                {j.laborGroup && <span className="text-ink-muted">{j.laborGroup}</span>}
              </div>
              {(j.shiftTags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 text-[12px]">
                  {(j.shiftTags ?? []).map((x) => (
                    <span key={x} className="rounded border border-border-strong text-ink-muted font-semibold px-1.5 py-0.5">🕒 {x}</span>
                  ))}
                </div>
              )}
              {j.income && (
                <div className="text-[13px] text-ink">
                  Ước tính thực nhận <b className="text-success">~{fmtM(j.income.net)}/tháng</b>
                  {j.income.otHours > 0 && <> (gồm {j.income.otHours} giờ tăng ca)</>}
                </div>
              )}
              {j.income && travelCostMonth(j) != null && (
                <div className="text-[12.5px] text-ink">
                  {travelCostMonth(j) === 0 ? <>Có xe đưa đón — không tốn tiền đi lại.</> : <>Đi lại ước tính ~{fmtM(travelCostMonth(j)!)}/tháng → còn lại <b className="text-success">~{fmtM(Math.max(0, Math.round((j.income.net - travelCostMonth(j)!) * 10) / 10))}</b> sau chi phí đi lại.</>}
                </div>
              )}
              {(perks.length > 0 || j.perks?.includes('no_fee') || j.scheduleFit) && (
                <div className="flex flex-wrap gap-1">
                  {perks.map((p) => (
                    <span key={p} className="rounded bg-primary-tint text-primary font-bold text-[12px] px-1.5 py-0.5">{PERK_SHORT[p]}</span>
                  ))}
                  {j.perks?.includes('no_fee') && <span className="rounded bg-success-tint text-success font-bold text-[12px] px-1.5 py-0.5">Không thu phí</span>}
                  {j.scheduleFit && <span className="rounded bg-success text-white font-bold text-[12px] px-1.5 py-0.5">Hợp lịch học của bạn</span>}
                </div>
              )}
              {(j.hourly || extraLines(j.channel as WorkerKind, j.laborExtra).length > 0) && (
                <div className="text-[12.5px] text-ink">
                  {j.hourly?.monthEstimate ? <>Làm đủ giờ ước tính <b className="text-success">~{(j.hourly.monthEstimate / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} triệu/tháng</b>. </> : null}
                  {extraLines(j.channel as WorkerKind, j.laborExtra).join(' · ')}
                </div>
              )}
              {j.fit && (j.fit.missing.length > 0 || j.fit.ok.length > 0) && (
                <div className={`text-[12.5px] font-bold ${j.fit.missing.length ? 'text-critical' : 'text-success'}`}>
                  {j.fit.missing.length ? `Còn thiếu: ${j.fit.missing.slice(0, 2).join('; ')}${j.fit.missing.length > 2 ? '…' : ''}` : 'Khớp yêu cầu của tin'}
                </div>
              )}
              {j.matched && <div className="text-[12.5px] font-bold text-success">Đúng công việc bạn mong muốn</div>}
              {(j.headcount ?? 0) > 1 && !j.filled && (j.hired ?? 0) > 0 && (
                <div className="text-[12.5px] text-ink">
                  Đã nhận {j.hired}/{j.headcount} người
                  {(j.hired ?? 0) / (j.headcount ?? 1) >= 0.7 && <b className="ml-1.5 text-critical">Sắp đủ người — nên ứng tuyển sớm</b>}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {j.filled || j.closed ? (
                  <span className="rounded-lg bg-surface-alt border border-border-strong text-ink font-extrabold text-[13px] px-3 py-1.5">{j.closed ? 'Tin đã đóng' : 'Đã tuyển đủ người'}</span>
                ) : (
                  onApply && (
                    <button
                      type="button"
                      disabled={st === 'busy' || st === 'done' || st === 'already'}
                      onClick={() => apply(j.id)}
                      className="rounded-lg bg-accent text-white font-extrabold text-[13px] px-3 py-1.5 disabled:bg-success"
                    >
                      {st === 'done' ? 'Đã ứng tuyển ✓' : st === 'already' ? 'Bạn đã ứng tuyển' : st === 'busy' ? 'Đang gửi…' : 'Ứng tuyển nhanh'}
                    </button>
                  )
                )}
                <button
                  type="button"
                  aria-pressed={saved.has(j.id)}
                  onClick={() => saved.toggle(j.id)}
                  className={`rounded-lg border font-bold text-[13px] px-2.5 py-1.5 ${saved.has(j.id) ? 'border-critical bg-critical-tint text-critical' : 'border-border-strong bg-white text-ink'}`}
                >
                  {saved.has(j.id) ? '♥ Đã lưu' : '♡ Lưu tin'}
                </button>
                {compare && (
                  <label className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[13px] font-bold cursor-pointer ${picked.some((x) => x.id === j.id) ? 'border-primary bg-primary-tint text-primary' : 'border-border-strong bg-white text-ink'}`} htmlFor={`cmp-${j.id}`}>
                    <input id={`cmp-${j.id}`} type="checkbox" className="w-4 h-4" checked={picked.some((x) => x.id === j.id)} disabled={!picked.some((x) => x.id === j.id) && picked.length >= 3} onChange={() => togglePick(j)} />
                    So sánh
                  </label>
                )}
                <ShareButtons jobId={j.id} title={j.title} compact />
              </div>
              {st && !['busy', 'done', 'already'].includes(st) && <div className="text-[12.5px] text-critical">{st}</div>}
              {who && (st === 'done' || st === 'already') && (
                <button type="button" onClick={() => copyIntro(j)} className="self-start rounded-lg border border-primary bg-white text-primary font-bold text-[12.5px] px-2.5 py-1">
                  {copied === j.id ? 'Đã chép — dán vào Zalo/tin nhắn' : 'Chép tin nhắn tự giới thiệu gửi nhà tuyển dụng'}
                </button>
              )}
              {groups[j.id] && <GroupInvite jobId={j.id} title={j.title} code={groups[j.id].groupCode!} size={groups[j.id].groupSize ?? 1} compact />}
            </div>
          </article>
        );
      })}
    </div>
    {picked.length > 0 && (
      <div className="sticky bottom-2 z-20 mx-auto max-w-xl rounded-xl border-2 border-primary bg-white p-2.5 flex flex-wrap items-center gap-2 shadow-lg">
        <span className="text-[13.5px] font-bold text-ink">Đã chọn {picked.length}/3 tin để so sánh</span>
        <button type="button" disabled={picked.length < 2} onClick={() => setShowCmp(true)} className="rounded-lg bg-primary text-white font-extrabold text-[13px] px-3 py-1.5 disabled:bg-ink-faint">So sánh ngay</button>
        <button type="button" onClick={() => setPicked([])} className="rounded-lg border border-border-strong bg-white text-ink font-bold text-[13px] px-3 py-1.5">Bỏ chọn</button>
      </div>
    )}
    {showCmp && <CompareModal jobs={picked} onClose={() => setShowCmp(false)} />}
    </>
  );
}

function CompareModal({ jobs, onClose }: { jobs: WorkerJobCard[]; onClose: () => void }) {
  const best = (f: (j: WorkerJobCard) => number | null, low = false) => {
    const v = jobs.map(f);
    const nums = v.filter((x): x is number => x != null);
    if (!nums.length) return -1;
    const t = low ? Math.min(...nums) : Math.max(...nums);
    return v.indexOf(t);
  };
  const rows: { label: string; cell: (j: WorkerJobCard) => string; win?: number }[] = [
    { label: 'Công ty', cell: (j) => j.company?.name ?? '—' },
    { label: 'Lương đăng', cell: (j) => formatSalary(j.salaryMin ?? undefined, j.salaryMax ?? undefined) },
    { label: 'Thực nhận ước tính', cell: (j) => (j.income ? `~${fmtM(j.income.net)}/tháng` : 'Chưa có'), win: best((j) => j.income?.net ?? null) },
    { label: 'Còn lại sau tiền đi lại', cell: (j) => { const t = travelCostMonth(j); return j.income && t != null ? `~${fmtM(Math.max(0, Math.round((j.income.net - t) * 10) / 10))}/tháng` : 'Chưa rõ'; }, win: best((j) => { const t = travelCostMonth(j); return j.income && t != null ? j.income.net - t : null; }) },
    { label: 'Uy tín nhà tuyển dụng', cell: (j) => (j.trust ? (j.trust.score == null ? 'Nhà tuyển dụng mới' : `${j.trust.score}/100 — ${j.trust.label}`) : '—'), win: best((j) => j.trust?.score ?? null) },
    { label: 'Khoảng cách', cell: (j) => j.distance?.label ?? 'Chưa rõ (điền hồ sơ để tính)', win: best((j) => j.distance?.km ?? null, true) },
    { label: 'Nơi làm việc', cell: (j) => j.workPlaceText ?? j.provinces.join(', ') },
    { label: 'Quyền lợi', cell: (j) => ((j.perks ?? []).map((p) => PERK_LABEL[p] ?? p).join('; ') || 'Không nêu'), win: best((j) => (j.perks ?? []).length) },
    { label: 'Ca cần người', cell: (j) => (j.schedule && j.schedule.length ? slotText(j.schedule) : 'Không nêu') },
    { label: 'Tuyển / đã nhận', cell: (j) => `${j.headcount ?? 1} / ${j.hired ?? 0}${j.filled ? ' (đủ người)' : ''}` },
    { label: 'Cảnh báo', cell: (j) => ((j.warnings ?? []).length ? (j.warnings ?? []).join('; ') : 'Không phát hiện') },
  ];
  return (
    <div role="dialog" aria-modal="true" aria-label="So sánh tin" className="fixed inset-0 z-50 flex items-center justify-center bg-black p-3" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl bg-white border border-border-strong p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="tvl-title font-extrabold text-[17px] text-ink">So sánh {jobs.length} tin</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-border-strong bg-white px-3 py-1 font-bold text-ink">Đóng</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px] text-ink">
            <thead>
              <tr>
                <th className="border border-border bg-surface-alt p-2 text-left w-32"> </th>
                {jobs.map((j) => (
                  <th key={j.id} className="border border-border bg-surface-alt p-2 text-left align-top"><Link href={`/viec-lam/${j.id}`} className="text-primary underline">{j.title}</Link></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th className="border border-border bg-white p-2 text-left align-top font-bold">{r.label}</th>
                  {jobs.map((j, i) => (
                    <td key={j.id} className={`border border-border p-2 align-top ${r.win === i ? 'bg-success-tint font-bold text-success' : 'bg-white'}`}>{r.cell(j)}{r.win === i && ' ✓'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-[12.5px] text-ink-muted mt-1.5">Ô xanh là tin nổi bật nhất ở mục đó. Thực nhận là ước tính theo luật lao động, không phải cam kết của công ty.</div>
      </div>
    </div>
  );
}
