'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/SmartLink';
import { candidatesApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { whenPageReady } from '@/lib/page-ready';

// Đợt 101 — thanh nhắc 1 dòng ở trang chủ: ứng viên đã đăng nhập mà hồ sơ trực tuyến chưa đủ → "Hồ sơ X% — hoàn thiện để được gợi ý đúng hơn".
// Ẩn được (nhớ 7 ngày); kết quả % được nhớ trong phiên để không gọi API lặp lại.
const HIDE_KEY = 'tvl_nudge_hide';
export default function ProfileNudge() {
  const { me, token } = useAuth();
  const [pct, setPct] = useState<number | null>(null);
  useEffect(() => {
    if (!token || me?.role !== 'candidate') return;
    try {
      const h = Number(localStorage.getItem(HIDE_KEY) || 0);
      if (Date.now() - h < 7 * 86400000) return;
      const c = sessionStorage.getItem('tvl_profile_pct');
      if (c != null) return setPct(Number(c));
    } catch {
      /* bỏ qua */
    }
    let alive = true;
    const cancel = whenPageReady(() => {
      candidatesApi
        .getProfile(token)
        .then((p) => {
          try { sessionStorage.setItem('tvl_profile_pct', String(p.completionPercent)); } catch { /* bỏ qua */ }
          if (alive) setPct(p.completionPercent);
        })
        .catch(() => undefined);
    });
    return () => {
      alive = false;
      cancel();
    };
  }, [token, me?.role]);
  if (pct == null || pct >= 100) return null;
  return (
    <div className="mt-2 rounded-xl border border-border bg-white px-3.5 py-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-bold text-ink">Hồ sơ của bạn mới {pct}%</div>
        <div className="mt-1 h-1.5 rounded-full bg-surface-alt overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.max(4, pct)}%` }} /></div>
        <div className="text-[12px] text-ink-muted mt-1">Hoàn thiện để được gợi ý việc đúng hơn và nộp đơn nhanh hơn.</div>
      </div>
      <Link href="/ho-so/truc-tuyen" className="shrink-0 h-10 px-3 rounded-lg bg-primary text-white text-[13px] font-bold inline-flex items-center">Bổ sung</Link>
      <button
        type="button"
        aria-label="Ẩn nhắc nhở"
        onClick={() => { try { localStorage.setItem(HIDE_KEY, String(Date.now())); } catch { /* bỏ qua */ } setPct(null); }}
        className="shrink-0 w-9 h-9 text-ink-faint text-lg"
      >
        ✕
      </button>
    </div>
  );
}
