'use client';

import { useMemo, useRef, useState } from 'react';
import { formatNumber } from '@/lib/format';

// Đợt 19 (26/09/2026) — biểu đồ tự vẽ bằng SVG/HTML (không thêm thư viện) cho "Phân tích truy cập".
// Màu: bảng phân loại đã kiểm định (3 màu đầu an toàn cho người mù màu, kiểm tra mọi cặp), 1 sắc xanh cho
// độ lớn (tuần tự nhạt → đậm). Chữ luôn dùng màu chữ (ink), không dùng màu của chuỗi dữ liệu.
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'];
export const SEQ = '#2a78d6';

export function fmtDuration(ms: number): string {
  if (!ms || ms < 1000) return ms ? '<1 giây' : '0 giây';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} giây`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m} phút ${r} giây` : `${m} phút`;
  const h = Math.floor(m / 60);
  return `${h} giờ ${m % 60} phút`;
}
export const pct = (v: number, digits = 1) => `${(v * 100).toLocaleString('vi-VN', { maximumFractionDigits: digits })}%`;
export const fmtDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

// Trục chia 4 khoảng đều, bước "tròn" (1, 2, 5 × 10ⁿ) để mọi vạch là số nguyên dễ đọc.
function niceMax(v: number): number {
  const raw = Math.max(1, v) / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  const step = Math.max(1, (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p);
  return step * 4;
}

type Tip = { x: number; y: number; lines: { label: string; value: string; color?: string }[]; title: string } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-lg border border-border bg-white shadow-lg px-3 py-2 text-[11.5px] min-w-[130px]"
      style={{ left: tip.x, top: tip.y, transform: 'translate(-50%, calc(-100% - 10px))' }}
      role="status"
    >
      <div className="text-ink-faint mb-1">{tip.title}</div>
      {tip.lines.map((l) => (
        <div key={l.label} className="flex items-center gap-2 justify-between">
          <span className="flex items-center gap-1.5 text-ink-muted">
            {l.color && <span className="inline-block w-2.5 h-[3px] rounded" style={{ background: l.color }} />}
            {l.label}
          </span>
          <b className="text-ink tabular-nums">{l.value}</b>
        </div>
      ))}
    </div>
  );
}

