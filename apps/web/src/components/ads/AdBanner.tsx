'use client';

import type { CSSProperties, MouseEvent } from 'react';
import { buildLook, type LookInput } from '@/lib/ad-theme';
import { ADS_API_BASE, adHref, isExternal } from '@/lib/ads';
import type { AdVariant } from '@/lib/ad-slots';

// Đợt 24 (29/09/2026) — 1 banner quảng cáo (dùng chung cho trang thật và phần xem trước trong Admin). Bố cục tự
// co dãn theo BỀ RỘNG KHUNG CHỨA (CSS container query, xem globals.css ".pm-*"): khung hẹp → xếp dọc, khung rộng →
// chữ trái / nút phải; cỡ chữ co dãn theo khung. Có nhãn "Quảng cáo" (minh bạch với người xem) + nút × ẩn.
export interface AdContent extends LookInput {
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  ctaText?: string | null;
  url: string;
  addUtm: boolean;
  slug?: string;
}

export function AdBanner({
  ad,
  variant,
  slot,
  onOpen,
  onClose,
  preview,
}: {
  ad: AdContent;
  variant: AdVariant;
  slot: string;
  onOpen?: () => void;
  onClose?: () => void;
  preview?: boolean;
}) {
  const look = buildLook(ad, ADS_API_BASE);
  const external = isExternal(ad.url);
  const href = adHref({ url: ad.url, addUtm: ad.addUtm, slug: ad.slug ?? '' }, slot);
  const style = {
    background: look.background,
    color: look.ink,
    '--ad-muted': look.inkMuted,
    '--ad-cta-bg': look.ctaBg,
    '--ad-cta-fg': look.ctaFg,
    '--ad-eyebrow-bg': look.eyebrowBg,
    '--ad-eyebrow-fg': look.eyebrowFg,
    '--ad-tag-bg': look.tagBg,
  } as CSSProperties;

  function click(e: MouseEvent) {
    if (preview) {
      e.preventDefault();
      return;
    }
    onOpen?.();
  }

  return (
    <div className={`pm-wrap pm-${variant}`} data-testid="promo-banner" data-slot={slot} data-promo-id={(ad as { id?: string }).id}>
      <a
        className="pm"
        href={href}
        style={style}
        onClick={click}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer sponsored' } : {})}
      >
        <span className="pm-text">
          {ad.eyebrow && <span className="pm-eyebrow">{ad.eyebrow}</span>}
          <span className="pm-title">{ad.title || 'Tiêu đề banner'}</span>
          {ad.subtitle && <span className="pm-sub">{ad.subtitle}</span>}
        </span>
        <span className="pm-cta">
          {ad.ctaText || 'Xem ngay'}
          <span aria-hidden="true" className="pm-arrow">
            {external ? '↗' : '→'}
          </span>
        </span>
      </a>
      <span className="pm-corner" style={{ '--ad-tag-bg': look.tagBg, color: look.ink } as CSSProperties}>
        <span className="pm-tag">Quảng cáo</span>
        {onClose && (
          <button type="button" className="pm-close" aria-label="Ẩn quảng cáo này" onClick={onClose}>
            ×
          </button>
        )}
      </span>
    </div>
  );
}
