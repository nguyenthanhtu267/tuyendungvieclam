'use client';

import { useState } from 'react';
import { companyInitials } from '@/lib/format';

// Đợt 12ab (24/09/2026) — logo công ty qua link ảnh (URL, quyết định đã chốt: chưa nối Cloudflare R2
// cho loại ảnh này). Dùng chung cho JobCard, trang chi tiết tin, trang công ty, trang chủ (Doanh
// nghiệp yêu thích) — luôn có fallback về chữ cái đầu (companyInitials) nếu chưa có logo hoặc ảnh lỗi
// link (404, hết hạn, không phải ảnh...) để không bao giờ vỡ giao diện vì 1 link ảnh xấu.
export function CompanyLogo({
  name,
  logoUrl,
  size = 44,
  className = '',
  variant = 'tint',
  hideIfEmpty = false,
  reserveSpace = false,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
  // 'tint' — nền primary-tint nhạt (dùng trên nền trắng, mặc định). 'light' — nền trắng mờ trên chữ
  // trắng (dùng trên banner màu primary, VD viec-lam/[id] và cong-ty/[id]).
  variant?: 'tint' | 'light';
  // Đợt 56 — công ty chưa có logo thật (hoặc ảnh lỗi) → không vẽ ô chữ viết tắt, ẩn hẳn ô logo.
  hideIfEmpty?: boolean;
  // Đợt 60 — chưa có logo thì vẫn chừa 1 khoảng trống đúng kích thước (không vẽ chữ viết tắt) để các thẻ thẳng hàng.
  reserveSpace?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!logoUrl && !failed;
  if (reserveSpace && !showImage) return <div className="shrink-0" style={{ width: size, height: size }} aria-hidden="true" />;
  if (hideIfEmpty && !showImage) return null;
  const bgClass = variant === 'light' ? 'bg-white/15 text-white' : 'bg-white text-primary border border-border shadow-sm';

  return (
    <div
      className={`shrink-0 rounded-xl ${bgClass} flex items-center justify-center font-bold overflow-hidden ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.32) }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- link ảnh tự do do NTD dán, không nằm
        // trong domain nội bộ nên next/image (yêu cầu whitelist domain) không phù hợp ở đây.
        <img
          src={logoUrl}
          alt={name}
          className="w-full h-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      ) : (
        companyInitials(name)
      )}
    </div>
  );
}
