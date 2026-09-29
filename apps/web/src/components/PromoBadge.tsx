'use client';

import { useEffect, useState } from 'react';
import { publicSettingsApi } from '@/lib/api';

// Đợt 23 (29/09/2026) — nhãn quảng bá nhấp nháy đặt ở góc trên chữ "MIỄN PHÍ" của logo (VD "Phần mềm
// Nhân sự Toàn diện"). Chữ + link do Admin cấu hình (tab "📣 Nhãn logo"); bấm mở TAB MỚI. Không hiện
// gì nếu Admin chưa bật / chưa nhập link / lỗi mạng. Lấy 1 lần cho cả phiên (cache trong module) để
// chuyển trang không gọi lại API.
type Badge = { text: string; url: string } | null;
let cached: Badge | undefined;
let inflight: Promise<Badge> | null = null;

function loadBadge(): Promise<Badge> {
  if (cached !== undefined) return Promise.resolve(cached);
  if (!inflight) {
    inflight = publicSettingsApi
      .getPromoBadge()
      .then((r) => (cached = r.badge))
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function PromoBadge() {
  const [badge, setBadge] = useState<Badge>(cached ?? null);
  useEffect(() => {
    let alive = true;
    loadBadge().then((b) => alive && setBadge(b));
    return () => {
      alive = false;
    };
  }, []);
  if (!badge) return null;
  return (
    <a
      href={badge.url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="promo-badge"
      title={badge.text}
      className="promo-badge absolute left-9 -top-[15px] whitespace-nowrap rounded-full px-2 py-[1px] text-[9.5px] leading-[14px] font-extrabold text-white shadow-sm ring-1 ring-white"
    >
      {badge.text}
    </a>
  );
}
