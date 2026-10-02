'use client';

import Link from '@/components/SmartLink';
import { usePathname } from 'next/navigation';
import { EMPLOYER_CANDIDATE_GROUPS } from '@/components/EmployerHeader';

// Đợt 138 — thanh chuyển nhanh giữa các màn "Ứng viên" và "Tìm hồ sơ" của nhà tuyển dụng.
// Menu trên cùng chỉ còn 2 mục (mỗi mục có danh sách con); thanh này hiện ở đầu 4 màn tương ứng để
// người dùng luôn thấy mình đang ở đâu và sang màn cùng nhóm chỉ 1 chạm (kể cả trên điện thoại).
export default function EmployerSectionTabs() {
  const pathname = usePathname() || '';
  const group = EMPLOYER_CANDIDATE_GROUPS.find((g) => g.items.some((i) => pathname.startsWith(i.href)));
  if (!group) return null;
  return (
    <div className="max-w-6xl mx-3 sm:mx-auto mt-3 flex flex-wrap items-center gap-2" aria-label={group.label}>
      <span className="text-[12px] font-bold text-ink-faint uppercase tracking-wide">{group.label}</span>
      <div role="tablist" className="grid grid-cols-2 sm:flex gap-1.5 min-w-0">
        {group.items.map((i) => {
          const on = pathname.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              role="tab"
              aria-selected={on}
              className={`rounded-lg border px-3 py-1.5 text-[13px] font-bold text-center ${on ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white text-ink'}`}
            >
              {i.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
