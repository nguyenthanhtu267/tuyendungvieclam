import CompareTray from '@/components/CompareTray';
import ServerWaking from '@/components/ServerWaking';
import type { Metadata } from 'next';
import './fonts.css';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { LanguageProvider } from '@/lib/i18n';
import { AdGovernor } from '@/components/ads/AdGovernor';
import { BackgroundProvider } from '@/components/bg/BackgroundProvider';
import Footer from '@/components/Footer';
import ImpersonationBanner from '@/components/ImpersonationBanner';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import ConsentBanner from '@/components/ConsentBanner';

// Font Inter (to, rõ, sắc nét — quyết định 18/09/2026) + IBM Plex Mono cho số liệu dạng bảng,
// nạp qua @fontsource (đóng gói sẵn file font) vì fonts.googleapis.com bị chặn bởi chính sách
// mạng egress của môi trường build này.
export const metadata: Metadata = {
  title: 'Tuyển Dụng Việc Làm',
  description: 'Cổng việc làm đa công ty — tuyendungvieclam',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* Đợt 29 — áp lại cỡ chữ người dùng đã chọn (FontScale) ngay khi mở trang, tránh nhấp nháy. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var p=Number(localStorage.getItem('tvl_font_pct'));if(!(p>=80&&p<=200)){var l=Number(localStorage.getItem('tvl_font_level'));p=l>0&&l<=8?100+l*5:100}if(p!==100)document.documentElement.style.fontSize=p+'%'}catch(e){}" }} />
      </head>
      <body className="font-sans antialiased bg-bg text-ink flex flex-col min-h-screen">
        <AuthProvider>
          <LanguageProvider>
            <BackgroundProvider>
              <AdGovernor />
            <ImpersonationBanner />
            <AnalyticsTracker />
            <ConsentBanner />
            <div className="flex-1 flex flex-col">{children}</div>
            <CompareTray />
            <ServerWaking />
            <Footer />
            </BackgroundProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
