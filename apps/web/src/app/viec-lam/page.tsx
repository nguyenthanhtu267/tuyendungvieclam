'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { JobCard } from '@/components/JobCard';
import { FilterBar } from '@/components/search/FilterBar';
import { DistrictChips } from '@/components/search/DistrictChips';
import { jobsApi, candidatesApi, type JobFacets, type JobListParams, type JobListResponse, type DistrictFacet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

// Đợt 10 — trang tìm việc làm nâng cao đầy đủ (claude/06-spec-tim-kiem-nang-cao.md): thanh lọc
// FilterBar (tỉnh/thành + ngành nghề multi-select, 5 dropdown đơn, khẩn cấp, doanh nghiệp yêu thích),
// hàng chip quận/huyện khi chỉ chọn đúng 1 tỉnh/thành, danh sách JobCard kiểu careerviet.vn.

function arr(v: string | null): string[] | undefined {
  if (!v) return undefined;
  const parts = v.split(',').filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

function JobSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const [saveSearchState, setSaveSearchState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const filters: JobListParams = {
    q: searchParams.get('q') ?? undefined,
    location: searchParams.get('location') ?? undefined,
    provinces: arr(searchParams.get('provinces')),
    district: searchParams.get('district') ?? undefined,
    industries: arr(searchParams.get('industries')),
    salaryTier: searchParams.get('salaryTier') ? Number(searchParams.get('salaryTier')) : undefined,
    level: searchParams.get('level') ?? undefined,
    postedWithin: searchParams.get('postedWithin') ?? undefined,
    employmentType: searchParams.get('employmentType') ?? undefined,
    experienceLevel: searchParams.get('experienceLevel') ?? undefined,
    urgentOnly: searchParams.get('urgentOnly') === '1' || undefined,
    featuredEmployerOnly: searchParams.get('featuredEmployerOnly') === '1' || undefined,
  };
  const page = Number(searchParams.get('page') ?? '1');

  const [qInput, setQInput] = useState(filters.q ?? '');
  const [result, setResult] = useState<JobListResponse | null>(null);
  const [facets, setFacets] = useState<JobFacets | null>(null);
  const [districts, setDistricts] = useState<DistrictFacet[]>([]);
  const [loading, setLoading] = useState(true);
  // Đợt 12i (21/09/2026) — "Địa điểm phổ biến" chỉ hiện Top 15-20 tỉnh nhiều tin nhất kèm nút
  // "Xem thêm", tránh liệt kê tràn lan hết ~63 tỉnh (giống careerviet.vn). Sau khi sửa lỗi đếm gộp
  // "Hà Nội | Hồ Chí Minh", số mục trả về đúng bằng số tỉnh thực có tin — cần giới hạn hiển thị.
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [showAllIndustries, setShowAllIndustries] = useState(false);
  const LOCATIONS_PREVIEW_COUNT = 18;
  const INDUSTRIES_PREVIEW_COUNT = 18;

  useEffect(() => {
    setQInput(filters.q ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q]);

  useEffect(() => {
    setLoading(true);
    jobsApi
      .list({ ...filters, page, pageSize: 8 })
      .then(setResult)
      .catch(() => setResult({ items: [], total: 0, page: 1, pageSize: 8, totalPages: 1 }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    jobsApi
      .facets(filters)
      .then(setFacets)
      .catch(() => setFacets(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const provinces = filters.provinces;
    if (!provinces || provinces.length !== 1) {
      setDistricts([]);
      return;
    }
    jobsApi
      .districtFacets(provinces[0], filters)
      .then(setDistricts)
      .catch(() => setDistricts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function updateParams(next: Partial<JobListParams>) {
    const params = new URLSearchParams(searchParams.toString());
    const patched: Record<string, unknown> = { ...filters, ...next };
    (['q', 'location', 'provinces', 'district', 'industries', 'salaryTier', 'level', 'postedWithin', 'employmentType', 'experienceLevel', 'urgentOnly', 'featuredEmployerOnly'] as const).forEach(
      (key) => {
        const v = patched[key];
        params.delete(key);
        if (v === undefined || v === '' || v === false) return;
        if (Array.isArray(v)) {
          if (v.length > 0) params.set(key, v.join(','));
          return;
        }
        params.set(key, v === true ? '1' : String(v));
      },
    );
    params.delete('page');
    router.push(`/viec-lam?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ q: qInput });
  }

  function handleClearFilters() {
    router.push(qInput ? `/viec-lam?q=${encodeURIComponent(qInput)}` : '/viec-lam');
  }

  // Đợt 12m (21/09/2026) — "Lưu tìm kiếm này" (Job alert): lưu nguyên bộ lọc hiện tại làm tiêu chí,
  // báo qua chuông thông báo khi có tin mới khớp (xem notifyJobAlertMatches() ở admin.service.ts —
  // chỉ đọc q/industries/provinces trong criteria, các trường khác lưu kèm để hiển thị lại cho đúng).
  async function handleSaveSearch() {
    if (!token) return;
    setSaveSearchState('saving');
    try {
      await candidatesApi.saveSearch(token, { criteria: filters as Record<string, unknown>, resultCount: result?.total });
      setSaveSearchState('saved');
    } catch {
      setSaveSearchState('error');
    }
  }

  useEffect(() => {
    setSaveSearchState('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/viec-lam?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const heading = qInput ? `Kết quả tìm kiếm cho "${qInput}"` : 'Tất cả việc làm';

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col gap-3">
        <form onSubmit={handleSearchSubmit} className="rounded-xl border border-border bg-white p-3.5 flex gap-2.5 flex-wrap">
          <input
            className="tvl-input flex-[2] min-w-[200px]"
            placeholder="Chức danh, kỹ năng, tên công ty"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
          <button type="submit" className="tvl-btn-primary !w-auto px-6">
            🔎 Tìm
          </button>
        </form>

        <FilterBar value={filters} onChange={updateParams} onClear={handleClearFilters} />

        {districts.length > 0 && (
          <DistrictChips
            districts={districts}
            selected={filters.district}
            onSelect={(d) => updateParams({ district: d })}
          />
        )}

        <div className="grid lg:grid-cols-[1fr_280px] gap-5 mt-2 items-start">
          <div>
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <h1 className="font-extrabold text-lg">
                {loading ? 'Đang tìm...' : `${result?.total ?? 0} ${heading}`}
              </h1>
              {/* Đợt 12m — chỉ hiện khi đã đăng nhập bằng tài khoản ứng viên và có ít nhất 1 tiêu chí
                  lọc (q/ngành/tỉnh), tránh lưu "tìm kiếm rỗng" vô nghĩa. */}
              {me?.role === 'candidate' && (filters.q || filters.industries?.length || filters.provinces?.length) ? (
                <button
                  type="button"
                  onClick={handleSaveSearch}
                  disabled={saveSearchState === 'saving' || saveSearchState === 'saved'}
                  className="tvl-btn-ghost !w-auto px-3.5 py-1.5 text-xs disabled:opacity-70"
                >
                  {saveSearchState === 'saved'
                    ? '✓ Đã lưu tìm kiếm'
                    : saveSearchState === 'saving'
                      ? 'Đang lưu...'
                      : saveSearchState === 'error'
                        ? 'Lỗi, thử lại'
                        : '🔔 Lưu tìm kiếm này'}
                </button>
              ) : null}
            </div>

            {!loading && result?.items.length === 0 && (
              <div className="rounded-xl border border-border bg-white p-8 text-center text-ink-muted text-sm">
                Không tìm thấy tin tuyển dụng phù hợp. Thử từ khoá hoặc bộ lọc khác.
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
                  {(showAllLocations ? facets.locations : facets.locations.slice(0, LOCATIONS_PREVIEW_COUNT)).map(
                    (f) => (
                      <button
                        key={f.location}
                        onClick={() => updateParams({ location: f.location })}
                        className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full border border-border-strong text-ink-muted hover:border-primary transition-colors"
                      >
                        {f.location} ({f.count})
                      </button>
                    ),
                  )}
                </div>
                {facets.locations.length > LOCATIONS_PREVIEW_COUNT && (
                  <button
                    onClick={() => setShowAllLocations((v) => !v)}
                    className="text-[11.5px] font-bold text-primary mt-2.5 hover:underline"
                  >
                    {showAllLocations ? 'Thu gọn' : `Xem thêm (${facets.locations.length - LOCATIONS_PREVIEW_COUNT})`}
                  </button>
                )}
              </div>
            )}
            {facets && facets.industries.length > 0 && (
              <div className="rounded-xl border border-border bg-white p-4">
                <div className="text-[11px] font-bold text-primary uppercase tracking-wide mb-2.5">
                  Ngành nghề phổ biến
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(showAllIndustries ? facets.industries : facets.industries.slice(0, INDUSTRIES_PREVIEW_COUNT)).map(
                    (f) => (
                      <button
                        key={f.industry}
                        onClick={() => updateParams({ industries: [f.industry] })}
                        className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full border border-border-strong text-ink-muted hover:border-primary transition-colors"
                      >
                        {f.industry} ({f.count})
                      </button>
                    ),
                  )}
                </div>
                {facets.industries.length > INDUSTRIES_PREVIEW_COUNT && (
                  <button
                    onClick={() => setShowAllIndustries((v) => !v)}
                    className="text-[11.5px] font-bold text-primary mt-2.5 hover:underline"
                  >
                    {showAllIndustries
                      ? 'Thu gọn'
                      : `Xem thêm (${facets.industries.length - INDUSTRIES_PREVIEW_COUNT})`}
                  </button>
                )}
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
