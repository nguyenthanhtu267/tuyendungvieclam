import type { Config } from 'tailwindcss';

// Design tokens lấy từ mockup UI/UX đã duyệt (artifact tvl-mockup) — giữ nhất quán
// màu sắc/typography giữa mockup và code thật.
const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
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
          DEFAULT: '#1F2733',
          muted: '#626C7A',
          faint: '#8B93A1',
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
