'use client';

import { useMatches } from '@/lib/match';
import { Fragment, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseNaturalQuery } from '@/lib/nl-search';
import SiteHeader from '@/components/SiteHeader';
import { JobCard } from '@/components/JobCard';
import { FilterBar } from '@/components/search/FilterBar';
import { DistrictChips } from '@/components/search/DistrictChips';
import { jobsApi, candidatesApi, applicationsApi, type JobFacets, type JobListParams, type JobListResponse, type DistrictFacet } from '@/lib/api';
import { track } from '@/lib/analytics';
import { useAuth } from '@/lib/auth-context';
import { formatNumber } from '@/lib/format';
import { AdSlot } from '@/components/ads/AdSlot';
import { AdStack } from '@/components/ads/AdStack';
import { RecentJobs } from '@/components/RecentJobs';
import { FilterSuggestions } from '@/components/search/FilterSuggestions';
import { readRecentJobs } from '@/lib/recent-jobs';

// Đợt 10 — trang tìm việc làm nâng cao đầy đủ (claude/06-spec-tim-kiem-nang-cao.md): thanh lọc
// FilterBar (tỉnh/thành + ngành nghề multi-select, 5 dropdown đơn, ưu tiên, doanh nghiệp yêu thích),
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
  const [sortMatch, setSortMatch] = useState(false);
  // Đợt 59 — "Chỉ hiện tin mới với tôi": ẩn tin đã xem gần đây + tin đã ứng tuyển (trong trang đang xem).
  const [onlyNew, setOnlyNewState] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem('tvl_only_new') === '1') setOnlyNewState(true); } catch {}
  }, []);
  const setOnlyNew = (v: boolean) => {
    setOnlyNewState(v);
    try { localStorage.setItem('tvl_only_new', v ? '1' : '0'); } catch {}
  };
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
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
  const matchMap = useMatches(result?.items.map((j) => j.id) ?? []);
  const sortedItems = (() => {
    const items = result?.items ?? [];
    if (!sortMatch) return items;
    return [...items].sort((a, b) => (matchMap[b.id]?.score ?? -1) - (matchMap[a.id]?.score ?? -1));
  })();
  useEffect(() => {
    setSeenIds(new Set(readRecentJobs().map((j) => j.id)));
    if (me?.role === 'candidate' && token)
      applicationsApi
        .listOwn(token)
        .then((list) => setAppliedIds(new Set(list.map((a) => (a as unknown as { jobPostingId?: string; jobPosting?: { id: string } }).jobPostingId ?? (a as unknown as { jobPosting?: { id: string } }).jobPosting?.id ?? ''))))
        .catch(() => undefined);
  }, [me, token]);
  const visibleItems = onlyNew ? sortedItems.filter((j) => !seenIds.has(j.id) && !appliedIds.has(j.id)) : sortedItems;
  const hiddenCount = sortedItems.length - visibleItems.length;
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
      .then((res) => {
        setResult(res);
        // Đợt 19 — ghi lượt tìm việc (từ khoá, bộ lọc, số kết quả — kể cả khi KHÔNG ra kết quả nào) cho
        // Admin "Phân tích truy cập". Chỉ tính trang 1 (lật trang không phải lượt tìm mới).
        const used = Object.entries(filters).filter(([k, v]) => k !== 'q' && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length));
        if (page === 1 && (filters.q?.trim() || used.length)) {
          track('search', {
            meta: { q: filters.q?.trim() || '', total: res.total, filters: used.map(([k]) => k).join(',') },
          });
        }
      })
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
    const nl = parseNaturalQuery(qInput);
    const f = nl.filters;
    // Chỉ áp bộ lọc thông minh khi câu có phần "hiểu được" ngoài từ khoá; ngược lại giữ hành vi cũ.
    if (nl.chips.length === 0) return updateParams({ q: qInput });
    updateParams({
      q: f.q ?? '',
      provinces: f.provinces,
      industries: f.industries,
      salaryTier: f.salaryTier,
      postedWithin: f.postedWithin,
      employmentType: f.employmentType,
      urgentOnly: f.urgentOnly,
    } as never);
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-4 pb-6 flex flex-col gap-3">
        {/* Đợt 12t (21/09/2026) — gộp ô tìm từ khóa + nút "Tìm" vào chung 1 dòng với Tỉnh/Thành +
            Ngành nghề trong FilterBar (trước đây là 2 khối trắng tách rời, theo yêu cầu người dùng). */}
        <FilterBar
          value={filters}
          onChange={updateParams}
          onClear={handleClearFilters}
          searchValue={qInput}
          onSearchChange={setQInput}
          onSearchSubmit={handleSearchSubmit}
        />

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
              <div className="flex items-center gap-x-3 gap-y-1 flex-wrap min-w-0 flex-1">
                <h1 className="font-extrabold text-lg">
                  {/* Đợt 13 (24/09/2026) — thiếu formatNumber() khiến số hàng nghìn hiện dính liền
                      (VD "1106" thay vì "1.106") — xem Quy tắc chung mục A. */}
                  {loading ? 'Đang tìm...' : `${formatNumber(result?.total ?? 0)} ${heading}`}
                </h1>
                {/* Đợt 58 — "Tin vừa xem" ngay sau tiêu đề, xổ danh sách "Tiêu đề - Công ty". */}
                <RecentJobs />
                {/* Đợt 66 — cùng dòng: lọc nhanh theo thời gian đăng + "Chỉ hiện tin mới". */}
                <div className="flex items-center gap-1.5 flex-wrap text-[13px]" role="group" aria-label="Thu hẹp nhanh theo ngày đăng">
                  <span className="font-semibold text-ink-muted">💡 Thu hẹp nhanh: chỉ tin đăng</span>
                  {[['3d', '3 ngày'], ['7d', '7 ngày'], ['15d', '15 ngày'], ['30d', '30 ngày']].map(([v, l]) => {
                    const on = filters.postedWithin === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={on}
                        onClick={() => updateParams({ postedWithin: on ? undefined : v })}
                        className={`rounded-full border px-2.5 py-0.5 whitespace-nowrap font-semibold ${on ? 'bg-primary text-white border-primary' : 'border-primary text-primary hover:bg-primary-tint'}`}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
                <label className="flex items-center gap-2 text-[13px] font-semibold" htmlFor="only-new">
                  <input id="only-new" type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} />
                  🆕 Chỉ hiện tin mới với tôi{onlyNew && hiddenCount > 0 ? ` (đã ẩn ${hiddenCount})` : ''}
                </label>
              </div>
            </div>

            <FilterSuggestions
              filters={filters}
              total={result?.total ?? 0}
              facets={facets}
              loading={loading}
              onApply={(patch) => updateParams(patch)}
            />

            <div className="flex items-center gap-x-5 gap-y-1 flex-wrap text-sm font-semibold">
              {me?.role === 'candidate' && (result?.items.length ?? 0) > 1 && (
                <label className="flex items-center gap-2" htmlFor="sort-match">
                  <input id="sort-match" type="checkbox" checked={sortMatch} onChange={(e) => setSortMatch(e.target.checked)} />
                  ✨ Ưu tiên tin phù hợp với hồ sơ của tôi nhất
                </label>
              )}
              {!me && (
                <a href="/dang-nhap" className="text-primary hover:underline font-semibold">
                  ✨ Đăng nhập để xem % phù hợp với hồ sơ của bạn
                </a>
              )}
              {/* Đợt 12m — chỉ hiện khi đã đăng nhập bằng tài khoản ứng viên và có ít nhất 1 tiêu chí
                  lọc (q/ngành/tỉnh), tránh lưu "tìm kiếm rỗng" vô nghĩa. */}
              {(!me || me.role === 'candidate') && (filters.q || filters.industries?.length || filters.provinces?.length) ? (
                <button
                  type="button"
                  onClick={me ? handleSaveSearch : () => router.push('/dang-nhap')}
                  disabled={saveSearchState === 'saving' || saveSearchState === 'saved'}
                  className="tvl-btn-ghost !w-auto px-3.5 py-1.5 text-xs disabled:opacity-70"
                >
                  {saveSearchState === 'saved'
                    ? '✓ Đã lưu tìm kiếm'
                    : saveSearchState === 'saving'
                      ? 'Đang lưu...'
                      : saveSearchState === 'error'
                        ? 'Lỗi, thử lại'
                        : '🔔 Báo tôi khi có việc mới khớp bộ lọc này'}
                </button>
              ) : null}
            </div>

            {!loading && result?.items.length === 0 && (
              <div className="rounded-xl border border-border bg-white p-8 text-center text-ink-muted text-sm">
                Không tìm thấy tin tuyển dụng phù hợp. Thử từ khoá hoặc bộ lọc khác.
              </div>
            )}

            <div className="flex flex-col gap-3">
              {/* Đợt 24 — banner xen giữa danh sách: sau tin thứ 5 (ít hơn 5 tin thì sau tin cuối). */}
              {visibleItems.map((job, i, arr) => (
                <Fragment key={job.id}>
                  <JobCard job={job} />
                  {i === Math.min(4, arr.length - 1) && <AdSlot slot="jobs-inline" />}
                </Fragment>
              ))}
            </div>

            {/* Đợt 28 — banner cuối danh sách kết quả. */}
            <AdSlot slot="jobs-bottom" className="mt-3" />

            {result && result.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                {/* Đợt 13 (24/09/2026) — thêm nút "Đầu tiên"/"Cuối cùng" để nhảy nhanh 2 đầu danh
                    sách phân trang, theo yêu cầu người dùng. */}
                <button
                  disabled={page <= 1}
                  onClick={() => goToPage(1)}
                  className="tvl-btn-ghost !w-auto px-4 py-1.5 text-xs disabled:opacity-40"
                >
                  Đầu tiên
                </button>
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
                <button
                  disabled={page >= result.totalPages}
                  onClick={() => goToPage(result.totalPages)}
                  className="tvl-btn-ghost !w-auto px-4 py-1.5 text-xs disabled:opacity-40"
                >
                  Cuối cùng
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3.5 lg:self-stretch">
            <div className="rounded-xl bg-primary p-[18px] flex flex-col gap-2">
              <div className="text-white font-extrabold text-sm">Lọc việc phù hợp nhanh hơn</div>
              <div className="text-white/95 text-xs">Tạo hồ sơ để nhận gợi ý việc làm mỗi ngày</div>
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
            <AdStack sticky={false}>
              <AdSlot slot="jobs-side-mini" />
            </AdStack>
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
            {/* Đợt 36 — bỏ khối "Việc làm được tìm kiếm nhiều nhất" và banner cột phải ở trang này: trùng với bộ lọc Ngành nghề ngay phía trên. */}
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
