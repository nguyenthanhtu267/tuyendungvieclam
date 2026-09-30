import { useId } from 'react';
import { apiAsset } from '@/lib/api';
import type { BgTheme } from '@/lib/bg-themes';

// Đợt 29 — vẽ 1 mẫu nền vector (SVG thuần, sinh theo mã ngẫu nhiên cố định `seed` nên mỗi mẫu luôn giống nhau).
// mode 'panel' = nền tối đậm (khung số liệu, xem thử trong Admin) · 'page' = nền SÁNG nhạt toàn trang (không làm khó đọc chữ).
const W = 800;
const H = 520;

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

interface Ctx {
  t: BgTheme;
  ink: string; // màu nét
  o: number; // hệ số độ đậm nét
  glow: string;
}

function Neural({ t, ink, o, glow }: Ctx) {
  const r = rng(t.seed);
  const nodes = Array.from({ length: 34 }, () => [r() * W, r() * H, 1.6 + r() * 2.6] as const);
  const links: [number, number][] = [];
  nodes.forEach((a, i) =>
    nodes.forEach((b, j) => {
      if (j > i && Math.hypot(a[0] - b[0], a[1] - b[1]) < 150 && links.length < 70) links.push([i, j]);
    }),
  );
  const hot = links.filter((_, i) => i % 7 === 0);
  return (
    <>
      <g stroke={ink} strokeOpacity={0.4 * o} strokeWidth="1.2">
        {links.map(([i, j], k) => (
          <line key={k} x1={nodes[i][0]} y1={nodes[i][1]} x2={nodes[j][0]} y2={nodes[j][1]} />
        ))}
      </g>
      <g stroke={glow} strokeWidth="2.2" strokeLinecap="round" strokeDasharray="8 120" className="dg-flow" fill="none">
        {hot.map(([i, j], k) => (
          <path key={k} d={`M${nodes[i][0]} ${nodes[i][1]} L${nodes[j][0]} ${nodes[j][1]}`} />
        ))}
      </g>
      <g>
        {nodes.map((n, i) => (
          <g key={i}>
            {i % 6 === 0 && <circle cx={n[0]} cy={n[1]} r={n[2] * 4.2} fill={glow} fillOpacity={0.16 * o + 0.04} className="dg-pulse" />}
            <circle cx={n[0]} cy={n[1]} r={n[2]} fill={i % 6 === 0 ? glow : ink} fillOpacity={(i % 6 === 0 ? 0.95 : 0.7) * Math.min(1, o + 0.25)} />
          </g>
        ))}
      </g>
    </>
  );
}

function Circuit({ t, ink, o, glow }: Ctx) {
  const r = rng(t.seed);
  const flip = r() > 0.5;
  const paths = [
    'M0 96 H120 L156 132 H300 L330 102 H470',
    'M800 190 H690 L650 230 H560 L530 200 H430',
    'M0 400 H90 L130 440 H260 L292 408 H380',
    'M800 470 H700 L668 438 H590 L560 468 H470',
    'M250 0 V44 L280 74 V160',
    'M560 520 V470 L590 440',
    'M0 250 H60 L90 280 H180',
  ];
  const cx = 560 + r() * 80;
  const cy = 260 + r() * 60;
  return (
    <g transform={flip ? `translate(${W} 0) scale(-1 1)` : undefined}>
      <g fill="none" stroke={ink} strokeOpacity={0.6 * o} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g fill="none" stroke={glow} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="10 150" className="dg-flow">
        {paths.slice(0, 4).map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g stroke={ink} strokeWidth="1.6" fill={t.b} fillOpacity={0.5 * o + 0.2}>
        {[[156, 132], [330, 102], [470, 96], [650, 230], [530, 200], [130, 440], [292, 408], [668, 438], [560, 468], [280, 74], [90, 280]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="5" className="dg-blink" style={{ animationDelay: `${(i % 6) * 0.45}s` }} />
        ))}
      </g>
      <g transform={`translate(${cx} ${cy})`} stroke={ink} strokeOpacity={0.85 * Math.min(1, o + 0.2)} strokeWidth="1.6" fill="none">
        <rect x="0" y="0" width="86" height="86" rx="12" fill={t.a} fillOpacity={0.45 * o + 0.1} />
        <rect x="24" y="24" width="38" height="38" rx="6" stroke={glow} />
        <path d="M14 -12V0M34 -12V0M54 -12V0M74 -12V0M14 86v12M34 86v12M54 86v12M74 86v12M-12 14H0M-12 34H0M-12 54H0M-12 74H0M86 14h12M86 34h12M86 54h12M86 74h12" />
        <circle cx="43" cy="43" r="4" fill={glow} stroke="none" className="dg-blink" />
      </g>
    </g>
  );
}

