'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { jobsApi, type JobPosting, type MarketStats } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';
import { audienceOf } from '@/lib/ads';

// Đợt 27 (30/09/2026) — "Bảng thị trường việc làm" thay cho khối "Hoạt động trực tuyến" thô sơ ở hero trang chủ.
// - 5 thẻ số liệu (số chạy lên, đường mini 7–14 ngày) — 3 thẻ dùng số hiển thị trang chủ như cũ (vanity-stats).
// - 5 biểu đồ chuyển bằng tab, TỰ XOAY (dừng khi rê chuột/đã tự chọn): xu hướng 14 ngày, ngành nghề, địa điểm,
//   hình thức làm việc, mức lương. Biểu đồ ngành/địa điểm/hình thức BẤM ĐƯỢC → mở danh sách việc làm đã lọc sẵn.
// - Số liệu trong biểu đồ là số THẬT lấy từ CSDL (GET /jobs/stats/market + facets), không dựng số giả.
// - Dòng tin mới cuộn + gợi ý theo vai trò (khách / ứng viên / nhà tuyển dụng).

type TabId = 'trend' | 'industry' | 'location' | 'type' | 'salary';
const TABS: { id: TabId; label: string }[] = [
  { id: 'trend', label: 'Xu hướng' },
  { id: 'industry', label: 'Ngành nghề' },
  { id: 'location', label: 'Địa điểm' },
  { id: 'type', label: 'Hình thức' },
  { id: 'salary', label: 'Mức lương' },
];
// Bảng màu SÁNG (biểu đồ nằm trên nền tối của khung số liệu).
const PALETTE = ['#2F6FDB', '#E8663F', '#12A06B', '#D99A0B', '#5B7FD6', '#7A4FD6'];
const ROTATE_MS = 7000;

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function useCountUp(target: number | null, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target === null) return;
    if (reducedMotion()) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return target === null ? null : v;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const sum = (a: { n: number }[]) => a.reduce((s, x) => s + x.n, 0);
function delta(series: { n: number }[]): number | null {
  const prev = sum(series.slice(0, 7));
  const last = sum(series.slice(7));
  return prev > 0 ? Math.round(((last - prev) / prev) * 100) : null;
}
const dm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  if (values.every((v) => v === 0)) return <div className="h-4" />;
  const W = 80;
  const H = 16;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - 2 - (v / max) * (H - 5)}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-4" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Kpi({ label, value, color, series, change }: { label: string; value: number | null; color: string; series?: number[]; change?: number | null }) {
  const shown = useCountUp(value);
  return (
    <div className="mp-tile rounded-lg border border-border px-2 py-1.5 min-w-0">
      <div className="font-extrabold text-[19px] leading-none tabular-nums" style={{ color }}>
        {shown === null ? '—' : formatNumber(shown)}
      </div>
      <div className="text-[12px] font-semibold text-ink-muted leading-tight mt-1 truncate" title={label}>
        {label}
      </div>
      {series ? <div className="mt-1"><Sparkline values={series} color={color} /></div> : null}
      {change !== undefined && change !== null ? (
        <div className={`text-[11.5px] font-bold ${change >= 0 ? 'text-success' : 'text-critical'}`}>
          <span title="So với 7 ngày trước đó">{change >= 0 ? '▲' : '▼'} {Math.abs(change)}%</span>
        </div>
      ) : null}
    </div>
  );
}

