'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getConsent, setAnalyticsConsent, type ConsentLevel } from '@/lib/analytics';

// Đợt 55 — thông báo thống kê/cookie GỌN, KHÔNG chặn: thẻ nhỏ góc trái dưới, hiện sau vài giây, không che nội dung chính,
// không bắt buộc phải bấm mới dùng được web. Chưa chọn → web vẫn chạy ở chế độ ẩn danh (không ghi gì vào máy người dùng).
// Mở lại từ chân trang ("Cài đặt cookie") để đổi lựa chọn bất kỳ lúc nào.
export const OPEN_CONSENT_EVENT = 'tvl-open-consent';

export default function ConsentBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (getConsent()) return;
    const t = setTimeout(() => setOpen(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, h);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, h);
  }, []);

  if (!open || pathname?.startsWith('/admin')) return null;

  function choose(level: ConsentLevel) {
    setAnalyticsConsent(level);
    setOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Thông báo về cookie và thống kê"
      className="fixed z-40 left-3 right-3 bottom-3 sm:right-auto sm:left-4 sm:bottom-4 sm:w-[340px] rounded-xl border border-border bg-white shadow-lg p-3.5 text-[13px] text-ink"
    >
      <p className="leading-snug text-ink-muted">
        Web dùng cookie cần thiết để chạy và <b className="text-ink">thống kê truy cập ẩn danh</b> để cải thiện trải nghiệm.
        Không dùng quảng cáo bên thứ ba.{' '}
        <Link href="/chinh-sach-bao-mat#cookie" className="text-primary font-semibold hover:underline">
          Chi tiết
        </Link>
      </p>
      <div className="flex gap-2 mt-2.5">
        <button
          type="button"
          onClick={() => choose('all')}
          className="flex-1 h-9 rounded-lg font-bold text-[13px] bg-primary text-white"
        >
          Đồng ý
        </button>
        <button
          type="button"
          onClick={() => choose('essential')}
          className="flex-1 h-9 rounded-lg border border-border-strong font-bold text-[13px] hover:border-primary"
        >
          Chỉ cần thiết
        </button>
      </div>
    </div>
  );
}
