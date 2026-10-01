'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CompanyLogo } from '@/components/CompanyLogo';
import { formatSalary } from '@/lib/format';
import type { ApplyResult, WorkerJobCard } from '@/lib/api';
import { PERK_SHORT, fmtM } from '@/lib/labor';
import { ShareButtons } from './ShareButtons';
import { GroupInvite } from './GroupInvite';

// Đợt 79/80 — thẻ tin kênh phổ thông: gần/xa, KTX/xe, thu nhập ước tính, hợp lịch, tiến độ đủ người, ứng tuyển nhanh + rủ bạn.
export function LaborJobList({
  jobs,
  onApply,
  emptyText = 'Chưa có tin phù hợp — hồ sơ của bạn vẫn được nhà tuyển dụng tìm thấy và liên hệ.',
}: {
  jobs: WorkerJobCard[];
  onApply?: (jobId: string) => Promise<ApplyResult>;
  emptyText?: string;
}) {
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
              <div className="text-[13.5px] text-ink flex flex-wrap gap-x-3">
                <span className="font-bold text-critical">{formatSalary(j.salaryMin ?? undefined, j.salaryMax ?? undefined)}</span>
                <span>{j.workPlaceText ?? j.provinces.join(', ')}</span>
                {j.laborGroup && <span className="text-ink-muted">{j.laborGroup}</span>}
              </div>
              {j.income && (
                <div className="text-[13px] text-ink">
                  Ước tính thực nhận <b className="text-success">~{fmtM(j.income.net)}/tháng</b>
                  {j.income.otHours > 0 && <> (gồm {j.income.otHours} giờ tăng ca)</>}
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
              {j.matched && <div className="text-[12.5px] font-bold text-success">Đúng công việc bạn mong muốn</div>}
              {(j.headcount ?? 0) > 1 && !j.filled && (j.hired ?? 0) > 0 && (
                <div className="text-[12.5px] text-ink">Đã nhận {j.hired}/{j.headcount} người</div>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {j.filled ? (
                  <span className="rounded-lg bg-surface-alt border border-border-strong text-ink font-extrabold text-[13px] px-3 py-1.5">Đã tuyển đủ người</span>
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
                <ShareButtons jobId={j.id} title={j.title} compact />
              </div>
              {st && !['busy', 'done', 'already'].includes(st) && <div className="text-[12.5px] text-critical">{st}</div>}
              {groups[j.id] && <GroupInvite jobId={j.id} title={j.title} code={groups[j.id].groupCode!} size={groups[j.id].groupSize ?? 1} compact />}
            </div>
          </article>
        );
      })}
    </div>
  );
}
