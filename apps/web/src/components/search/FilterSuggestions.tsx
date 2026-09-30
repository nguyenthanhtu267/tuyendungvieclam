'use client';

import { useEffect, useState } from 'react';
import { jobsApi, type JobFacets, type JobListParams } from '@/lib/api';
import { formatNumber } from '@/lib/format';

// Đợt 59 — Gợi ý bộ lọc thông minh: quá nhiều kết quả → gợi ý thu hẹp (tỉnh/ngành nhiều tin nhất); quá ít → gợi ý bỏ
// bớt từng bộ lọc kèm số việc sẽ có thêm (đếm thật bằng API, không đoán).
const LABELS: Record<string, string> = {
  salaryTier: 'mức lương',
  level: 'cấp bậc',
  postedWithin: 'thời gian đăng',
  employmentType: 'hình thức làm việc',
  experienceLevel: 'kinh nghiệm',
  urgentOnly: 'chỉ việc khẩn cấp',
  featuredEmployerOnly: 'doanh nghiệp yêu thích',
  district: 'quận/huyện',
  provinces: 'địa điểm',
  industries: 'ngành nghề',
};
const RELAX_ORDER = ['district', 'salaryTier', 'experienceLevel', 'level', 'employmentType', 'postedWithin', 'urgentOnly', 'featuredEmployerOnly', 'provinces', 'industries'];

interface Sug {
  key: string;
  text: string;
  patch: Partial<JobListParams>;
}

function isSet(v: unknown) {
  return !(v === undefined || v === '' || v === false || (Array.isArray(v) && v.length === 0));
}

export function FilterSuggestions({
  filters,
  total,
  facets,
  loading,
  onApply,
}: {
  filters: JobListParams;
  total: number;
  facets: JobFacets | null;
  loading: boolean;
  onApply: (patch: Partial<JobListParams>) => void;
}) {
  const [sugs, setSugs] = useState<Sug[]>([]);
  const sig = JSON.stringify(filters);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    (async () => {
      const out: Sug[] = [];
      const f = filters as Record<string, unknown>;
      if (total > 60) {
        // Quá nhiều kết quả → gợi ý thu hẹp theo tỉnh / ngành đang có nhiều tin nhất (số lấy từ facets hiện tại).
        if (!isSet(f.provinces) && !isSet(f.location) && facets)
          facets.locations.slice(0, 2).forEach((l) =>
            out.push({ key: `loc-${l.location}`, text: `Chỉ ${l.location} → ${formatNumber(l.count)} việc`, patch: { provinces: [l.location], location: undefined } }),
          );
        if (!isSet(f.industries) && facets)
          facets.industries.slice(0, 1).forEach((i) =>
            out.push({ key: `ind-${i.industry}`, text: `Ngành ${i.industry} → ${formatNumber(i.count)} việc`, patch: { industries: [i.industry] } }),
          );
        if (!isSet(f.postedWithin)) out.push({ key: 'new7', text: 'Chỉ tin đăng 7 ngày qua', patch: { postedWithin: '7d' } });
      } else if (total < 8) {
        // Quá ít kết quả → đếm thật khi bỏ từng bộ lọc.
        const active = RELAX_ORDER.filter((k) => isSet(f[k]));
        const counts = await Promise.all(
          active.map(async (k) => {
            const p: Record<string, unknown> = { ...f, page: 1, pageSize: 1 };
            delete p[k];
            if (k === 'provinces') delete p.location;
            try {
              const r = await jobsApi.list(p as JobListParams);
              return { k, n: r.total };
            } catch {
              return { k, n: total };
            }
          }),
        );
        counts
          .filter((c) => c.n > total)
          .sort((a, b) => b.n - a.n)
          .slice(0, 3)
          .forEach((c) =>
            out.push({
              key: `relax-${c.k}`,
              text: `Bỏ lọc ${LABELS[c.k]} → có thêm ${formatNumber(c.n - total)} việc`,
              patch: { [c.k]: c.k === 'provinces' || c.k === 'industries' ? [] : undefined, ...(c.k === 'provinces' ? { location: undefined } : {}) } as Partial<JobListParams>,
            }),
          );
      }
      if (alive) setSugs(out);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, total, loading, facets]);

  if (sugs.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap text-[13px]">
      <span className="font-semibold text-ink-muted">💡 {total > 60 ? 'Thu hẹp nhanh:' : 'Mở rộng kết quả:'}</span>
      {sugs.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onApply(s.patch)}
          className="rounded-full border border-primary text-primary font-semibold px-3 py-1 hover:bg-primary-tint"
        >
          {s.text}
        </button>
      ))}
    </div>
  );
}
