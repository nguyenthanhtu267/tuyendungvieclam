'use client';

import type { CompatibilityCriterion } from '@/lib/api';

// Đợt 12ab (24/09/2026) — "Đánh giá mức độ tương thích" (radar chart), theo yêu cầu người dùng dựa
// trên ảnh mẫu careerviet.vn (sidebar trang chi tiết tin). Tự vẽ bằng SVG thuần (không thêm thư viện
// biểu đồ mới — dự án hiện chưa cài, tránh rủi ro lockfile khi triển khai lên Render/Vercel).
const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 82;
const RINGS = [0.25, 0.5, 0.75, 1];

function pointFor(index: number, total: number, ratio: number): [number, number] {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = RADIUS * ratio;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

function scoreColor(score: number): string {
  if (score >= 75) return '#16A34A'; // success
  if (score >= 50) return '#D97706'; // warning
  return '#E5484D'; // critical
}

export function CompatibilityRadar({ criteria, overall }: { criteria: CompatibilityCriterion[]; overall: number }) {
  const total = criteria.length;
  if (total < 3) return null;

  const polygonPoints = criteria.map((c, i) => pointFor(i, total, clamp01(c.score / 100))).map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Độ tương thích tổng thể ${overall}%`}>
        {/* Vòng lưới nền */}
        {RINGS.map((ratio) => {
          const pts = criteria.map((_, i) => pointFor(i, total, ratio)).map(([x, y]) => `${x},${y}`).join(' ');
          return <polygon key={ratio} points={pts} fill="none" stroke="currentColor" className="text-border" strokeWidth={1} />;
        })}
        {/* Trục từ tâm ra mỗi tiêu chí */}
        {criteria.map((c, i) => {
          const [x, y] = pointFor(i, total, 1);
          return <line key={c.key} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="currentColor" className="text-border" strokeWidth={1} />;
        })}
        {/* Vùng điểm số thực tế */}
        <polygon points={polygonPoints} fill="var(--tvl-radar-fill, rgba(37,99,235,0.22))" stroke="#2563EB" strokeWidth={2} />
        {criteria.map((c, i) => {
          const [x, y] = pointFor(i, total, clamp01(c.score / 100));
          return <circle key={c.key} cx={x} cy={y} r={3} fill={scoreColor(c.score)} />;
        })}
        {/* Nhãn tiêu chí */}
        {criteria.map((c, i) => {
          const [x, y] = pointFor(i, total, 1.24);
          return (
            <text
              key={c.key}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10.5}
              fontWeight={700}
              fill="currentColor"
              className="text-ink-muted"
            >
              {c.label}
            </text>
          );
        })}
      </svg>
      <div className="text-center -mt-2">
        <div className="text-2xl font-extrabold" style={{ color: scoreColor(overall) }}>
          {overall}%
        </div>
        <div className="text-[11px] text-ink-faint">Mức độ phù hợp tổng thể</div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10.5px] text-ink-faint mt-1">
        {criteria.map((c) => (
          <span key={c.key}>
            {c.label}: <span className="font-bold" style={{ color: scoreColor(c.score) }}>{c.score}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
