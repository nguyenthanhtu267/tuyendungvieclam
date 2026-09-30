'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  audienceOf,
  closeAd,
  eligibleAds,
  loadAdFeed,
  peekAdFeed,
  pickAd,
  registerSlot,
  trackAd,
  unregisterSlot,
  type PublicAd,
} from '@/lib/ads';
import { AD_SLOT_MAP } from '@/lib/ad-slots';
import { AdBanner } from './AdBanner';

// Đợt 24 (29/09/2026) — 1 "vùng" đặt banner. Không có banner phù hợp → không render gì (không để lại khoảng trống).
// `className` chỉ áp khi có banner (VD khoảng cách mt-8, hidden lg:block cho vùng chỉ có trên máy tính).
export function AdSlot({ slot, className = '' }: { slot: string; className?: string }) {
  const { me } = useAuth();
  const def = AD_SLOT_MAP[slot];
  const [ad, setAd] = useState<PublicAd | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);

  useEffect(() => {
    if (me === undefined || !def) return; // chờ biết là khách hay đã đăng nhập
    let alive = true;
    const choose = (feed: Awaited<ReturnType<typeof loadAdFeed>>) => {
      if (!alive) return;
      const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
      if ((def.devices === 'desktop' && !isDesktop) || (def.devices === 'mobile' && isDesktop)) return setAd(null);
      const picked = pickAd(eligibleAds(feed, slot, audienceOf(me?.role), isDesktop), slot);
      if (picked) registerSlot(slot, picked.id);
      setAd(picked);
    };
    const hit = peekAdFeed();
    if (hit !== undefined) choose(hit);
    else loadAdFeed().then(choose);
    return () => {
      alive = false;
      unregisterSlot(slot);
    };
  }, [me, slot, def]);

  // Lượt hiển thị: tính 1 lần khi ≥ 50% banner lọt vào màn hình (Admin/Điều phối viên xem không tính).
  useEffect(() => {
    seen.current = false;
    const el = ref.current;
    if (!ad || !el || audienceOf(me?.role) === 'admin') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !seen.current) {
          seen.current = true;
          trackAd(ad.id, slot, 'v');
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ad, slot, me]);

  if (!ad || !def) return null;
  return (
    <div ref={ref} className={className} data-ad-slot={slot} data-ad-gov={def.variant === 'wide' || slot === 'footer-top' ? 'wide' : def.variant}>
      <AdBanner
        ad={ad}
        variant={def.variant}
        slot={slot}
        onOpen={() => audienceOf(me?.role) !== 'admin' && trackAd(ad.id, slot, 'c')}
        onClose={() => {
          closeAd(ad.id);
          unregisterSlot(slot);
          setAd(null);
        }}
      />
    </div>
  );
}