function AreaChart({ data, color, title }: { data: { day: string; n: number }[]; color: string; title: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 30;
  const padL = 4;
  const padR = 4;
  const padT = 8;
  const padB = 4;
  const max = Math.max(...data.map((d) => d.n), 1) * 1.15;
  const x = (i: number) => padL + (i / (data.length - 1)) * Math.max(1, w - padL - padR);
  const y = (n: number) => padT + (1 - n / max) * (H - padT - padB);
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(d.n).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)} ${H - padB} L${x(0).toFixed(1)} ${H - padB}Z`;
  const total = sum(data);
  const ch = delta(data);
  const gid = `ar-${title.replace(/\W/g, '')}`;
  const cur = hover !== null ? data[hover] : null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[13.5px] font-extrabold text-ink whitespace-nowrap">
          {title} <span className="tabular-nums" style={{ color }}>{formatNumber(total)}</span>
          <span className="text-[12px] font-semibold text-ink-muted"> /14 ngày</span>
        </div>
        {ch !== null && (
          <span className={`text-[12px] font-bold shrink-0 ${ch >= 0 ? 'text-success' : 'text-critical'}`} title="So với 7 ngày trước đó">
            {ch >= 0 ? '▲' : '▼'} {Math.abs(ch)}%
          </span>
        )}
      </div>
      <div ref={ref} className="relative" style={{ height: H }}>
        {w > 0 && (
          <svg
            width={w}
            height={H}
            role="img"
            aria-label={`${title} 14 ngày gần đây`}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const i = Math.round(((e.clientX - r.left - padL) / Math.max(1, w - padL - padR)) * (data.length - 1));
              setHover(Math.max(0, Math.min(data.length - 1, i)));
            }}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity="0.28" />
                <stop offset="1" stopColor={color} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0.33, 0.66].map((f) => (
              <line key={f} x1={padL} x2={w - padR} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke="#94A3B8" strokeOpacity="0.5" strokeDasharray="3 4" />
            ))}
            <path d={area} fill={`url(#${gid})`} />
            <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
            {hover !== null && cur && (
              <>
                <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="#64748B" strokeOpacity="0.8" />
                <circle cx={x(hover)} cy={y(cur.n)} r="4.5" fill="#fff" stroke={color} strokeWidth="2.4" />
              </>
            )}
          </svg>
        )}
        {cur && w > 0 && (
          <div
            className="absolute top-0 -translate-x-1/2 rounded-md bg-ink text-white shadow text-[12px] font-bold px-2 py-0.5 pointer-events-none whitespace-nowrap"
            style={{ left: Math.max(40, Math.min(w - 40, x(hover as number))) }}
          >
            {dm(cur.day)}: {formatNumber(cur.n)}
          </div>
        )}
      </div>
      <div className="flex justify-between text-[11.5px] font-semibold text-ink-muted -mt-0.5">
        <span>{dm(data[0].day)}</span>
        <span>{dm(data[Math.floor(data.length / 2)].day)}</span>
        <span>{dm(data[data.length - 1].day)}</span>
      </div>
    </div>
  );
}

