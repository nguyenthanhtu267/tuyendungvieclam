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
  urgentOnly: 'chỉ việc URGENT',
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
      if (total < 8) {
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

  const [openMenu, setOpenMenu] = useState(false);
  if (sugs.length === 0) return null;
  // Đợt 76 — dạng nút xổ gọn nằm cùng hàng tiêu đề kết quả (không chiếm dòng riêng, không tràn nội dung).
  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpenMenu(false); }}>
      <button
        type="button"
        onClick={() => setOpenMenu((v) => !v)}
        aria-expanded={openMenu}
        className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-white text-primary font-bold px-3 py-1.5 text-[14px] whitespace-nowrap hover:bg-primary-tint"
      >
        💡 Mở rộng kết quả <span className="tabular-nums">({sugs.length})</span> <span className="text-[10px]">▾</span>
      </button>
      {openMenu && (
        <div className="absolute left-0 top-full mt-1 z-30 w-[min(92vw,380px)] rounded-xl border border-border bg-white shadow-lg p-1.5 flex flex-col">
          {sugs.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => { setOpenMenu(false); onApply(s.patch); }}
              className="text-left rounded-lg px-3 py-2 text-[14px] font-semibold text-ink hover:bg-primary-tint"
            >
              {s.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
