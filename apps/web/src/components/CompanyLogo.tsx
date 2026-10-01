'use client';

import { useState } from 'react';
import { logoProxyUrl } from '@/lib/api';


// Đợt 12ab (24/09/2026) — logo công ty qua link ảnh (URL, quyết định đã chốt: chưa nối Cloudflare R2
// cho loại ảnh này). Dùng chung cho JobCard, trang chi tiết tin, trang công ty, trang chủ (Doanh
// nghiệp yêu thích) — luôn có fallback về chữ cái đầu (companyInitials) nếu chưa có logo hoặc ảnh lỗi
// link (404, hết hạn, không phải ảnh...) để không bao giờ vỡ giao diện vì 1 link ảnh xấu.

// Đợt 67 — công ty chưa có logo (hoặc ảnh lỗi) thì hiện 1 icon "ngẫu nhiên nhưng cố định" theo tên công ty
// (cùng công ty luôn ra cùng icon + màu). Nếu tên gợi ngành (vận tải, thực phẩm, công nghệ…) thì chọn icon hợp ngành.
const ICONS: Record<string, string[]> = {
  building: ['M6 21V4a1 1 0 011-1h10a1 1 0 011 1v17', 'M3 21h18', 'M10 7h1M13 7h1M10 11h1M13 11h1M10 15h1M13 15h1'],
  briefcase: ['M4 8h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z', 'M9 8V6a1 1 0 011-1h4a1 1 0 011 1v2', 'M3 13h18'],
  factory: ['M3 21V10l6 4v-4l6 4V6h3a1 1 0 011 1v14z', 'M8 18h1M12 18h1M16 18h1'],
  store: ['M4 9l1.5-5h13L20 9', 'M4 9a2.5 2.5 0 005 0 2.5 2.5 0 006 0 2.5 2.5 0 005 0', 'M5 12v8h14v-8', 'M10 20v-5h4v5'],
  truck: ['M2 6h11v10H2z', 'M13 10h4l3 3v3h-7', 'M7 19a1.6 1.6 0 100-3.2A1.6 1.6 0 007 19zM17 19a1.6 1.6 0 100-3.2A1.6 1.6 0 0017 19z'],
  chip: ['M7 7h10v10H7z', 'M10 10h4v4h-4z', 'M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4'],
  leaf: ['M5 19C5 10 11 5 20 4c0 9-5 15-13 15', 'M5 19l8-8'],
  cog: ['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1'],
  book: ['M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z', 'M5 17a3 3 0 013-3h11'],
  heart: ['M12 20s-8-5-8-11a4.5 4.5 0 018-2.5A4.5 4.5 0 0120 9c0 6-8 11-8 11z'],
  cart: ['M3 4h2l2.4 10h10l2-7H6.2', 'M9 19a1 1 0 100-2 1 1 0 000 2zM17 19a1 1 0 100-2 1 1 0 000 2z'],
  fork: ['M7 3v7a2 2 0 002 2v9', 'M5 3v5M9 3v5', 'M17 3c-2 2-2 6 0 8v10'],
  coin: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M14.5 9.5c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 1.9s1 1.6 2.5 1.8 2.5.7 2.5 1.8-1.1 1.9-2.5 1.9c-1 0-2-.4-2.6-1.2M12 6.5v1.8M12 15.7v1.8'],
  rocket: ['M14 4c3-1 6-1 6-1s0 3-1 6l-6 6-5-5z', 'M9 14l-4 1 1-4M10 15l-1 4 4-1', 'M15 9a1 1 0 100-2 1 1 0 000 2z'],
  home: ['M3 11l9-7 9 7', 'M5 10v10h14V10', 'M10 20v-6h4v6'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M9 12l2 2 4-4'],
};
const KEYWORDS: [RegExp, string][] = [
  [/vận tải|logistic|giao hàng|xuất nhập khẩu|vận chuyển|express/i, 'truck'],
  [/thực phẩm|nhà hàng|ẩm thực|f&b|bếp|cafe|cà phê|đồ uống|golf|resort|khách sạn/i, 'fork'],
  [/công nghệ|phần mềm|tech|software|it\b|số|digital|điện tử|viễn thông/i, 'chip'],
  [/sản xuất|in và|bao bì|cơ khí|công nghiệp|nhà máy|xây lắp|chế biến/i, 'factory'],
  [/thương mại|bán lẻ|siêu thị|cửa hàng|mart|shop/i, 'store'],
  [/tài chính|ngân hàng|bảo hiểm|chứng khoán|đầu tư|kế toán|kiểm toán/i, 'coin'],
  [/giáo dục|đào tạo|trường|học|edu/i, 'book'],
  [/y tế|dược|bệnh viện|phòng khám|sức khoẻ|sức khỏe|spa/i, 'heart'],
  [/nông|lâm|thủy sản|thuỷ sản|xanh|môi trường|organic/i, 'leaf'],
  [/bất động sản|địa ốc|nhà|xây dựng|kiến trúc|land/i, 'home'],
  [/bảo vệ|an ninh|an toàn/i, 'shield'],
];
const TONES: [string, string][] = [
  ['#E8EFFE', '#1F4E9C'],
  ['#E3F6EF', '#0B6B4B'],
  ['#FDF1DD', '#8A5200'],
  ['#FBE6E7', '#A32A30'],
  ['#EDE7FB', '#5B3CA8'],
  ['#E0F4F8', '#0E6378'],
  ['#FCE8F1', '#9B2A63'],
  ['#EEF1F5', '#3B4A63'],
];
function hashName(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pickIcon(name: string): { paths: string[]; tone: [string, string] } {
  const h = hashName(name.trim().toLowerCase());
  const kw = KEYWORDS.find(([re]) => re.test(name))?.[1];
  const keys = Object.keys(ICONS);
  const key = kw ?? keys[h % keys.length];
  return { paths: ICONS[key], tone: TONES[(h >>> 8) % TONES.length] };
}
export function CompanyDefaultIcon({ name, size }: { name: string; size: number }) {
  const { paths, tone } = pickIcon(name);
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: tone[0], color: tone[1] }}
      role="img"
      aria-label={`Biểu tượng mặc định của ${name}`}
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
    </div>
  );
}

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
  // Đợt 91 — thử bản đã thu nhỏ trước ('proxy'); lỗi → link gốc ('raw'); lỗi nữa → icon mặc định.
  const [stage, setStage] = useState<'proxy' | 'raw' | 'failed'>('proxy');
  const proxied = logoUrl ? logoProxyUrl(logoUrl, size) : null;
  const showImage = !!logoUrl && stage !== 'failed';
  const imgSrc = logoUrl && proxied && stage === 'proxy' ? proxied : logoUrl;
  // Đợt 67 — không còn ẩn/chừa trống: chưa có logo thì hiện icon mặc định theo tên công ty.
  void hideIfEmpty;
  void reserveSpace;
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
          src={imgSrc ?? undefined}
          alt={name}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain p-1"
          onError={() => setStage((s) => (s === 'proxy' && proxied ? 'raw' : 'failed'))}
        />
      ) : (
        <CompanyDefaultIcon name={name} size={size} />
      )}
    </div>
  );
}
