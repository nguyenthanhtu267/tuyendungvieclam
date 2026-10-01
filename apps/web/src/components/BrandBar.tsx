'use client';

import Link from '@/components/SmartLink';
import { usePathname } from 'next/navigation';

// Đợt 97 — thanh logo nhỏ cho các trang KHÔNG có đầu trang chung (đăng nhập, đăng ký NTD, hồ sơ chia sẻ…): luôn có đường về
// trang chủ, nhất là trên điện thoại (trước đây logo chỉ có ở cột trái bị ẩn dưới 768px). Cao 52px, vùng chạm lớn.
export function BrandBar({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  const pathname = usePathname();
  return (
    <div className={`flex items-center justify-between gap-3 px-4 h-[52px] ${className}`}>
      <Link href="/" aria-label="Về trang chủ" className="flex items-center gap-2 min-h-[44px] pr-2">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${dark ? 'bg-white/15' : 'bg-primary'}`}>
          <span className="text-white font-extrabold text-sm leading-none select-none">V</span>
        </span>
        <span className={`font-extrabold text-[14px] whitespace-nowrap tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>
          ĐĂNG TUYỂN <span className="text-accent">MIỄN PHÍ</span>
        </span>
      </Link>
      {pathname !== '/' && (
        <Link href="/" className={`text-[13px] font-bold px-3 h-9 inline-flex items-center rounded-full border ${dark ? 'border-white/40 text-white' : 'border-primary text-primary'}`}>
          ← Trang chủ
        </Link>
      )}
    </div>
  );
}
