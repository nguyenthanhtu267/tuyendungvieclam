'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getImpersonation } from '@/lib/impersonation';
import { tracker } from '@/lib/analytics';

// Đợt 19 (26/09/2026) — gắn bộ ghi truy cập thật vào mọi trang (xem lib/analytics.ts). Không hiển thị gì.
export default function AnalyticsTracker() {
  const pathname = usePathname();
  const { me, token } = useAuth();

  useEffect(() => {
    tracker.init();
  }, []);

  useEffect(() => {
    tracker.setIdentity(me === undefined ? undefined : me ? { role: me.role } : null, token, !!getImpersonation());
  }, [me, token]);

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    tracker.pageview(pathname);
  }, [pathname]);

  return null;
}
