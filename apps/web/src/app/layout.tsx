import type { Metadata } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { LanguageProvider } from '@/lib/i18n';
import { BackgroundProvider } from '@/components/bg/BackgroundProvider';
import Footer from '@/components/Footer';
import ImpersonationBanner from '@/components/ImpersonationBanner';
import AnalyticsTracker from '@/components/AnalyticsTracker';

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
        <script dangerouslySetInnerHTML={{ __html: "try{var l=Number(localStorage.getItem('tvl_font_level'));if(l>0&&l<=8)document.documentElement.style.fontSize=(100+l*5)+'%'}catch(e){}" }} />
      </head>
      <body className="font-sans antialiased bg-bg text-ink flex flex-col min-h-screen">
        <AuthProvider>
          <LanguageProvider>
            <BackgroundProvider>
            <ImpersonationBanner />
            <AnalyticsTracker />
            <div className="flex-1 flex flex-col">{children}</div>
            <Footer />
            </BackgroundProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
