import type { Config } from 'tailwindcss';

// Design tokens lấy từ mockup UI/UX đã duyệt (artifact tvl-mockup) — giữ nhất quán
// màu sắc/typography giữa mockup và code thật.

// Đợt 26 (30/09/2026) — "hiển thị rõ ràng nhất, thu hẹp khoảng hở tối đa": thang khoảng cách (padding/margin/gap/space)
// thu còn 75% so với mặc định Tailwind (KHÔNG đụng chiều rộng/cao nên icon, ảnh giữ nguyên), chữ to hơn, màu chữ gần đen.
const STEPS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96];
const compact: Record<string, string> = { px: '1px' };
for (const n of STEPS) compact[String(n)] = n === 0 ? '0px' : `${+(n * 0.25 * 0.75).toFixed(4)}rem`;
const compactMargin = { auto: 'auto', ...compact };
const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    padding: compact,
    gap: compact,
    space: compact,
    margin: compactMargin,
    fontSize: {
      xs: ['0.85rem', { lineHeight: '1.4' }],
      sm: ['0.95rem', { lineHeight: '1.5' }],
      base: ['1.05rem', { lineHeight: '1.55' }],
      lg: ['1.2rem', { lineHeight: '1.4' }],
      xl: ['1.35rem', { lineHeight: '1.35' }],
      '2xl': ['1.6rem', { lineHeight: '1.25' }],
      '3xl': ['1.95rem', { lineHeight: '1.2' }],
      '4xl': ['2.4rem', { lineHeight: '1.1' }],
      '5xl': ['3rem', { lineHeight: '1.05' }],
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: '#163B7A',
          dark: '#0F2957',
          tint: '#E8EDF7',
        },
        accent: {
          DEFAULT: '#FF5A36',
          dark: '#E44A28',
          tint: '#FFE8E1',
        },
        success: { DEFAULT: '#1FA97D', tint: '#E3F6EF' },
        info: { DEFAULT: '#2F6FED', tint: '#E8EFFE' },
        warning: { DEFAULT: '#F0A93E', tint: '#FDF1DD' },
        critical: { DEFAULT: '#E5484D', tint: '#FBE6E7' },
        ink: {
          DEFAULT: '#0A0E14',
          muted: '#1F2733',
          faint: '#3D4654',
        },
        surface: { DEFAULT: '#FFFFFF', alt: '#F7F9FC' },
        bg: '#EEF1F6',
        border: { DEFAULT: '#E1E6ED', strong: '#C9D1DE' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SF Mono', 'Consolas', 'monospace'],
      },
      borderRadius: {
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
};
export default config;