function Bars({ rows, href, color }: { rows: { label: string; count: number }[]; href?: (label: string) => string; color: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 30);
    return () => clearTimeout(t);
  }, []);
  const max = Math.max(...rows.map((r) => r.count), 1);
  if (rows.length === 0) return <Empty />;
  // Đợt 49 — 2 cột × 3 dòng để vừa khung cố định 80px (chiều cao bảng không đổi khi chuyển tab).
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
      {rows.slice(0, 6).map((r) => {
        const inner = (
          <>
            <span className="w-[42%] truncate text-[13px] font-bold text-ink" title={r.label}>{r.label}</span>
            <span className="flex-1 h-3 rounded-full bg-primary-tint overflow-hidden">
              <span
                className="block h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: on ? `${Math.max(4, (r.count / max) * 100)}%` : '0%', background: color }}
              />
            </span>
            <span className="w-10 text-right text-[13px] font-bold tabular-nums text-ink">{formatNumber(r.count)}</span>
          </>
        );
        return (
          <li key={r.label}>
            {href ? (
              <Link href={href(r.label)} className="flex items-center gap-2 rounded-md px-1 h-[26px] hover:bg-primary-tint transition-colors" title={`Xem việc làm: ${r.label}`}>
                {inner}
              </Link>
            ) : (
              <div className="flex items-center gap-2 px-1 h-[26px]">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Donut({ rows, href }: { rows: { label: string; count: number }[]; href: (label: string) => string }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (total === 0) return <Empty />;
  const R = 44;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 120" className="w-[78px] h-[78px] shrink-0 -rotate-90" role="img" aria-label="Cơ cấu việc làm theo hình thức">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#E2E8F0" strokeWidth="16" />
        {rows.map((r, i) => {
          const len = (r.count / total) * C;
          const seg = (
            <circle
              key={r.label}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth="16"
              strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`}
              strokeDashoffset={-acc}
            />
          );
          acc += len;
          return seg;
        })}
        <g className="rotate-90" style={{ transformOrigin: '60px 60px' }}>
          <text x="60" y="58" textAnchor="middle" fontSize="17" fontWeight="800" fill="#0F2957">{formatNumber(total)}</text>
          <text x="60" y="74" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#475569">việc làm</text>
        </g>
      </svg>
      <ul className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-3">
        {rows.slice(0, 6).map((r, i) => (
          <li key={r.label}>
            <Link href={href(r.label)} className="flex items-center gap-2 rounded-md px-1 h-[25px] hover:bg-primary-tint transition-colors" title={`Xem việc làm: ${r.label}`}>
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="flex-1 truncate text-[13.5px] font-bold text-ink">{r.label}</span>
              <span className="text-[13px] font-bold tabular-nums text-ink">{Math.round((r.count / total) * 100)}%</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Columns({ rows }: { rows: { label: string; count: number }[] }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 30);
    return () => clearTimeout(t);
  }, []);
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (total === 0) return <Empty />;
  const max = Math.max(...rows.map((r) => r.count), 1);
  const short = (l: string) => l.replace(' triệu', '').replace('Dưới ', '<').replace('Trên ', '>');
  return (
    <div title="Mức lương (triệu đồng/tháng) — các tin có ghi mức lương">
      <div className="flex items-end gap-2 h-[52px]">
        {rows.map((r, i) => (
          <div key={r.label} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${r.label}: ${r.count} tin`}>
            <span className="text-[12.5px] font-bold tabular-nums text-ink mb-0.5">{formatNumber(r.count)}</span>
            <div
              className="w-full rounded-t-md transition-[height] duration-700 ease-out"
              style={{ height: on ? `${Math.max(3, (r.count / max) * 34)}px` : '0px', background: PALETTE[i % PALETTE.length] }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-1 border-t border-border pt-1">
        {rows.map((r) => (
          <span key={r.label} className="flex-1 text-center text-[12px] font-bold text-ink truncate">{short(r.label)} tr</span>
        ))}
      </div>
    </div>
  );
}

function Empty() {
  return <div className="py-6 text-center text-[13.5px] font-semibold text-ink-muted">Chưa đủ dữ liệu để vẽ biểu đồ này.</div>;
}

export interface MarketPanelProps {
  openJobs: number | null;
  applicationsToday: number | null;
  profilesToday: number | null;
  members: number | null;
  companies: number | null;
  industries: { industry: string; count: number }[];
  locations: { location: string; count: number }[];
  jobs: JobPosting[] | null;
  minutesAgo: number[];
}

export function MarketPanel(p: MarketPanelProps) {
  const { me } = useAuth();
  const [market, setMarket] = useState<MarketStats | null>(null);
  const [tab, setTab] = useState<TabId>('trend');
  const [auto, setAuto] = useState(true);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    jobsApi.marketStats().then(setMarket).catch(() => setMarket(null));
  }, []);

  // tự xoay tab
  useEffect(() => {
    if (!auto || paused || reducedMotion()) return;
    const t = setInterval(() => {
      setTab((cur) => TABS[(TABS.findIndex((x) => x.id === cur) + 1) % TABS.length].id);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [auto, paused]);

  // dòng tin mới cuộn
  const ticker = (p.jobs ?? []).slice(0, 4);
  useEffect(() => {
    if (ticker.length < 2 || reducedMotion()) return;
    const t = setInterval(() => setTick((v) => v + 1), 3600);
    return () => clearInterval(t);
  }, [ticker.length]);
  const cur = ticker.length ? ticker[tick % ticker.length] : null;

  const industryRows = useMemo(() => p.industries.slice(0, 6).map((r) => ({ label: r.industry, count: r.count })), [p.industries]);
  const locationRows = useMemo(() => p.locations.slice(0, 6).map((r) => ({ label: r.location, count: r.count })), [p.locations]);
  const audience = audienceOf(me?.role);
  const topIndustry = p.industries[0];

  const jobsSeries = market?.newJobsDaily.map((d) => d.n);
  const appsSeries = market?.applicationsDaily.map((d) => d.n);
  const q = (k: string, v: string) => `/viec-lam?${k}=${encodeURIComponent(v)}`;

  return (
    <div
      className="rounded-2xl min-h-[180px] relative overflow-hidden p-3 flex bg-white border border-border"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
            <div className="relative w-full flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
            <h2 className="text-[15px] sm:text-[16px] font-extrabold uppercase tracking-wide text-ink">Bảng thị trường việc làm</h2>
          </div>
          {market && (
            <span className="text-[12px] font-semibold text-ink-muted">
              Cập nhật {new Date(market.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div role="tablist" aria-label="Biểu đồ thị trường" className="flex gap-1.5 overflow-x-auto no-scrollbar px-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setAuto(false);
              }}
              className={`shrink-0 rounded-full px-3 py-1 text-[13.5px] font-bold transition-colors ${
                tab === t.id ? 'bg-primary text-white' : 'bg-primary-tint text-ink hover:bg-border'
              }`}
            >
              {t.label}
            </button>
          ))}
          {auto && !paused && <span className="self-center ml-1 text-[12px] font-semibold text-ink-muted shrink-0">tự chuyển…</span>}
        </div>
        <div className="w-full p-1 flex flex-col gap-2.5">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          <Kpi label="Việc làm" value={p.openJobs} color="#2F6FDB" series={jobsSeries} change={market ? delta(market.newJobsDaily) : null} />
          <Kpi label="Ứng tuyển" value={p.applicationsToday} color="#E0424E" series={appsSeries} change={market ? delta(market.applicationsDaily) : null} />
          <Kpi label="Hồ sơ mới" value={p.profilesToday} color="#12A06B" />
          <Kpi label="Thành viên" value={p.members} color="#0F2957" />
          <Kpi label="Doanh nghiệp" value={p.companies} color="#7A4FD6" />
        </div>

        <div className="min-h-[80px] sm:h-[80px] sm:overflow-hidden" role="tabpanel">
          {tab === 'trend' &&
            (market ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                <AreaChart data={market.newJobsDaily} color="#2F6FDB" title="Việc làm đăng mới" />
                <AreaChart data={market.applicationsDaily} color="#E0424E" title="Lượt ứng tuyển" />
              </div>
            ) : (
              <Empty />
            ))}
          {tab === 'industry' && <Bars rows={industryRows} href={(l) => q('industries', l)} color="#2F6FDB" />}
          {tab === 'location' && <Bars rows={locationRows} href={(l) => q('provinces', l)} color="#12A06B" />}
          {tab === 'type' && (market ? <Donut rows={market.employmentTypes} href={(l) => q('employmentType', l)} /> : <Empty />)}
          {tab === 'salary' && (market ? <Columns rows={market.salaryBands} /> : <Empty />)}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-2 sm:flex-nowrap flex-wrap">
          {cur ? (
            <Link key={cur.id} href={`/viec-lam/${cur.id}`} className="market-ticker flex items-center gap-1.5 min-w-0 flex-1 text-[13px] hover:underline">
              <span className="shrink-0 rounded bg-accent-tint text-accent-dark font-extrabold text-[11.5px] px-1.5 py-0.5">MỚI</span>
              <span className="truncate font-bold text-ink">{cur.title}</span>
              <span className="shrink-0 text-ink-muted font-semibold">· {p.minutesAgo[tick % ticker.length] ?? 1} phút trước</span>
            </Link>
          ) : (
            <span className="text-[13px] font-semibold text-ink-muted">Đang tải tin mới…</span>
          )}
          {audience === 'employer' ? (
            <Link href="/nha-tuyen-dung/dashboard" className="shrink-0 rounded-full bg-accent text-white text-[13px] font-bold px-3 py-1 hover:bg-accent-dark">Đăng tin tuyển dụng →</Link>
          ) : audience === 'candidate' ? (
            <Link href="/ho-so" className="shrink-0 rounded-full bg-accent text-white text-[13px] font-bold px-3 py-1 hover:bg-accent-dark">Hoàn thiện hồ sơ của tôi →</Link>
          ) : topIndustry ? (
            <Link href={q('industries', topIndustry.industry)} className="shrink-0 rounded-full bg-primary-tint text-ink text-[13px] font-bold px-3 py-1 hover:bg-border-strong truncate max-w-[50%] sm:max-w-[48%]">
              Nhiều việc nhất: {topIndustry.industry} ({formatNumber(topIndustry.count)}) →
            </Link>
          ) : null}
        </div>
        </div>
      </div>
    </div>
  );
}
