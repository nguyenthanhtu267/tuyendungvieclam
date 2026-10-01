import ServerWaking from '@/components/ServerWaking';
import type { Metadata, Viewport } from 'next';
import './fonts.css';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { LanguageProvider } from '@/lib/i18n';
import { AdGovernor } from '@/components/ads/AdGovernor';
import { BackgroundProvider } from '@/components/bg/BackgroundProvider';
import Footer from '@/components/Footer';
import ImpersonationBanner from '@/components/ImpersonationBanner';
import PerfGuard from '@/components/PerfGuard';
import DeferredWidgets from '@/components/DeferredWidgets';

// Font Inter (to, rõ, sắc nét — quyết định 18/09/2026) + IBM Plex Mono cho số liệu dạng bảng,
// nạp qua @fontsource (đóng gói sẵn file font) vì fonts.googleapis.com bị chặn bởi chính sách
// mạng egress của môi trường build này.
export const metadata: Metadata = {
  title: 'Tuyển Dụng Việc Làm',
  description: 'Cổng việc làm đa công ty — tuyendungvieclam',
  // Đợt 91 — PWA: biểu tượng khi thêm vào màn hình chính (iPhone dùng apple-touch-icon; Android lấy từ manifest).
  applicationName: 'Tuyển Dụng Việc Làm',
  icons: {
    icon: [{ url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Việc Làm', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

// Đợt 91 — màu thanh trình duyệt điện thoại khớp màu thương hiệu; viewport-fit=cover để dùng vùng an toàn (tai thỏ) cho thanh dưới.
export const viewport: Viewport = {
  themeColor: '#163B7A',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* Đợt 93 — bắt tay TLS tới API sớm + tải sẵn gói /public/boot (nền, banner, nhãn logo) ngay khi trình duyệt đọc <head>,
            không chờ JS chạy → bỏ 1 vòng chờ đầu tiên (đáng kể trên 4G + máy chủ ở xa). Khớp lib/boot.ts (cùng chế độ credentials mặc định — khác chế độ thì trình duyệt tải lại lần 2). */}
        <link rel="preconnect" href={API_ORIGIN} crossOrigin="anonymous" />
        <link rel="preload" as="fetch" crossOrigin="anonymous" href={process.env.NEXT_PUBLIC_EDGE_CACHE === '1' ? '/_c/public/boot' : `${API_ORIGIN}/public/boot`} />
        {/* Đợt 91 — tải sớm 2 file font Inter (file nằm ở public/fonts, cache 1 năm — xem next.config.mjs) → chữ về đúng font sớm hơn ~300–800ms trên mạng chậm. */}
        <link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href="/fonts/inter-latin-wght-normal.woff2" />
        <link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href="/fonts/inter-vietnamese-wght-normal.woff2" />
        {/* Đợt 29 — áp lại cỡ chữ người dùng đã chọn (FontScale) ngay khi mở trang, tránh nhấp nháy. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var p=Number(localStorage.getItem('tvl_font_pct'));if(!(p>=80&&p<=200)){var l=Number(localStorage.getItem('tvl_font_level'));p=l>0&&l<=8?100+l*5:100}if(p!==100)document.documentElement.style.fontSize=p+'%'}catch(e){}try{var h=JSON.parse(localStorage.getItem('tvl_ad_h')||'{}'),dv=innerWidth>=1024?'d':'m',c='';for(var k in h){var q=k.split(':');if(q[1]===dv&&/^[a-z0-9-]+$/.test(q[0])&&h[k]>0&&h[k]<500)c+='[data-ad-reserve=\"'+q[0]+'\"]{display:block;min-height:'+Math.round(h[k])+'px}'}if(c){var st=document.createElement('style');st.textContent=c;document.head.appendChild(st)}}catch(e){}" }} />
      </head>
      <body className="font-sans antialiased bg-bg text-ink flex flex-col min-h-screen">
        <AuthProvider>
          <LanguageProvider>
            <BackgroundProvider>
              <AdGovernor />
            <ImpersonationBanner />
            <div className="flex-1 flex flex-col">{children}</div>
            <ServerWaking />
            <Footer />
            <PerfGuard />
            <DeferredWidgets />
            </BackgroundProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