function Data({ t, ink, o, glow }: Ctx) {
  const r = rng(t.seed);
  const n = 20;
  const bw = W / n;
  const hs = Array.from({ length: n }, (_, i) => 50 + (i / n) * 130 + r() * 70);
  const pts = hs.map((h, i) => `${i * bw + bw / 2},${H - h - 20}`);
  return (
    <>
      <g stroke={ink} strokeOpacity={0.22 * o} strokeWidth="1">
        {[1, 2, 3, 4, 5].map((i) => (
          <line key={i} x1="0" x2={W} y1={(H / 6) * i} y2={(H / 6) * i} strokeDasharray="4 8" />
        ))}
      </g>
      <g fill={ink}>
        {hs.map((h, i) => (
          <rect key={i} x={i * bw + 6} y={H - h} width={bw - 12} height={h} rx="5" fillOpacity={0.16 * o + 0.03} />
        ))}
      </g>
      <polyline points={pts.join(' ')} fill="none" stroke={glow} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" strokeOpacity={0.95} className="dg-line" />
      <g fill={t.a} stroke={glow} strokeWidth="2.2">
        {pts.map((p, i) => (i % 3 === 0 ? <circle key={i} cx={p.split(',')[0]} cy={p.split(',')[1]} r="5" className="dg-blink" style={{ animationDelay: `${i * 0.1}s` }} /> : null))}
      </g>
      <g transform="translate(650 120)" fill="none" strokeWidth="14">
        <circle r="52" stroke={ink} strokeOpacity={0.18 * o + 0.03} />
        <circle r="52" stroke={glow} strokeDasharray="200 330" transform="rotate(-90)" strokeLinecap="round" />
        <circle r="52" stroke={ink} strokeOpacity={0.7 * o + 0.1} strokeDasharray="60 330" strokeDashoffset="-215" transform="rotate(-90)" strokeLinecap="round" />
      </g>
    </>
  );
}

function Iso({ t, ink, o, glow }: Ctx) {
  const r = rng(t.seed);
  const blocks: JSX.Element[] = [];
  const cw = 46;
  const ch = 26;
  let k = 0;
  for (let gy = 0; gy < 6; gy++) {
    for (let gx = 0; gx < 8; gx++) {
      if (r() < 0.38) continue;
      const bx = 430 + (gx - gy) * cw;
      const by = 250 + (gx + gy) * ch;
      const h = 22 + r() * 92;
      const top = `${bx},${by - h} ${bx + cw},${by - h + ch} ${bx},${by - h + ch * 2} ${bx - cw},${by - h + ch}`;
      const left = `${bx - cw},${by - h + ch} ${bx},${by - h + ch * 2} ${bx},${by + ch * 2} ${bx - cw},${by + ch}`;
      const right = `${bx + cw},${by - h + ch} ${bx},${by - h + ch * 2} ${bx},${by + ch * 2} ${bx + cw},${by + ch}`;
      const hot = k++ % 7 === 0;
      blocks.push(
        <g key={`${gx}-${gy}`} strokeLinejoin="round" stroke={ink} strokeOpacity={0.5 * o + 0.1} strokeWidth="1">
          <polygon points={left} fill={t.c} fillOpacity={0.55 * o + 0.1} />
          <polygon points={right} fill={t.a} fillOpacity={0.55 * o + 0.1} />
          <polygon points={top} fill={hot ? glow : ink} fillOpacity={hot ? 0.85 : 0.35 * o + 0.1} />
        </g>,
      );
    }
  }
  return (
    <>
      <g stroke={ink} strokeOpacity={0.14 * o} strokeWidth="1">
        {Array.from({ length: 14 }, (_, i) => (
          <line key={`a${i}`} x1={i * 70 - 200} y1={H} x2={i * 70 + 300} y2={H - 280} />
        ))}
      </g>
      {blocks}
      <g className="dg-float">
        <polygon points="120,70 150,86 120,102 90,86" fill={glow} fillOpacity="0.85" />
        <polygon points="90,86 120,102 120,138 90,122" fill={t.c} fillOpacity="0.8" />
        <polygon points="150,86 120,102 120,138 150,122" fill={t.a} fillOpacity="0.8" />
      </g>
    </>
  );
}

