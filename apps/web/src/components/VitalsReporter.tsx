'use client';

import { useEffect } from 'react';

// Đợt 93 — đo tốc độ THẬT của người xem (không có dữ liệu cá nhân, không mã định danh): LCP, CLS, INP (xấp xỉ), FCP, TTFB.
// Chỉ gửi 1 gói nhỏ khi rời/ẩn trang (sendBeacon) cho lượt tải đầu tiên của mỗi lần mở web. Admin xem ở GET /admin/analytics/vitals.
// Dùng `buffered: true` nên dù component này nạp trễ (DeferredWidgets) vẫn nhận đủ số đo từ đầu.
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function VitalsReporter() {
  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      if (sessionStorage.getItem('tvl_vit_sent')) return; // mỗi phiên chỉ báo 1 lần (đỡ tốn pin/dữ liệu)
    } catch {
      /* bỏ qua */
    }
    const path = location.pathname;
    const v: { lcp?: number; cls?: number; inp?: number; fcp?: number; ttfb?: number } = {};
    let cls = 0;
    const obs: PerformanceObserver[] = [];
    const watch = (type: string, cb: (list: PerformanceObserverEntryList) => void, extra: Record<string, unknown> = {}) => {
      try {
        const o = new PerformanceObserver(cb);
        o.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
        obs.push(o);
      } catch {
        /* trình duyệt không hỗ trợ loại này */
      }
    };
    watch('largest-contentful-paint', (l) => {
      const e = l.getEntries();
      v.lcp = e[e.length - 1]?.startTime;
    });
    watch('layout-shift', (l) => {
      for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!e.hadRecentInput) cls += e.value;
      }
      v.cls = cls;
    });
    watch('paint', (l) => {
      for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') v.fcp = e.startTime;
    });
    watch(
      'event',
      (l) => {
        for (const e of l.getEntries() as (PerformanceEntry & { interactionId?: number })[]) {
          if (e.interactionId) v.inp = Math.max(v.inp ?? 0, e.duration);
        }
      },
      { durationThreshold: 40 },
    );
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav) v.ttfb = nav.responseStart;

    let sent = false;
    const send = () => {
      if (sent || document.visibilityState !== 'hidden') return;
      if (v.lcp === undefined && v.fcp === undefined) return;
      sent = true;
      try {
        sessionStorage.setItem('tvl_vit_sent', '1');
      } catch {
        /* bỏ qua */
      }
      const c = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;
      const body = JSON.stringify({ p: path, d: innerWidth >= 1024 ? 'd' : 'm', n: c?.effectiveType, ...v });
      try {
        navigator.sendBeacon?.(`${API}/analytics/vitals`, new Blob([body], { type: 'text/plain' }));
      } catch {
        /* bỏ qua */
      }
    };
    document.addEventListener('visibilitychange', send);
    addEventListener('pagehide', send);
    return () => {
      document.removeEventListener('visibilitychange', send);
      removeEventListener('pagehide', send);
      obs.forEach((o) => o.disconnect());
    };
  }, []);
  return null;
}
