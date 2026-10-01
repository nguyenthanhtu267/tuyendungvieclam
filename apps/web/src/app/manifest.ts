import type { MetadataRoute } from 'next';

// Đợt 91 — PWA: cài web thành "ứng dụng" trên màn hình chính điện thoại (Android Chrome: "Cài đặt ứng dụng"; iPhone: Chia sẻ → Thêm vào MH chính).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tuyển Dụng Việc Làm',
    short_name: 'Việc Làm',
    description: 'Cổng việc làm đa công ty — tìm việc nhanh, ứng tuyển miễn phí.',
    lang: 'vi',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#EEF1F6',
    theme_color: '#163B7A',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Tìm việc làm', short_name: 'Tìm việc', url: '/viec-lam', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Việc làm đã lưu', short_name: 'Đã lưu', url: '/ho-so#saved', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Lao động phổ thông', short_name: 'Lao động', url: '/lao-dong-pho-thong', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
