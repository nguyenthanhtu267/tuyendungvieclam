'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { JobCard } from '@/components/JobCard';
import { jobsApi, type JobFacets, type JobListResponse } from '@/lib/api';

function JobSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const location = searchParams.get('location') ?? '';
  const industry = searchParams.get('industry') ?? '';
  const page = Number(searchParams.get('page') ?? '1');

  const [qInput, setQInput] = useState(q);
  const [locationInput, setLocationInput] = useState(location);
  const [result, setResult] = useState<JobListResponse | null>(null);
  const [facets, setFacets] = useState<JobFacets | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setQInput(q);
    setLocationInput(location);
  }, [q, location]);

  useEffect(() => {
    setLoading(true);
    jobsApi
      .list({ q, location, industry, page, pageSize: 8 })
      .then(setResult)
      .catch(() => setResult({ items: [], total: 0, page: 1, pageSize: 8, totalPages: 1 }))
      .finally(() => setLoading(false));
  }, [q, location, industry, page]);

  useEffect(() => {
    jobsApi
      .facets()
      .then(setFacets)
      .catch(() => setFacets(null));
  }, []);

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    params.delete('page');
    router.push(`/viec-lam?${params.toString()}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ q: qInput, location: locationInput });
  }

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/viec-lam?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const heading = industry
    ? `Việc làm ngành ${industry}`
    : location
      ? `Việc làm tại ${location}`
      : q
        ? `Kết quả tìm kiếm cho "${q}"`
        : 'Tất cả việc làm';

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6">
        <form
          onSubmit={handleSearchSubmit}
          className="rounded-xl border border-border bg-white p-3.5 flex gap-2.5 flex-wrap"
        >
          <input
            className="tvl-input flex-[2] min-w-[160px]"
            placeholder="Chức danh, kỹ năng, tên công ty"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
          <input
            className="tvl-input flex-1 min-w-[140px]"
            placeholder="Địa điểm"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
          />
          <button type="submit" className="tvl-btn-primary !w-auto px-6">
            🔎 Tìm
          </button>
        </form>

        {facets && facets.industries.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3">
            <button
              onClick={() => updateParams({ industry: undefined })}
              className={`text-[11.5px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                !industry ? 'bg-primary text-white border-primary' : 'border-border-strong text-ink-muted'
              }`}
            >
              Tất cả ({facets.total})
            </button>
            {facets.industries.slice(0, 6).map((f) => (
              <button
                key={f.industry}
                onClick={() => updateParams({ industry: f.industry })}
                className={`text-[11.5px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  industry === f.industry
                    ? 'bg-primary text-white border-primary'
                    : 'border-border-strong text-ink-muted hover:border-primary'
                }`}
              >
                {f.industry} ({f.count})
              </button>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_280px] gap-5 mt-5 items-start">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h1 className="font-extrabold text-lg">
                {loading ? 'Đang tìm...' : `${result?.total ?? 0} ${heading}`}
              </h1>
            </div>

            {!loading && result?.items.length === 0 && (
              <div className="rounded-xl border border-border bg-white p-8 text-center text-ink-muted text-sm">
                Không tìm thấy tin tuyển dụng phù hợp. Thử từ khoá hoặc địa điểm khác.
              </div>
            )}

            <div className="flex flex-col gap-3">
              {result?.items.map((job) => <JobCard key={job.id} job={job} />)}
            </div>

            {result && result.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                  className="tvl-btn-ghost !w-auto px-4 py-1.5 text-xs disabled:opacity-40"
                >
                  ← Trước
                </button>
                <span className="text-xs text-ink-muted px-2">
                  Trang {result.page} / {result.totalPages}
                </span>
                <button
                  disabled={page >= result.totalPages}
                  onClick={() => goToPage(page + 1)}
                  className="tvl-btn-ghost !w-auto px-4 py-1.5 text-xs disabled:opacity-40"
                >
                  Sau →
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3.5">
            <div className="rounded-xl bg-primary p-[18px] flex flex-col gap-2">
              <div className="text-white font-extrabold text-sm">Lọc việc phù hợp nhanh hơn</div>
              <div className="text-white/75 text-xs">Tạo hồ sơ để nhận gợi ý việc làm mỗi ngày</div>
              <a href="/dang-nhap" className="bg-white text-primary rounded-lg text-xs font-bold px-3.5 py-2 w-fit mt-1">
                Tạo hồ sơ ngay
              </a>
            </div>
            {facets && facets.locations.length > 0 && (
              <div className="rounded-xl border border-border bg-white p-4">
                <div className="text-[11px] font-bold text-primary uppercase tracking-wide mb-2.5">
                  Địa điểm phổ biến
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {facets.locations.map((f) => (
                    <button
                      key={f.location}
                      onClick={() => updateParams({ location: f.location })}
                      className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full border border-border-strong text-ink-muted hover:border-primary transition-colors"
                    >
                      {f.location} ({f.count})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ViecLamPage() {
  return (
    <Suspense fallback={null}>
      <JobSearchPage />
    </Suspense>
  );
}
