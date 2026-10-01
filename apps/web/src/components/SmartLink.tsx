'use client';

import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { forwardRef, type ComponentProps } from 'react';
import { readSaver } from '@/lib/data-saver';

// Đợt 91 — liên kết "tải trước thông minh". Link mặc định của Next tự tải trước MỌI liên kết đang hiện trên màn hình
// (đo thực tế: ~12 yêu cầu / 64 KB chỉ để mở trang danh sách) → tốn data & CPU điện thoại mà phần lớn không bao giờ bấm.
// Nay: không tải trước hàng loạt; chỉ tải trang đích khi người dùng RÊ CHUỘT vào (máy tính) hoặc VỪA CHẠM (điện thoại, ~100ms
// trước khi bấm xong) — vẫn nhanh gần như nhau nhưng tiết kiệm đáng kể. Có thể đặt prefetch tường minh để ghi đè.
const done = new Set<string>();

type Props = ComponentProps<typeof NextLink>;

const SmartLink = forwardRef<HTMLAnchorElement, Props>(function SmartLink(
  { prefetch, onMouseEnter, onTouchStart, href, ...rest },
  ref,
) {
  const router = useRouter();
  const url = typeof href === 'string' ? href : (href.pathname ?? '') + (href.search ?? '');

  function warm() {
    if (!url || !url.startsWith('/') || done.has(url) || readSaver()) return;
    done.add(url);
    try {
      router.prefetch(url);
    } catch {
      /* bỏ qua */
    }
  }

  return (
    <NextLink
      ref={ref}
      href={href}
      prefetch={prefetch ?? false}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        warm();
      }}
      onTouchStart={(e) => {
        onTouchStart?.(e);
        warm();
      }}
      {...rest}
    />
  );
});

export default SmartLink;
