import type { ReactNode } from 'react';

// Đợt 28 — cột phải xếp chồng nhiều vùng banner, DÍNH theo khi cuộn trang (sticky) để không còn khoảng trống dài
// dưới các khối thông tin. Chỉ máy tính (điện thoại không có cột phải — đã có vùng banner giữa bài/cuối trang).
// Không vùng nào có banner → không có phần tử con → `empty:hidden` ẩn hẳn, không chiếm chỗ.
export function AdStack({ children }: { children: ReactNode }) {
  return <div data-ad-stack="" className="hidden lg:flex flex-col gap-3 lg:sticky lg:top-20 empty:hidden">{children}</div>;
}