function Aurora({ t, ink, o, glow }: Ctx) {
  const r = rng(t.seed);
  const wave = (base: number, amp: number, f: number, ph: number) => {
    const pts: string[] = [];
    for (let x = 0; x <= W; x += 20) pts.push(`${x} ${(base + amp * Math.sin(x * f + ph) + amp * 0.4 * Math.sin(x * f * 2.3 + ph * 1.7)).toFixed(1)}`);
    return `M${pts.join(' L')} L${W} ${H} L0 ${H}Z`;
  };
  const dots = Array.from({ length: 46 }, () => [r() * W, r() * H, 0.8 + r() * 2] as const);
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={wave(200 + i * 70, 34 + i * 6, 0.006 + i * 0.002, r() * 6)}
          fill={i % 2 ? glow : ink}
          fillOpacity={(0.1 + i * 0.03) * (o + 0.3)}
          className="dg-float"
          style={{ animationDelay: `${i * 0.8}s` }}
        />
      ))}
      <g fill={glow}>
        {dots.map((d, i) => (
          <circle key={i} cx={d[0]} cy={d[1]} r={d[2]} fillOpacity={0.55 * Math.min(1, o + 0.3)} className="dg-blink" style={{ animationDelay: `${(i % 9) * 0.3}s` }} />
        ))}
      </g>
    </>
  );
}

