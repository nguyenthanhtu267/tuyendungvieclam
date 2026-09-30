// Đợt 27 (30/09/2026) — nền vector chủ đề "chuyển đổi số": mạng nút kết nối, mạch điện, dòng dữ liệu, khối isometric,
// chip vi xử lý, đám mây. 100% SVG nội tuyến (nhẹ, sắc nét mọi màn hình, không ảnh). Chuyển động nhẹ bằng CSS
// (xem .dg-* trong globals.css) và tự tắt khi người dùng bật "giảm chuyển động". `tone` đổi bảng màu.
export type DigitalTone = 'blue' | 'emerald' | 'night';

const TONES: Record<DigitalTone, { a: string; b: string; c: string; line: string; glow: string }> = {
  blue: { a: '#0C2453', b: '#163B7A', c: '#1F5FBF', line: '#7FB2FF', glow: '#5CE1E6' },
  emerald: { a: '#06342E', b: '#0B5B4D', c: '#12896F', line: '#7CE3C4', glow: '#B6F36B' },
  night: { a: '#0B1020', b: '#1A1147', c: '#3A1F8F', line: '#9C8CFF', glow: '#FF5AC8' },
};

import { useId } from 'react';

export function DigitalBg({ tone = 'blue', className = '' }: { tone?: DigitalTone; className?: string }) {
  const T = TONES[tone];
  const id = `dg${useId().replace(/:/g, '')}`;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      viewBox="0 0 800 520"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={T.a} />
          <stop offset="0.55" stopColor={T.b} />
          <stop offset="1" stopColor={T.c} />
        </linearGradient>
        <radialGradient id={`${id}o`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={T.glow} stopOpacity="0.55" />
          <stop offset="1" stopColor={T.glow} stopOpacity="0" />
        </radialGradient>
        <pattern id={`${id}d`} width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.3" fill={T.line} fillOpacity="0.28" />
        </pattern>
      </defs>
      <rect width="800" height="520" fill={`url(#${id}g)`} />
      <rect width="800" height="520" fill={`url(#${id}d)`} />
      {/* quầng sáng */}
      <circle cx="690" cy="60" r="190" fill={`url(#${id}o)`} className="dg-pulse" />
      <circle cx="80" cy="470" r="170" fill={`url(#${id}o)`} className="dg-pulse dg-delay" />

      {/* đường mạch điện + nút */}
      <g fill="none" stroke={T.line} strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M0 96 H120 L156 132 H300 L330 102 H470" />
        <path d="M800 190 H690 L650 230 H560 L530 200 H430" />
        <path d="M0 400 H90 L130 440 H260 L292 408 H380" />
        <path d="M800 470 H700 L668 438 H590 L560 468 H470" />
        <path d="M250 0 V44 L280 74 V160" />
        <path d="M560 520 V470 L590 440" />
      </g>
      {/* dòng dữ liệu chạy trên mạch */}
      <g fill="none" stroke={T.glow} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="10 150" className="dg-flow">
        <path d="M0 96 H120 L156 132 H300 L330 102 H470" />
        <path d="M800 190 H690 L650 230 H560 L530 200 H430" />
        <path d="M0 400 H90 L130 440 H260 L292 408 H380" />
        <path d="M800 470 H700 L668 438 H590 L560 468 H470" />
      </g>
      <g fill={T.b} stroke={T.line} strokeWidth="1.6">
        {[[156, 132], [330, 102], [470, 96], [650, 230], [530, 200], [430, 190], [130, 440], [292, 408], [380, 400], [668, 438], [560, 468], [280, 74]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="5" className="dg-blink" style={{ animationDelay: `${(i % 6) * 0.45}s` }} />
        ))}
      </g>

      {/* chip vi xử lý */}
      <g transform="translate(620 300)" stroke={T.line} strokeOpacity="0.8" strokeWidth="1.6" fill="none">
        <rect x="0" y="0" width="86" height="86" rx="12" fill={T.a} fillOpacity="0.55" />
        <rect x="24" y="24" width="38" height="38" rx="6" stroke={T.glow} />
        <path d="M14 -12V0M34 -12V0M54 -12V0M74 -12V0M14 86v12M34 86v12M54 86v12M74 86v12M-12 14H0M-12 34H0M-12 54H0M-12 74H0M86 14h12M86 34h12M86 54h12M86 74h12" />
        <circle cx="43" cy="43" r="4" fill={T.glow} stroke="none" className="dg-blink" />
      </g>

      {/* khối isometric */}
      <g transform="translate(70 170)" strokeLinejoin="round">
        <path d="M0 24 L34 6 L68 24 L34 42Z" fill={T.line} fillOpacity="0.55" />
        <path d="M0 24 L34 42 V80 L0 62Z" fill={T.c} fillOpacity="0.9" />
        <path d="M68 24 L34 42 V80 L68 62Z" fill={T.a} fillOpacity="0.9" />
        <path d="M0 24 L34 6 L68 24 L34 42Z M34 42 V80" fill="none" stroke={T.line} strokeOpacity="0.8" />
      </g>
      <g transform="translate(150 250) scale(0.7)" strokeLinejoin="round">
        <g className="dg-float">
          <path d="M0 24 L34 6 L68 24 L34 42Z" fill={T.glow} fillOpacity="0.7" />
          <path d="M0 24 L34 42 V80 L0 62Z" fill={T.c} />
          <path d="M68 24 L34 42 V80 L68 62Z" fill={T.a} />
        </g>
      </g>

      {/* đám mây dữ liệu */}
      <g transform="translate(300 300)" fill="none" stroke={T.line} strokeOpacity="0.85" strokeWidth="1.8" strokeLinecap="round">
        <g className="dg-float dg-delay">
          <path d="M20 58 a20 20 0 0 1 4-39 a26 26 0 0 1 50 6 a17 17 0 0 1-2 33Z" fill={T.a} fillOpacity="0.45" />
          <path d="M46 48 V30 M38 38 l8-8 8 8" stroke={T.glow} />
        </g>
      </g>

      {/* hồ sơ / biểu đồ thu nhỏ */}
      <g transform="translate(470 330)" fill="none" stroke={T.line} strokeOpacity="0.8" strokeWidth="1.6" strokeLinecap="round">
        <rect x="0" y="0" width="70" height="88" rx="9" fill={T.a} fillOpacity="0.5" />
        <circle cx="35" cy="26" r="11" />
        <path d="M14 66 a21 17 0 0 1 42 0" />
        <path d="M16 80 H54" strokeOpacity="0.5" />
      </g>
      <g transform="translate(60 40)" fill="none" stroke={T.glow} strokeOpacity="0.85" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M0 50 L22 30 L40 40 L70 8" />
        <path d="M56 8 H70 V22" />
      </g>
    </svg>
  );
}
