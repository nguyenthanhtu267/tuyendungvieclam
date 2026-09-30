import { useId } from 'react';
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

const SCENES = { neural: Neural, circuit: Circuit, data: Data, iso: Iso, aurora: Aurora } as const;

export function ArtScene({ theme, mode = 'panel', className = '' }: { theme: BgTheme; mode?: 'panel' | 'page'; className?: string }) {
  const id = `art${useId().replace(/:/g, '')}`;
  const page = mode === 'page';
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
