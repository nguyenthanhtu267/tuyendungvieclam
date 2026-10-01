'use client';

import { useEffect, useState } from 'react';
import { jobsApi, type JobListParams, type ProvinceInsights as Data } from '@/lib/api';

// Đợt 89 — khi đã chọn ĐÚNG 1 tỉnh: gợi ý chi tiết của riêng tỉnh đó (khu công nghiệp, ngành nổi bật, lương trung vị).
// Bấm một gợi ý = lọc luôn. Chỉ hiển thị khi có dữ liệu; không chiếm chỗ khi tỉnh chưa có tin.
export function ProvinceInsights({
  province,
  filters,
  onPickQuery,
  onPickIndustry,
}: {
  province: string;
  filters: JobListParams;
  onPickQuery: (q: string) => void;
  onPickIndustry: (industry: string) => void;
}) {
  const [d, setD] = useState<Data | null>(null);
  const key = JSON.stringify({ ...filters, provinces: undefined, district: undefined });
  useEffect(() => {
    let off = false;
    jobsApi.provinceInsights(province, filters).then((r) => !off && setD(r)).catch(() => !off && setD(null));
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [province, key]);
  if (!d || (d.total === 0 && d.zones.length === 0)) return null;
  const zones = d.zones.filter((z) => z.count > 0);
  return (
    <div className="mt-2.5 rounded-lg border border-border bg-white/90 px-3 py-2 text-[12.5px] flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <span className="font-extrabold text-primary">Tại {d.province}:</span>
      <span>
        <b>{d.total}</b> việc
        {d.medianSalary ? (
          <>
            {' '}· lương trung vị <b>{d.medianSalary} triệu</b>
          </>
        ) : null}
      </span>
      {zones.length > 0 && (
        <span className="flex flex-wrap items-center gap-1">
          <span className="text-ink-muted">Khu công nghiệp:</span>
          {zones.map((z) => (
            <button key={z.name} type="button" onClick={() => onPickQuery(z.q)} className="rounded-full border border-border-strong px-2 py-0.5 text-[11.5px] font-semibold hover:border-primary">
              {z.name} ({z.count})
            </button>
          ))}
        </span>
      )}
      {d.industries.length > 0 && (
        <span className="flex flex-wrap items-center gap-1">
          <span className="text-ink-muted">Ngành nổi bật:</span>
          {d.industries.slice(0, 4).map((i) => (
            <button key={i.industry} type="button" onClick={() => onPickIndustry(i.industry)} className="rounded-full border border-border-strong px-2 py-0.5 text-[11.5px] font-semibold hover:border-primary">
              {i.industry} ({i.count})
            </button>
          ))}
        </span>
      )}
    </div>
  );
}