function Hex({ t, ink, o, glow }: Ctx) {
  const r = rng(t.seed);
  const R = 34;
  const cells: JSX.Element[] = [];
  const hexPts = (cx: number, cy: number, rad: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      return `${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
  const dx = R * Math.sqrt(3);
  for (let row = -1; row < 12; row++) {
    for (let col = -1; col < 12; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0);
      const cy = row * R * 1.5;
      const v = r();
      // dồn đậm dần về góc phải-dưới để chừa vùng thoáng phía trên-trái
      const weight = Math.min(1, (cx / W + cy / H) / 1.3);
      if (v > 0.16 + weight * 0.5) {
        cells.push(<polygon key={`${row}-${col}`} points={hexPts(cx, cy, R - 2)} fill="none" stroke={ink} strokeOpacity={(0.1 + weight * 0.3) * o} strokeWidth="1.2" />);
      } else if (v > 0.06) {
        cells.push(<polygon key={`${row}-${col}`} points={hexPts(cx, cy, R - 4)} fill={ink} fillOpacity={(0.1 + weight * 0.2) * o + 0.03} stroke={ink} strokeOpacity={0.4 * o} />);
      } else {
        cells.push(<polygon key={`${row}-${col}`} points={hexPts(cx, cy, R - 4)} fill={glow} fillOpacity={0.55} className="dg-blink" style={{ animationDelay: `${(row + col + 20) % 7 * 0.4}s` }} />);
      }
    }
  }
  return <>{cells}</>;
}

function Topo({ t, ink, o, glow }: Ctx) {
  const r = rng(t.seed);
  const centers = [
    { x: 250 + r() * 100, y: 240 + r() * 80, n: 11, s: 34 },
    { x: 620 + r() * 60, y: 140 + r() * 60, n: 8, s: 30 },
  ];
  const ring = (cx: number, cy: number, rad: number, ph: number) => {
    const pts: string[] = [];
    for (let a = 0; a <= 360; a += 8) {
      const rr = rad * (1 + 0.14 * Math.sin((a * Math.PI) / 180 * 3 + ph) + 0.07 * Math.sin((a * Math.PI) / 180 * 5 + ph * 2.1));
      pts.push(`${(cx + rr * Math.cos((a * Math.PI) / 180) * 1.35).toFixed(1)} ${(cy + rr * Math.sin((a * Math.PI) / 180)).toFixed(1)}`);
    }
    return `M${pts.join(' L')}Z`;
  };
  return (
    <>
      {centers.map((c, ci) => {
        const ph = r() * 6;
        return (
          <g key={ci} fill="none">
            {Array.from({ length: c.n }, (_, i) => (
              <path key={i} d={ring(c.x, c.y, 18 + i * c.s, ph + i * 0.18)} stroke={i % 5 === 4 ? glow : ink} strokeOpacity={i % 5 === 4 ? 0.85 : (0.55 - i * 0.03) * o} strokeWidth={i % 5 === 4 ? 2 : 1.3} />
            ))}
            <circle cx={c.x} cy={c.y} r="6" fill={glow} stroke="none" className="dg-pulse" />
          </g>
        );
      })}
    </>
  );
}

function Tri({ t, ink, o, glow }: Ctx) {
  const r = rng(t.seed);
  const cols = 11;
  const rows = 7;
  const cw = W / (cols - 1);
  const rh = H / (rows - 1);
  const P2 = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => [x * cw + (x > 0 && x < cols - 1 ? (r() - 0.5) * cw * 0.7 : 0), y * rh + (y > 0 && y < rows - 1 ? (r() - 0.5) * rh * 0.7 : 0)] as const),
  );
  const tris: JSX.Element[] = [];
  for (let y = 0; y < rows - 1; y++)
    for (let x = 0; x < cols - 1; x++) {
      const a = P2[y][x], b = P2[y][x + 1], c = P2[y + 1][x], d = P2[y + 1][x + 1];
      [[a, b, c], [b, d, c]].forEach((tri, k) => {
        const v = r();
        const fill = v > 0.93 ? glow : v > 0.55 ? t.c : ink;
        tris.push(
          <polygon
            key={`${x}-${y}-${k}`}
            points={tri.map((q) => q.join(',')).join(' ')}
            fill={fill}
            fillOpacity={v > 0.93 ? 0.7 : (0.05 + v * 0.28) * o + 0.02}
            stroke={ink}
            strokeOpacity={0.22 * o}
            strokeWidth="1"
            className={v > 0.93 ? 'dg-blink' : undefined}
          />,
        );
      });
    }
  return <>{tris}</>;
}

function Wave({ t, ink, o, glow }: Ctx) {
  const r = rng(t.seed);
  const lines = Array.from({ length: 12 }, (_, i) => {
    const base = 90 + i * 32;
    const amp = 22 + r() * 30;
    const f = 0.005 + r() * 0.004;
    const ph = r() * 6;
    const pts: string[] = [];
    for (let x = -10; x <= W + 10; x += 16) pts.push(`${x} ${(base + amp * Math.sin(x * f + ph) + amp * 0.5 * Math.sin(x * f * 2.1 + ph * 1.3)).toFixed(1)}`);
    return `M${pts.join(' L')}`;
  });
  return (
    <>
      <g fill="none" strokeLinecap="round">
        {lines.map((d, i) => (
          <path key={i} d={d} stroke={i % 4 === 2 ? glow : ink} strokeOpacity={i % 4 === 2 ? 0.75 : (0.2 + (i % 3) * 0.1) * o + 0.04} strokeWidth={i % 4 === 2 ? 2.4 : 1.4} />
        ))}
      </g>
      <g fill="none" stroke={glow} strokeWidth="3" strokeLinecap="round" strokeDasharray="14 190" className="dg-flow">
        {lines.filter((_, i) => i % 3 === 0).map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </>
  );
}

function Bubble({ t, ink, o, glow }: Ctx) {
  const r = rng(t.seed);
  const items = Array.from({ length: 26 }, () => ({ x: r() * W, y: r() * H, rad: 8 + r() * r() * 70, v: r() }));
  return (
    <>
      {items.map((b, i) => (
        <g key={i} className={b.v > 0.8 ? 'dg-float' : undefined} style={{ animationDelay: `${(i % 6) * 0.7}s` }}>
          <circle cx={b.x} cy={b.y} r={b.rad} fill={b.v > 0.88 ? glow : b.v > 0.45 ? ink : 'none'} fillOpacity={b.v > 0.88 ? 0.4 : 0.1 * o + 0.03} stroke={ink} strokeOpacity={0.45 * o + 0.05} strokeWidth="1.3" />
          {b.rad > 28 && <circle cx={b.x} cy={b.y} r={b.rad * 0.55} fill="none" stroke={ink} strokeOpacity={0.3 * o} strokeDasharray="3 6" />}
          {b.rad > 14 && <circle cx={b.x - b.rad * 0.3} cy={b.y - b.rad * 0.3} r={b.rad * 0.12} fill="#fff" fillOpacity={0.5} />}
        </g>
      ))}
    </>
  );
}

function Grid({ t, ink, o, glow }: Ctx) {
  const r = rng(t.seed);
  const hz = 290;
  const vx = 400;
  const stars = Array.from({ length: 40 }, () => [r() * W, r() * (hz - 30), 0.6 + r() * 1.5] as const);
  const vertical = Array.from({ length: 21 }, (_, i) => (i - 10) * 90);
  const horiz = Array.from({ length: 9 }, (_, i) => hz + Math.pow(i + 1, 2.05) * 3.4);
  return (
    <>
      <g fill={glow}>
        {stars.map((s, i) => (
          <circle key={i} cx={s[0]} cy={s[1]} r={s[2]} fillOpacity={0.6} className="dg-blink" style={{ animationDelay: `${(i % 8) * 0.35}s` }} />
        ))}
      </g>
      <circle cx={vx} cy={hz - 8} r="92" fill={glow} fillOpacity={0.28} className="dg-pulse" />
      <circle cx={vx} cy={hz - 8} r="62" fill={glow} fillOpacity={0.5} />
      <rect x="0" y={hz} width={W} height={H - hz} fill={t.a} fillOpacity={0.5 * o + 0.15} />
      <g stroke={ink} strokeOpacity={0.5 * o + 0.06} strokeWidth="1.3">
        <line x1="0" y1={hz} x2={W} y2={hz} strokeOpacity={0.9} stroke={glow} />
        {vertical.map((dx, i) => (
          <line key={i} x1={vx + dx * 0.12} y1={hz} x2={vx + dx * 3.2} y2={H} />
        ))}
        {horiz.map((y, i) => (
          <line key={i} x1="0" y1={y} x2={W} y2={y} />
        ))}
      </g>
    </>
  );
}

const SCENES = { neural: Neural, circuit: Circuit, data: Data, iso: Iso, aurora: Aurora, hex: Hex, topo: Topo, tri: Tri, wave: Wave, bubble: Bubble, grid: Grid } as const;

export function ArtScene({ theme, mode = 'panel', className = '' }: { theme: BgTheme; mode?: 'panel' | 'page'; className?: string }) {
  const id = `art${useId().replace(/:/g, '')}`;
  const page = mode === 'page';
  // Nền là ảnh Admin tải lên: ảnh phủ kín (cắt giữa, không méo) + lớp phủ: sáng nhạt cho toàn trang (chữ dễ đọc), tối cho khung số liệu.
  if (theme.image) {
    const ov = Math.min(90, Math.max(0, theme.image.overlay)) / 100;
    return (
      <div aria-hidden="true" className={`absolute inset-0 w-full h-full pointer-events-none overflow-hidden ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={apiAsset(theme.image.url)} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" />
        <div className="absolute inset-0" style={{ background: page ? `rgba(246,248,252,${ov})` : 'linear-gradient(135deg, rgba(8,22,56,.62), rgba(8,22,56,.78))' }} />
      </div>
    );
  }
  const Scene = SCENES[theme.group];
  const ctx: Ctx = {
    t: theme,
    ink: page ? theme.b : theme.line,
    o: page ? 0.32 : 1,
    glow: page ? theme.c : theme.glow,
  };
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          {page ? (
            <>
              <stop offset="0" stopColor={theme.tint} />
              <stop offset="0.6" stopColor="#F6F8FC" />
              <stop offset="1" stopColor={theme.tint} />
            </>
          ) : (
            <>
              <stop offset="0" stopColor={theme.a} />
              <stop offset="0.55" stopColor={theme.b} />
              <stop offset="1" stopColor={theme.c} />
            </>
          )}
        </linearGradient>
        <radialGradient id={`${id}o`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={theme.glow} stopOpacity={page ? 0.22 : 0.5} />
          <stop offset="1" stopColor={theme.glow} stopOpacity="0" />
        </radialGradient>
        <pattern id={`${id}d`} width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.2" fill={page ? theme.b : theme.line} fillOpacity={page ? 0.1 : 0.24} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}g)`} />
      <rect width={W} height={H} fill={`url(#${id}d)`} />
      <circle cx="700" cy="50" r="200" fill={`url(#${id}o)`} className="dg-pulse" />
      <circle cx="70" cy="480" r="180" fill={`url(#${id}o)`} className="dg-pulse dg-delay" />
      <Scene {...ctx} />
    </svg>
  );
}
