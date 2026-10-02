'use client';

import Link from '@/components/SmartLink';
import { useEffect, useState } from 'react';
import { workersApi } from '@/lib/api';
import { guessGroups } from '@/lib/labor';

// Đợt 134 — ở trang việc làm văn phòng: người dùng gõ từ của việc lao động phổ thông (may, bốc xếp, công nhân…)
// thì gợi ý sang khu việc làm công nhân, kèm số tin đang tuyển.
const LABOR_WORDS = /(cong nhan|lao dong pho thong|boc xep|boc vac|phu kho|phu ho|dung may|lap rap|may mac|tho may|bao ve|tap vu|giup viec|phu bep|shipper|giao hang|xe nang|dong goi)/;
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export function LaborCrossHint({ q }: { q?: string }) {
  const [hit, setHit] = useState<{ n: number; href: string } | null>(null);
  useEffect(() => {
    setHit(null);
    const text = (q ?? '').trim();
    if (text.length < 2) return;
    const groups = guessGroups(text, 'worker');
    if (!groups.length && !LABOR_WORDS.test(fold(text))) return;
    const t = setTimeout(() => {
      const params = groups.length ? { kind: 'worker', group: groups[0], hideFilled: '1', pageSize: '1' } : { kind: 'worker', q: text, hideFilled: '1', pageSize: '1' };
      workersApi
        .browse(params)
        .then((r) => {
          if (r.total > 0) setHit({ n: r.total, href: `/lao-dong-pho-thong/viec-lam?loai=cong-nhan${groups.length ? `&nhom=${encodeURIComponent(groups[0])}` : `&q=${encodeURIComponent(text)}`}` });
        })
        .catch(() => undefined);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  if (!hit) return null;
  return (
    <Link href={hit.href} className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-warning bg-warning-tint px-3 py-2 text-[13.5px] text-ink hover:brightness-95">
      <span>🧰 Có <b>{hit.n}</b> việc làm công nhân phù hợp “{q}”</span>
      <span className="font-extrabold text-primary">Xem ngay →</span>
    </Link>
  );
}
