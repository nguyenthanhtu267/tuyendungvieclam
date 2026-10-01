'use client';

import Link from '@/components/SmartLink';
import { useEffect } from 'react';

// Đợt 90 — một khối bị lỗi không còn làm trắng cả trang: hiện thông báo thân thiện + nút "Thử lại".
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[tvl] lỗi trang:', error);
  }, [error]);
  return (
    <main className="max-w-xl mx-auto px-4 py-16 text-center flex flex-col items-center gap-3">
      <div className="text-4xl" aria-hidden="true">⚠️</div>
      <h1 className="text-xl font-extrabold text-ink">Trang gặp sự cố tạm thời</h1>
      <p className="text-[14px] text-ink-muted">
        Có thể do mạng chập chờn hoặc máy chủ đang khởi động. Bạn bấm “Thử lại” — dữ liệu đã nhập trên các trang khác không bị mất.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={reset} className="rounded-lg bg-primary text-white font-bold px-4 py-2 text-[14px]">
          Thử lại
        </button>
        <Link href="/" className="rounded-lg border border-border-strong font-bold px-4 py-2 text-[14px] bg-white">
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
