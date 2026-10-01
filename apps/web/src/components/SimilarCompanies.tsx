'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/SmartLink';
import { companiesApi, type SimilarCompany } from '@/lib/api';
import { CompanyLogo } from '@/components/CompanyLogo';
import { FitText } from '@/components/FitText';

// Đợt 52 — "Công ty cùng lĩnh vực" (cột phải trang công ty): so sánh tiếp mà không phải quay lại trang tìm việc.
export function SimilarCompanies({ companyId }: { companyId: string }) {
  const [list, setList] = useState<SimilarCompany[]>([]);
  useEffect(() => {
    let alive = true;
    companiesApi.similar(companyId).then((r) => alive && setList(r)).catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [companyId]);
  if (list.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="font-extrabold text-[14px] mb-3">Công ty cùng lĩnh vực</div>
      <ul className="flex flex-col gap-3">
        {list.map((c) => (
          <li key={c.id}>
            <Link href={`/cong-ty/${c.id}`} className="flex items-center gap-3 group">
              <CompanyLogo name={c.name} logoUrl={c.logoUrl} size={48} className="text-xs" hideIfEmpty />
              <span className="min-w-0">
                <FitText lines={2} min={0.7} className="co-name text-[13px] leading-snug group-hover:underline">{c.name}</FitText>
                <span className="text-[12.5px] text-ink-muted">{c.jobCount} việc đang tuyển</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
