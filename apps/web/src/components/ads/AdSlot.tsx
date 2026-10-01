'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  audienceOf,
  closeAd,
  adKey,
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
import { useDataSaver } from '@/lib/data-saver';

// Đợt 24 (29/09/2026) — 1 "vùng" đặt banner. Không có banner phù hợp → không render gì (không để lại khoảng trống).
// `className` chỉ áp khi có banner (VD khoảng cách mt-8, hidden lg:block cho vùng chỉ có trên máy tính).
export function AdSlot({ slot, className = '' }: { slot: string; className?: string }) {
  const { me } = useAuth();
  const def = AD_SLOT_MAP[slot];
  const [ad, setAd] = useState<PublicAd | null>(null);
  const [none, setNone] = useState(false); // đã hỏi xong và KHÔNG có banner nào phù hợp
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);
  const saver = useDataSaver();

  useEffect(() => {
    if (me === undefined || !def || saver) return; // chờ biết là khách hay đã đăng nhập
    let alive = true;
    const choose = (feed: Awaited<ReturnType<typeof loadAdFeed>>) => {
      if (!alive) return;
      const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
      if ((def.devices === 'desktop' && !isDesktop) || (def.devices === 'mobile' && isDesktop)) {
        setNone(true);
        return setAd(null);
      }
      const picked = pickAd(eligibleAds(feed, slot, audienceOf(me?.role), isDesktop), slot);
      if (picked) registerSlot(slot, picked);
      setNone(!picked);
      setAd(picked);
    };
    const hit = peekAdFeed();
    if (hit !== undefined) choose(hit);
    else loadAdFeed().then(choose);
    return () => {
      alive = false;
      unregisterSlot(slot);
    };
  }, [me, slot, def, saver]);

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

  // Đợt 91 — nhớ chiều cao banner (gồm lề) của lần xem trước; lần sau script ở <head> giữ sẵn chỗ này (xem layout.tsx + globals.css)
  // nên banner về sau KHÔNG đẩy nội dung bên dưới xuống. Slot không có banner → xoá nhớ để không chừa khoảng trống.
  const adId = ad?.id;
  useEffect(() => {
    if (me === undefined || !def) return;
    const key = `${slot}:${window.matchMedia('(min-width: 1024px)').matches ? 'd' : 'm'}`;
    try {
      const map = JSON.parse(localStorage.getItem('tvl_ad_h') || '{}') as Record<string, number>;
      const el = ref.current;
      if (adId && el && el.offsetParent !== null) {
        const cs = getComputedStyle(el);
        const h = Math.round(el.offsetHeight + parseFloat(cs.marginTop || '0') + parseFloat(cs.marginBottom || '0'));
        if (h > 0 && h < 500 && map[key] !== h) {
          map[key] = h;
          localStorage.setItem('tvl_ad_h', JSON.stringify(map));
        }
      } else if (!adId && none && key in map) {
        delete map[key];
        localStorage.setItem('tvl_ad_h', JSON.stringify(map));
      }
    } catch {
      /* bỏ qua */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adId, none, slot, me, def]);

  // Chưa/không có banner → thẻ giữ chỗ RỖNG, mặc định display:none (không tạo khoảng cách); chỉ hiện (có min-height) khi lần trước slot này có banner.
  if (!ad || !def || saver) return none || saver || !def ? null : <div data-ad-reserve={slot} aria-hidden="true" />;
  return (
    <div ref={ref} className={className} data-ad-slot={slot} data-ad-key={adKey(ad)} data-ad-gov={def.variant === 'wide' || slot === 'footer-top' ? 'wide' : def.variant === 'mini' ? 'tall' : def.variant}>
      <AdBanner
        ad={ad}
        variant={def.variant}
        slot={slot}
        onOpen={() => audienceOf(me?.role) !== 'admin' && trackAd(ad.id, slot, 'c')}
        onClose={() => {
          closeAd(ad.id);
          unregisterSlot(slot);
          setNone(true);
          setAd(null);
        }}
      />
    </div>
  );
}