// Biểu đồ đường theo thời gian (nhiều chuỗi CÙNG đơn vị), có đường dóng + chú giải khi rê chuột.
export function LineChart({
  labels,
  series,
  height = 220,
  titleFor,
}: {
  labels: string[];
  series: { name: string; values: number[]; color: string }[];
  height?: number;
  titleFor?: (i: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 760;
  const H = height;
  const pad = { l: 44, r: 12, t: 12, b: 26 };
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const n = labels.length;
  const x = (i: number) => pad.l + (n <= 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (n - 1));
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const labelEvery = Math.max(1, Math.ceil(n / 10));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - px);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    setHover(best);
  }

  const tip: Tip =
    hover !== null && ref.current
      ? {
          x: (x(hover) / W) * ref.current.clientWidth,
          y: (y(Math.max(...series.map((s) => s.values[hover] ?? 0))) / H) * ref.current.clientHeight,
          title: titleFor ? titleFor(hover) : labels[hover],
          lines: series.map((s) => ({ label: s.name, value: formatNumber(s.values[hover] ?? 0), color: s.color })),
        }
      : null;

  return (
    <div>
      {series.length > 1 && (
        <div className="flex flex-wrap gap-4 text-[11.5px] text-ink-muted mb-2">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-[3px] rounded" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <div ref={ref} className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto touch-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={series.map((s) => s.name).join(', ')}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#E1E6ED" strokeWidth={1} />
              <text x={pad.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10.5} fill="#8B93A1">
                {formatNumber(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text key={l + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10.5} fill="#8B93A1">
                {l}
              </text>
            ) : null,
          )}
          {series.map((s) => (
            <g key={s.name}>
              <path
                d={s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {n <= 1 && <circle cx={x(0)} cy={y(s.values[0] ?? 0)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />}
            </g>
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#8B93A1" strokeWidth={1} strokeDasharray="3 3" />
              {series.map((s) => (
                <circle key={s.name} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        <Tooltip tip={tip} />
      </div>
    </div>
  );
}

// Cột dọc (1 chuỗi) — giờ trong ngày, phân bố...
export function ColumnChart({
  items,
  height = 160,
  valueLabel = 'Lượt',
  color = SEQ,
}: {
  items: { label: string; value: number; title?: string }[];
  height?: number;
  valueLabel?: string;
  color?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="relative">
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {items.map((it, i) => (
          <div
            key={it.label + i}
            className="flex-1 h-full flex items-end relative"
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            tabIndex={0}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${it.title ?? it.label}: ${formatNumber(it.value)}`}
          >
            <div
              className="w-full rounded-t-[4px] transition-opacity"
              style={{
                height: `${Math.max(it.value > 0 ? 2 : 0, (it.value / max) * 100)}%`,
                background: color,
                opacity: hover === null || hover === i ? 1 : 0.55,
              }}
            />
            {hover === i && (
              <div className="pointer-events-none absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1.5 rounded-lg border border-border bg-white shadow-lg px-2.5 py-1.5 text-[11px] whitespace-nowrap">
                <div className="text-ink-faint">{it.title ?? it.label}</div>
                <b className="text-ink tabular-nums">{formatNumber(it.value)}</b> <span className="text-ink-muted">{valueLabel}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] mt-1">
        {items.map((it, i) => (
          <div key={it.label + i} className="flex-1 min-w-0 text-center text-[10px] text-ink-faint whitespace-nowrap overflow-visible">
            {items.length <= 24 && items.length > 12 && i % 3 !== 0 ? '' : it.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// Danh sách thanh ngang có số — dùng cho top trang, nguồn, thiết bị...
export function BarList({
  rows,
  valueFmt = (v: number) => formatNumber(v),
  color = SEQ,
  extra,
  empty = 'Chưa có dữ liệu trong khoảng ngày này',
}: {
  rows: { key: string; label: React.ReactNode; value: number; sub?: React.ReactNode }[];
  valueFmt?: (v: number) => string;
  color?: string;
  extra?: (key: string) => React.ReactNode;
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <div className="text-xs text-ink-faint py-4 text-center">{empty}</div>;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.key} className="text-[12px]">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0 flex-1 truncate text-ink">{r.label}</div>
            <div className="shrink-0 tabular-nums font-semibold text-ink">{valueFmt(r.value)}</div>
            {extra && <div className="shrink-0 tabular-nums text-ink-muted text-[11px] w-[92px] text-right">{extra(r.key)}</div>}
          </div>
          <div className="mt-1 h-[6px] rounded-full bg-surface-alt overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
          {r.sub && <div className="text-[10.5px] text-ink-faint mt-0.5">{r.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// Lưới 7 ngày × 24 giờ — màu tuần tự 1 sắc xanh (nhạt → đậm), rê chuột xem số.
export function WeekHourGrid({ grid }: { grid: number[][] }) {
  const [tip, setTip] = useState<string | null>(null);
  const max = useMemo(() => Math.max(1, ...grid.flat()), [grid]);
  const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: '28px repeat(24, minmax(0, 1fr))' }}>
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-[9.5px] text-ink-faint text-center">
              {h % 3 === 0 ? `${h}h` : ''}
            </div>
          ))}
          {grid.map((row, d) => (
            <div key={d} className="contents">
              <div className="text-[10.5px] text-ink-muted flex items-center">{days[d]}</div>
              {row.map((v, h) => (
                <div
                  key={h}
                  className="h-5 rounded-[3px] border border-transparent hover:border-ink-muted"
                  style={{ background: v ? SEQ : '#F2F4F8', opacity: v ? 0.15 + 0.85 * (v / max) : 1 }}
                  onPointerEnter={() => setTip(`${days[d]}, ${h}h–${h + 1}h: ${formatNumber(v)} lượt xem`)}
                  onPointerLeave={() => setTip(null)}
                  title={`${days[d]}, ${h}h–${h + 1}h: ${formatNumber(v)} lượt xem`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2 text-[11px] text-ink-muted min-h-[18px]">
          <span>{tip ?? 'Rê chuột lên ô để xem số lượt xem'}</span>
          <span className="flex items-center gap-1.5">
            Ít
            {[0.15, 0.4, 0.65, 1].map((o) => (
              <span key={o} className="inline-block w-4 h-3 rounded-[2px]" style={{ background: SEQ, opacity: o }} />
            ))}
            Nhiều
          </span>
        </div>
      </div>
    </div>
  );
}

// Ô chỉ số lớn + so với kỳ trước.
export function Kpi({
  label,
  value,
  prev,
  raw,
  prevRaw,
  lowerIsBetter,
  hint,
}: {
  label: string;
  value: string;
  prev?: string;
  raw: number;
  prevRaw?: number;
  lowerIsBetter?: boolean;
  hint?: string;
}) {
  let delta: React.ReactNode = null;
  if (prevRaw !== undefined) {
    if (prevRaw === 0 && raw === 0) delta = <span className="text-ink-faint">— như kỳ trước</span>;
    else if (prevRaw === 0) delta = <span className="text-ink-muted">mới (kỳ trước 0)</span>;
    else {
      const ch = (raw - prevRaw) / prevRaw;
      const up = ch > 0;
      const good = ch === 0 ? null : lowerIsBetter ? !up : up;
      delta = (
        <span className={good === null ? 'text-ink-faint' : good ? 'text-success' : 'text-critical'}>
          {ch === 0 ? '—' : up ? '▲' : '▼'} {pct(Math.abs(ch), 0)} <span className="text-ink-faint">so với kỳ trước{prev ? ` (${prev})` : ''}</span>
        </span>
      );
    }
  }
  return (
    <div className="rounded-xl bg-white border border-border p-3.5" title={hint}>
      <div className="text-[11.5px] text-ink-muted">{label}</div>
      <div className="text-[22px] font-extrabold text-ink tabular-nums leading-tight mt-0.5">{value}</div>
      <div className="text-[10.5px] mt-1">{delta}</div>
    </div>
  );
}
