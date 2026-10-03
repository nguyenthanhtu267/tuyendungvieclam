'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState } from 'react';

// Đợt 91 — các tiện ích KHÔNG cần ngay lúc mở trang (thống kê truy cập, thông báo cookie, khay so sánh, thanh điều hướng dưới,
// đăng ký chạy offline) nạp SAU: khi trình duyệt rảnh (≤1,2 giây) hoặc ngay khi người dùng bắt đầu thao tác. Nhờ vậy phần JS cần
// để HIỆN nội dung đầu tiên nhỏ hơn, điện thoại yếu không phải phân tích/chạy chúng cùng lúc với việc vẽ trang.
const AnalyticsTracker = dynamic(() => import('@/components/AnalyticsTracker'), { ssr: false });
const ConsentBanner = dynamic(() => import('@/components/ConsentBanner'), { ssr: false });
const CompareTray = dynamic(() => import('@/components/CompareTray'), { ssr: false });
const BottomNav = dynamic(() => import('@/components/BottomNav'), { ssr: false });
const ScrollTopButton = dynamic(() => import('@/components/ScrollTopButton'), { ssr: false });
const InstallHint = dynamic(() => import('@/components/InstallHint'), { ssr: false });
const PwaRegister = dynamic(() => import('@/components/PwaRegister'), { ssr: false });
const ApplyQueueFlusher = dynamic(() => import('@/components/ApplyQueueFlusher'), { ssr: false });
const TopProgress = dynamic(() => import('@/components/TopProgress'), { ssr: false });
const KeyboardShortcuts = dynamic(() => import('@/components/KeyboardShortcuts'), { ssr: false });
const TapTargets = dynamic(() => import('@/components/TapTargets'), { ssr: false });
const VitalsReporter = dynamic(() => import('@/components/VitalsReporter'), { ssr: false });

export default function DeferredWidgets() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      setReady(true);
    };
    const evs = ['pointerdown', 'scroll', 'keydown', 'touchstart'] as const;
    evs.forEach((e) => window.addEventListener(e, go, { passive: true, once: true }));
    const w = window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
    const t = w.requestIdleCallback ? w.requestIdleCallback(go, { timeout: 1200 }) : window.setTimeout(go, 1000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, go));
      if (!w.requestIdleCallback) clearTimeout(t);
    };
  }, []);
  if (!ready) return null;
  // QUAN TRỌNG: bọc Suspense riêng — next/dynamic không có ranh giới Suspense nếu thiếu `loading`, khi nạp chunk nó sẽ "treo"
  // ranh giới ở TRÊN CÙNG (loading.tsx của cả trang) → cả trang bị thay bằng khung xương rồi vẽ lại (đo được: CLS +0.12 ở trang chủ).
  return (
    <Suspense fallback={null}>
      <AnalyticsTracker />
      <VitalsReporter />
      <ConsentBanner />
      <CompareTray />
      <BottomNav />
      <ScrollTopButton />
      <InstallHint />
      <PwaRegister />
      <ApplyQueueFlusher />
      <TopProgress />
      <TapTargets />
      <KeyboardShortcuts />
    </Suspense>
  );
}
