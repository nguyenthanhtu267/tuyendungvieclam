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
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
  // 'tint' — nền primary-tint nhạt (dùng trên nền trắng, mặc định). 'light' — nền trắng mờ trên chữ
  // trắng (dùng trên banner màu primary, VD viec-lam/[id] và cong-ty/[id]).
  variant?: 'tint' | 'light';
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!logoUrl && !failed;
  const bgClass = variant === 'light' ? 'bg-white/15 text-white' : 'bg-primary-tint text-primary';

  return (
    <div
      className={`shrink-0 rounded-lg ${bgClass} flex items-center justify-center font-bold overflow-hidden ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.32) }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- link ảnh tự do do NTD dán, không nằm
        // trong domain nội bộ nên next/image (yêu cầu whitelist domain) không phù hợp ở đây.
        <img
          src={logoUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        companyInitials(name)
      )}
    </div>
  );
}
