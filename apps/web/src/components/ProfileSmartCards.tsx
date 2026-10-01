'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { smartApi4, smartApi6, type JobGoalData, type SalaryPosition, type SkillPremium, type WeeklyDigest, type ProfileBenchmark } from '@/lib/api';

const GOAL_KEY = 'tvl_weekly_goal';

// Đợt 75 — trang hồ sơ: nhắc làm mới hồ sơ cũ, vị trí mức lương mong muốn, mục tiêu nộp đơn theo tuần.
export default function ProfileSmartCards({ token, onRefresh }: { token: string; onRefresh?: () => void }) {
  const [fresh, setFresh] = useState<{ days?: number; stale?: boolean } | null>(null);
  const [sal, setSal] = useState<SalaryPosition | null>(null);
  const [goal, setGoal] = useState<JobGoalData | null>(null);
  const [target, setTarget] = useState(5);
  const [dg, setDg] = useState<WeeklyDigest | null>(null);
  const [sp, setSp] = useState<SkillPremium | null>(null);
  const [bm, setBm] = useState<ProfileBenchmark | null>(null);
  useEffect(() => {
    try { const v = Number(localStorage.getItem(GOAL_KEY)); if (v >= 1 && v <= 50) setTarget(v); } catch { /* bỏ qua */ }
    smartApi4.freshness(token).then(setFresh).catch(() => {});
    smartApi4.salaryPosition(token).then(setSal).catch(() => {});
    smartApi4.jobGoal(token).then(setGoal).catch(() => {});
    smartApi6.weeklyDigest(token).then(setDg).catch(() => {});
    smartApi6.skillPremium(token).then(setSp).catch(() => {});
    smartApi6.benchmark(token).then(setBm).catch(() => {});
  }, [token]);
  function changeTarget(n: number) {
    const v = Math.max(1, Math.min(50, n));
    setTarget(v);
    try { localStorage.setItem(GOAL_KEY, String(v)); } catch { /* bỏ qua */ }
  }
  const weeks = goal?.weeks ?? [];
  const max = Math.max(target, ...weeks, 1);
  const done = goal?.thisWeek ?? 0;
  return (
    <div className="flex flex-col gap-3">
      {fresh?.stale && (
        <div className="rounded-xl border border-warning bg-warning-tint p-3 text-[14px] flex flex-wrap items-center justify-between gap-2" role="note">
          <span className="text-ink"><b className="text-[#7A4A00]">Hồ sơ đã {fresh.days} ngày chưa cập nhật.</b> Làm mới để nhà tuyển dụng thấy bạn ở đầu danh sách tìm hồ sơ.</span>
          {onRefresh && <button type="button" onClick={onRefresh} className="tvl-btn-primary !w-auto px-4">🔄 Làm mới hồ sơ</button>}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {goal?.hasProfile && (
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[13px] font-extrabold text-primary uppercase tracking-wide">Mục tiêu tuần này</div>
              <label className="text-[12.5px] text-ink-muted flex items-center gap-1">Mục tiêu
                <input id="weekly-goal" type="number" min={1} max={50} value={target} onChange={(e) => changeTarget(Number(e.target.value))} className="w-14 rounded border border-border px-1.5 py-0.5 text-ink" />
              </label>
            </div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-ink">{done}<span className="text-ink-muted text-base">/{target} đơn</span></div>
            <div className="mt-1 h-2 rounded-full bg-surface-alt overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (done / target) * 100)}%` }} /></div>
            <div className="mt-3 flex items-end gap-1 h-12" aria-label="Số đơn 8 tuần gần nhất">
              {weeks.map((w, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end h-full" title={`${w} đơn`}>
                  <div className={i === weeks.length - 1 ? 'bg-primary rounded-t' : 'bg-primary/40 rounded-t'} style={{ height: `${Math.max(w ? 8 : 2, (w / max) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-1 text-[12.5px] text-ink-muted">
              {goal.streak ? <>Chuỗi <b className="text-ink">{goal.streak} tuần</b> liên tiếp có nộp đơn. </> : 'Nộp 1 đơn tuần này để bắt đầu chuỗi. '}
              {done >= target ? 'Bạn đã đạt mục tiêu tuần này!' : `Còn ${target - done} đơn nữa là đạt mục tiêu.`}
            </div>
          </div>
        )}
        {sal?.hasProfile && sal.median != null && (
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="text-[13px] font-extrabold text-primary uppercase tracking-wide">Lương mong muốn so với thị trường</div>
            <div className="mt-1 text-[14px] text-ink">Bạn mong muốn <b>{sal.expected} triệu</b> — cao hơn khoảng <b>{sal.percent}%</b> tin ({sal.scope}, {sal.sample} tin).</div>
            <div className="relative mt-3 h-2 rounded-full bg-surface-alt">
              <div className="absolute top-0 h-2 rounded-full bg-primary/30" style={{ left: '25%', width: '50%' }} />
              <div className="absolute -top-1 w-1 h-4 bg-primary rounded" style={{ left: `${Math.min(98, Math.max(1, sal.percent ?? 0))}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[12px] text-ink-muted tabular-nums"><span>{sal.p25}</span><span>trung vị {sal.median}</span><span>{sal.p75} triệu</span></div>
            <div className="mt-2 text-[13px] text-ink">{sal.advice}</div>
          </div>
        )}
      </div>

      {dg?.hasProfile && (
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[13px] font-extrabold text-primary uppercase tracking-wide">Bản tin tuần này · {dg.scope}</div>
          <div className="mt-1 text-[15px] text-ink">
            <b className="tabular-nums">{dg.newJobs}</b> tin mới trong 7 ngày
            {dg.change != null && <span className={dg.change >= 0 ? 'text-success font-bold' : 'text-critical font-bold'}> ({dg.change >= 0 ? '+' : ''}{dg.change}% so với tuần trước)</span>}
            {dg.medianSalary != null && <>, lương trung vị <b>{dg.medianSalary} triệu</b>{dg.salaryChange != null && <span className="text-ink-muted"> ({dg.salaryChange >= 0 ? '+' : ''}{dg.salaryChange}%)</span>}</>}.
          </div>
          {dg.latest && dg.latest.length > 0 && (
            <ul className="mt-1 text-[14px] flex flex-col gap-0.5">
              {dg.latest.map((j) => (<li key={j.id}><Link href={`/viec-lam/${j.id}`} className="text-primary font-semibold hover:underline">{j.title}</Link> <span className="text-ink-muted">· {j.company}</span></li>))}
            </ul>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sp && sp.items && sp.items.length > 0 && (
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="text-[13px] font-extrabold text-primary uppercase tracking-wide">Kỹ năng đáng học nhất</div>
            <div className="text-[13px] text-ink-muted">Tin {sp.industry ?? 'toàn website'} có kỹ năng này trả cao hơn trung vị ({sp.baseMedian} triệu).</div>
            <ul className="mt-1.5 flex flex-col gap-1">
              {sp.items.map((i) => (<li key={i.tag} className="flex justify-between gap-2 text-[14px]"><span className="font-semibold text-ink">{i.tag} <span className="text-ink-muted font-normal">· {i.jobs} tin</span></span><span className="text-success font-bold tabular-nums">+{i.uplift}%</span></li>))}
            </ul>
          </div>
        )}
        {bm?.enough && bm.gaps && (
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="text-[13px] font-extrabold text-primary uppercase tracking-wide">Hồ sơ của bạn so với người được mời phỏng vấn</div>
            <div className="text-[13px] text-ink-muted">Ẩn danh, dựa trên {bm.sample} hồ sơ ({bm.scope}).</div>
            {bm.gaps.length === 0 ? <div className="mt-1.5 text-[14px] text-success font-semibold">Hồ sơ của bạn không thua kém nhóm này ở các tiêu chí đo được.</div> : (
              <ul className="mt-1.5 list-disc pl-4 text-[14px] text-ink flex flex-col gap-0.5">{bm.gaps.map((g) => (<li key={g}>{g}</li>))}</ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
