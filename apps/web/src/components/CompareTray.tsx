'use client';

import Link from '@/components/SmartLink';
import { usePathname } from 'next/navigation';
import { useCompare } from '@/lib/compare';

// Đợt 46 — thanh nổi đáy màn hình khi đã chọn tin để so sánh.
export default function CompareTray() {
  const { items, remove, clear } = useCompare();
  const path = usePathname();
  if (items.length === 0 || path?.startsWith('/viec-lam/so-sanh') || path?.startsWith('/admin')) return null;
  return (
    <div
      className="tvl-above-bnav fixed z-40 left-1/2 -translate-x-1/2 w-[min(760px,calc(100%-24px))] rounded-xl bg-ink text-white shadow-lg px-3 py-2 flex items-center gap-2 flex-wrap text-[13.5px]"
      style={{ bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
    >
      <span className="font-bold">So sánh ({items.length}/3):</span>
      {items.map((i) => (
        <span key={i.id} className="rounded-md bg-white/15 pl-2 pr-1 py-0.5 max-w-[190px] flex items-center gap-1">
          <span className="truncate">{i.title}</span>
          <button onClick={() => remove(i.id)} aria-label={`Bỏ ${i.title}`} className="px-1 hover:text-accent">×</button>
        </span>
      ))}
      <span className="ml-auto flex gap-2">
        <button onClick={clear} className="underline text-white/80">Xoá</button>
        {items.length >= 2 ? (
          <Link href={`/viec-lam/so-sanh?ids=${items.map((i) => i.id).join(',')}`} className="rounded-lg bg-accent px-3 py-1 font-bold">
            So sánh ngay →
          </Link>
        ) : (
          <span className="text-white/70">Chọn thêm 1 tin</span>
        )}
      </span>
    </div>
  );
}
