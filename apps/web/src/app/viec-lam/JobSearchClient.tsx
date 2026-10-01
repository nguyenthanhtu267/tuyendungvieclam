'use client';

import { useMatches } from '@/lib/match';
import { Fragment, Suspense, useEffect, useRef, useState } from 'react';
import { JOB_PAGE_SIZE, parseJobFilters } from '@/lib/job-filters';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseNaturalQuery } from '@/lib/nl-search';
import SiteHeader from '@/components/SiteHeader';
import { JobCard } from '@/components/JobCard';
import { SwipeRow } from '@/components/SwipeRow';
import Link from '@/components/SmartLink';
import JobQuickView from '@/components/JobQuickView';
import BulkApplyModal from '@/components/BulkApplyModal';
import { haptic } from '@/lib/haptic';
import { useJobNotes } from '@/components/JobNote';
import { FilterBar } from '@/components/search/FilterBar';
import { NearMe } from '@/components/search/NearMe';
import { ProvinceInsights } from '@/components/search/ProvinceInsights';
import { DistrictChips } from '@/components/search/DistrictChips';
import { jobsApi, smartApi5, candidatesApi, applicationsApi, type JobFacets, type JobListParams, type JobListResponse, type DistrictFacet, type SavedJob } from '@/lib/api';
import { detectWeakNet, isWeakNow, readSaver } from '@/lib/data-saver';
import { track } from '@/lib/analytics';
import { useAuth } from '@/lib/auth-context';
import { formatNumber } from '@/lib/format';
import { AdSlot } from '@/components/ads/AdSlot';
import { AdStack } from '@/components/ads/AdStack';
import { ToggleChip } from '@/components/ToggleChip';
import { RecentJobs } from '@/components/RecentJobs';
import { FilterSuggestions } from '@/components/search/FilterSuggestions';
import { readRecentJobs } from '@/lib/recent-jobs';
import OfflineJobsPanel from '@/components/OfflineJobsPanel';
import { cacheJob, cacheList, readCachedList, agoText } from '@/lib/offline-cache';

// Đợt 10 — trang tìm việc làm nâng cao đầy đủ (claude/06-spec-tim-kiem-nang-cao.md): thanh lọc
// FilterBar (tỉnh/thành + ngành nghề multi-select, 5 dropdown đơn, ưu tiên, doanh nghiệp yêu thích),
// hàng chip quận/huyện khi chỉ chọn đúng 1 tỉnh/thành, danh sách JobCard kiểu careerviet.vn.


function JobSearchPage({ initial, initialFacets }: { initial: { key: string; data: JobListResponse } | null; initialFacets: { key: string; data: JobFacets } | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const [sortMatch, setSortMatch] = useState(false);
  // Đợt 99 — tin đã vuốt-ẩn (nhớ ở máy, tối đa 200 tin) + "Hoàn tác" tin vừa ẩn.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    try { setHiddenIds(new Set<string>(JSON.parse(localStorage.getItem('tvl_hidden_jobs') || '[]'))); } catch { /* bỏ qua */ }
  }, []);
  const [lastHidden, setLastHidden] = useState<string | null>(null);
  function hideJob(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev).add(id);
      try { localStorage.setItem('tvl_hidden_jobs', JSON.stringify(Array.from(next).slice(-200))); } catch { /* bỏ qua */ }
      return next;
    });
    setLastHidden(id);
    setTimeout(() => setLastHidden((c) => (c === id ? null : c)), 5000);
  }
  // Đợt 102 — "Chọn nhiều": ứng viên đã đăng nhập tick nhiều tin rồi nộp một lần (dùng lại màn nộp hàng loạt, tối đa 15 tin).
  const myNotes = useJobNotes();
  // Đợt 107 — "Xem nhanh": từ 1024px bấm tin = xem chi tiết rút gọn ở cột phải; mặc định BẬT trên máy cảm ứng (iPad ngang), TẮT trên máy tính chuột.
  const [quick, setQuick] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    try { setQuick(window.matchMedia('(pointer: coarse) and (min-width: 1024px)').matches); } catch { /* bỏ qua */ }
  }, []);
  const [pickMode, setPickMode] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkJobs, setBulkJobs] = useState<SavedJob[]>([]);
  function togglePick(id: string) {
    haptic(8);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 15) next.add(id);
      return next;
    });
  }
  // Đợt 102 — nhớ bộ lọc lần tìm trước (chỉ ở máy này) để mở lại bằng 1 chạm.
  const [lastSearch, setLastSearch] = useState<string | null>(null);
  useEffect(() => {
    try { setLastSearch(localStorage.getItem('tvl_last_search')); } catch { /* bỏ qua */ }
  }, []);
  function undoHide() {
    if (!lastHidden) return;
    const id = lastHidden;
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      try { localStorage.setItem('tvl_hidden_jobs', JSON.stringify(Array.from(next))); } catch { /* bỏ qua */ }
      return next;
    });
    setLastHidden(null);
  }
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

  // Đợt 111 — mạng yếu: gom nhiều lần chọn bộ lọc, chờ ~1,2 giây rồi mới tìm MỘT lần (hoặc bấm "Áp dụng ngay").
  const [pend, setPend] = useState<Partial<JobListParams>>({});
  const pendRef = useRef<Partial<JobListParams>>({});
  const pendTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const urlFilters: JobListParams = parseJobFilters((k) => searchParams.get(k));
  const filters: JobListParams = { ...urlFilters, ...pend };
  const page = Number(searchParams.get('page') ?? '1');

  const [qInput, setQInput] = useState(filters.q ?? '');
  // Đợt 90 — 8 tin đầu được máy chủ dựng sẵn (initial) → danh sách hiện ngay khi mở trang.
  const initialHit = useRef(initial && initial.key === searchParams.toString() ? initial.data : null);
  const [result, setResult] = useState<JobListResponse | null>(initialHit.current);
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
  const visibleItems = (onlyNew ? sortedItems.filter((j) => !seenIds.has(j.id) && !appliedIds.has(j.id)) : sortedItems).filter((j) => !hiddenIds.has(j.id)).sort((a, b) => Number(!!myNotes[b.id]?.pinned) - Number(!!myNotes[a.id]?.pinned));
  const hiddenCount = sortedItems.length - visibleItems.length;
  const router2 = router;
  useEffect(() => {
    if (!quick) return;
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const ids = visibleItems.map((j) => j.id);
      if (!ids.length) return;
      const i = sel ? ids.indexOf(sel) : -1;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const n = ids[Math.min(ids.length - 1, i + 1)];
        setSel(n);
        document.getElementById(`jc-${n}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = ids[Math.max(0, i - 1)];
        setSel(n);
        document.getElementById(`jc-${n}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if (e.key === 'Enter' && sel) {
        router2.push(`/viec-lam/${sel}`);
      } else if (e.key === 'Escape') {
        setSel(null);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });
  const facetsHit = useRef(initialFacets && initialFacets.key === searchParams.toString() ? initialFacets.data : null);
  const [facets, setFacets] = useState<JobFacets | null>(facetsHit.current);
  const [districts, setDistricts] = useState<{ province: string; items: DistrictFacet[] }[]>([]);
  const [loading, setLoading] = useState(true);
  // Đợt 109 — mạng yếu: hiện ngay kết quả lần trước rồi cập nhật; lỗi mạng thì báo + Thử lại (không giả vờ "không có việc").
  const [refreshing, setRefreshing] = useState(false);
  const [listErr, setListErr] = useState<{ stale: number | null } | null>(null);
  const [retryN, setRetryN] = useState(0);
  const [showLocal, setShowLocal] = useState(false);
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
    const pre = initialHit.current;
    initialHit.current = null; // chỉ dùng cho lần mở đầu tiên
    const ckey = searchParams.toString();
    const cached = pre ? null : readCachedList<JobListResponse>(ckey);
    setListErr(null);
    if (cached) {
      setResult(cached.data);
      setLoading(false);
      setRefreshing(true);
    } else setLoading(!pre);
    (pre ? Promise.resolve(pre) : jobsApi.list({ ...filters, page, pageSize: JOB_PAGE_SIZE }))
      .then((res) => {
        setResult(res);
        cacheList(ckey, res);
        // Đợt 19 — ghi lượt tìm việc (từ khoá, bộ lọc, số kết quả — kể cả khi KHÔNG ra kết quả nào) cho
        // Admin "Phân tích truy cập". Chỉ tính trang 1 (lật trang không phải lượt tìm mới).
        const used = Object.entries(filters).filter(([k, v]) => k !== 'q' && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length));
        if (page === 1 && (filters.q?.trim() || used.length)) {
          track('search', {
            meta: { q: filters.q?.trim() || '', total: res.total, filters: used.map(([k]) => k).join(',') },
          });
        }
      })
      .catch(() => {
        if (cached) setListErr({ stale: cached.at });
        else {
          setListErr({ stale: null });
          setResult({ items: [], total: 0, page: 1, pageSize: 8, totalPages: 1 });
        }
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, retryN]);

  // Đợt 110 — lúc rảnh, lưu sẵn chi tiết 3 tin đầu vào máy (để đọc khi mất mạng). Bỏ qua khi mạng yếu / tiết kiệm dữ liệu.
  useEffect(() => {
    const items = result?.items?.slice(0, 3) ?? [];
    if (!items.length || detectWeakNet() || readSaver()) return;
    const w = window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (n: number) => void };
    let off = false;
    const run = () => {
      items.forEach((j, i) =>
        setTimeout(() => {
          if (off || document.visibilityState !== 'visible') return;
          jobsApi.getQuiet(j.id).then((r) => cacheJob(r.job, r.related)).catch(() => undefined);
        }, i * 700),
      );
    };
    const h = w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 4000 }) : (setTimeout(run, 2500) as unknown as number);
    return () => {
      off = true;
      if (w.cancelIdleCallback) w.cancelIdleCallback(h);
    };
  }, [result]);

  useEffect(() => {
    if (!listErr) return;
    const on = () => setRetryN((n) => n + 1);
    window.addEventListener('online', on);
    window.addEventListener('tvl-retry', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('tvl-retry', on);
    };
  }, [listErr]);

  useEffect(() => {
    if (facetsHit.current) {
      facetsHit.current = null; // đã có từ máy chủ cho đúng bộ lọc này — không gọi lại lần mở đầu
      return;
    }
    jobsApi
      .facets(filters)
      .then(setFacets)
      .catch(() => setFacets(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    // Đợt 89 — chọn 1–3 tỉnh: mỗi tỉnh một hàng quận/huyện riêng (quá 3 tỉnh thì ẩn cho gọn).
    const provinces = filters.provinces;
    if (!provinces || provinces.length < 1 || provinces.length > 3) {
      setDistricts([]);
      return;
    }
    let off = false;
    Promise.all(
      provinces.map((p) =>
        jobsApi
          .districtFacets(p, filters)
          .then((items) => ({ province: p, items }))
          .catch(() => ({ province: p, items: [] as DistrictFacet[] })),
      ),
    ).then((r) => !off && setDistricts(r.filter((x) => x.items.length > 0)));
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Đợt 75 — A/B tiêu đề: tin đang thử nghiệm hiện ngẫu nhiên (ổn định theo khách) tiêu đề A hoặc B.
  const [ab, setAb] = useState<Record<string, { testId: string; variant: 'a' | 'b'; title: string }>>({});
  useEffect(() => {
    const ids = (result?.items ?? []).map((j) => j.id);
    if (!ids.length) { setAb({}); return; }
    let off = false;
    smartApi5.publicTests(ids).then((r) => {
      if (off || !r.items.length) { if (!off) setAb({}); return; }
      let vid = '';
      try { vid = localStorage.getItem('tvl_vid') ?? ''; if (!vid) { vid = Math.random().toString(36).slice(2); localStorage.setItem('tvl_vid', vid); } } catch { vid = 'x'; }
      const m: Record<string, { testId: string; variant: 'a' | 'b'; title: string }> = {};
      for (const t of r.items) {
        let h = 0;
        for (const ch of vid + t.testId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        const variant = h % 2 === 0 ? 'a' : 'b';
        m[t.jobId] = { testId: t.testId, variant, title: variant === 'a' ? t.a : t.b };
        try {
          const k = `tvl_abv_${t.testId}`;
          if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); smartApi5.testEvent(t.testId, variant, 'view').catch(() => {}); }
        } catch { /* bỏ qua */ }
      }
      setAb(m);
    }).catch(() => {});
    return () => { off = true; };
  }, [result]);

  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  useEffect(() => {
    const q = filters.q?.trim();
    if (loading || !q || !result || result.total > 0) { setDidYouMean(null); return; }
    let off = false;
    jobsApi.suggest(q).then((r) => { if (!off) setDidYouMean(r.suggestion); }).catch(() => {});
    return () => { off = true; };
  }, [filters.q, loading, result]);

  function flushPending() {
    clearTimeout(pendTimer.current);
    const n = pendRef.current;
    pendRef.current = {};
    setPend({});
    if (Object.keys(n).length) commitParams(n);
  }
  function updateParams(next: Partial<JobListParams>) {
    if (!isWeakNow() || 'q' in next) {
      if (Object.keys(pendRef.current).length) {
        const n = { ...pendRef.current, ...next };
        pendRef.current = {};
        clearTimeout(pendTimer.current);
        setPend({});
        commitParams(n);
      } else commitParams(next);
      return;
    }
    pendRef.current = { ...pendRef.current, ...next };
    setPend(pendRef.current);
    clearTimeout(pendTimer.current);
    pendTimer.current = setTimeout(flushPending, 1200);
  }
  useEffect(() => () => clearTimeout(pendTimer.current), []);
  function commitParams(next: Partial<JobListParams>) {
    const params = new URLSearchParams(searchParams.toString());
    const patched: Record<string, unknown> = { ...filters, ...next };
    if ('provinces' in next && !('district' in next)) patched.district = undefined; // đổi tỉnh → bỏ quận/huyện của tỉnh cũ
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
    try { if (params.toString()) localStorage.setItem('tvl_last_search', params.toString()); } catch { /* bỏ qua */ }
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

        {lastSearch && searchParams.toString() === '' && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-1.5 text-[13px]">
            <Link href={`/viec-lam?${lastSearch}`} className="flex-1 min-w-0 truncate font-bold text-primary min-h-[36px] inline-flex items-center">
              ↺ Tìm lần trước: {Array.from(new URLSearchParams(lastSearch).values()).slice(0, 3).join(' · ')}
            </Link>
            <button type="button" aria-label="Xoá" className="w-9 h-9 text-ink-faint" onClick={() => { try { localStorage.removeItem('tvl_last_search'); } catch { /* bỏ qua */ } setLastSearch(null); }}>✕</button>
          </div>
        )}
        {(filters.provinces?.length ?? 0) === 0 && <NearMe onPick={(provinces) => updateParams({ provinces })} />}
        {districts.map((g) => (
          <DistrictChips
            key={g.province}
            label={districts.length > 1 || (filters.provinces?.length ?? 0) > 1 ? g.province : undefined}
            districts={g.items}
            selected={filters.district}
            onSelect={(d) => updateParams({ district: d })}
          />
        ))}
        {filters.provinces?.length === 1 && (
          <ProvinceInsights
            province={filters.provinces[0]}
            filters={filters}
            onPickQuery={(q) => updateParams({ q })}
            onPickIndustry={(i) => updateParams({ industries: [i] })}
          />
        )}

        <div className="grid lg:grid-cols-[1fr_280px] gap-5 mt-2 items-start">
          <div>
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div className="flex items-center gap-x-3 gap-y-1 flex-wrap min-w-0 flex-1">
                {/* Đợt 91 — tiêu đề luôn chiếm riêng 1 dòng trên điện thoại: trước đây chữ tiêu đề đổi ("Đang tìm..." → "1.286 Tất cả việc làm") làm 2 nút lọc bên cạnh nhảy xuống dòng dưới → giật bố cục. */}
                <div className="max-sm:basis-full min-w-0">
                  <h1 className="font-extrabold text-lg tvl-title">
                    {/* Đợt 13 (24/09/2026) — thiếu formatNumber() khiến số hàng nghìn hiện dính liền
                        (VD "1106" thay vì "1.106") — xem Quy tắc chung mục A. */}
                    {loading ? 'Đang tìm...' : listErr && !listErr.stale ? 'Danh sách việc làm' : `${formatNumber(result?.total ?? 0)} ${heading}`}
                  </h1>
                </div>
                {/* Đợt 58 — "Tin vừa xem" ngay sau tiêu đề, xổ danh sách "Tiêu đề - Công ty". */}
                <RecentJobs />
                <button
                  type="button"
                  onClick={() => updateParams({ experienceLevel: filters.experienceLevel === 'Không yêu cầu kinh nghiệm' ? undefined : 'Không yêu cầu kinh nghiệm' })}
                  aria-pressed={filters.experienceLevel === 'Không yêu cầu kinh nghiệm'}
                  className={`h-9 px-3 rounded-full border text-[13px] font-bold ${filters.experienceLevel === 'Không yêu cầu kinh nghiệm' ? 'bg-success text-white border-success' : 'border-border-strong text-ink'}`}
                >
                  🌱 Không cần kinh nghiệm
                </button>
                <button
                  type="button"
                  onClick={() => { setQuick((v) => !v); setSel(null); }}
                  aria-pressed={quick}
                  className={`hidden lg:inline-flex items-center h-9 px-3 rounded-full border text-[13px] font-bold ${quick ? 'bg-primary text-white border-primary' : 'border-border-strong text-ink'}`}
                >
                  👁 Xem nhanh
                </button>
                {me?.role === 'candidate' && (
                  <button
                    type="button"
                    onClick={() => { setPickMode((v) => !v); setPicked(new Set()); }}
                    aria-pressed={pickMode}
                    className={`h-9 px-3 rounded-full border text-[13px] font-bold ${pickMode ? 'bg-primary text-white border-primary' : 'border-border-strong text-ink'}`}
                  >
                    ☑ Chọn nhiều
                  </button>
                )}
                {/* Đợt 70 — 2 bộ lọc dạng nút bật/tắt gọn, cùng 1 dòng; chữ đầy đủ nằm ở tooltip. */}
                {/* Luôn hiện để mọi người thấy chức năng: khách → bấm sẽ đến trang đăng nhập; tài khoản không phải ứng viên → mờ kèm lời giải thích. */}
                <ToggleChip
                  checked={me?.role === 'candidate' && sortMatch}
                  disabled={!!me && me.role !== 'candidate'}
                  onChange={(v) => (me ? setSortMatch(v) : router.push('/dang-nhap'))}
                  title={
                    !me
                      ? 'Đăng nhập tài khoản ứng viên để ưu tiên tin phù hợp với hồ sơ của bạn nhất'
                      : me.role !== 'candidate'
                        ? 'Chỉ dành cho tài khoản ứng viên (cần hồ sơ để tính độ phù hợp)'
                        : 'Ưu tiên tin phù hợp với hồ sơ của tôi nhất'
                  }
                >
                  ✨ <span className="xl:hidden">Phù hợp nhất</span><span className="hidden xl:inline">Ưu tiên phù hợp hồ sơ</span>
                </ToggleChip>
                <ToggleChip
                  checked={onlyNew}
                  onChange={setOnlyNew}
                  title="Chỉ hiện tin mới với tôi (ẩn tin đã xem hoặc đã nộp)"
                  badge={onlyNew && hiddenCount > 0 ? `(ẩn ${hiddenCount})` : undefined}
                >
                  🆕 <span className="xl:hidden">Tin mới</span><span className="hidden xl:inline">Chỉ tin mới với tôi</span>
                </ToggleChip>
                {/* Đợt 76 — "Mở rộng kết quả" thu thành nút xổ, nằm cùng hàng tiêu đề. */}
                <FilterSuggestions
                  filters={filters}
                  total={result?.total ?? 0}
                  facets={facets}
                  loading={loading}
                  onApply={(patch) => updateParams(patch)}
                />
              </div>
            </div>

            <div className="flex items-center gap-x-5 gap-y-1 flex-wrap text-sm font-semibold empty:hidden [&:has(a)]:rounded-lg [&:has(a)]:bg-white [&:has(a)]:px-3 [&:has(a)]:py-1.5 [&:has(a)]:mb-1">
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
                  className="tvl-btn-ghost !w-auto px-3.5 py-1.5 text-xs disabled:text-ink-faint disabled:bg-white"
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

            {loading && !(result && result.items.length) && (
              <div className="flex flex-col gap-3" aria-busy="true" aria-label="Đang tải việc làm">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-white p-4 flex gap-3">
                    <div className="w-14 h-14 rounded-xl bg-surface-alt animate-pulse motion-reduce:animate-none shrink-0" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-4 w-3/4 rounded bg-surface-alt animate-pulse motion-reduce:animate-none" />
                      <div className="h-3 w-1/2 rounded bg-surface-alt animate-pulse motion-reduce:animate-none" />
                      <div className="h-3 w-1/3 rounded bg-surface-alt animate-pulse motion-reduce:animate-none" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {Object.keys(pend).length > 0 && (
              <div role="status" className="rounded-xl border border-border-strong bg-white px-3 py-2 text-[13px] flex items-center gap-2 flex-wrap">
                ⏳ Mạng yếu — đang gom bộ lọc, sẽ tìm một lần.
                <button type="button" onClick={flushPending} className="tvl-btn-primary !w-auto px-4 !h-8 text-[12.5px]">Áp dụng ngay</button>
              </div>
            )}
            {listErr && (
              <div role="status" className="rounded-xl border border-warning bg-warning-tint px-3 py-2 text-[13px] font-semibold text-[#7A4A00] flex items-center gap-2 flex-wrap">
                📶 {listErr.stale ? `Mạng yếu — đang hiện kết quả đã lưu (${agoText(listErr.stale)}).` : 'Chưa tải được danh sách vì mạng yếu.'}
                <button type="button" onClick={() => setRetryN((n) => n + 1)} className="tvl-btn-primary !w-auto px-4 !h-8 text-[12.5px]">Thử lại (phím R)</button>
              </div>
            )}
            {(listErr || showLocal) && <OfflineJobsPanel initialQuery={qInput} />}
            {!listErr && (
              <button type="button" onClick={() => setShowLocal((v) => !v)} className="self-start text-[12.5px] font-semibold text-primary hover:underline">
                📂 {showLocal ? 'Ẩn tin trong máy' : 'Tìm trong tin đã lưu trong máy'}
              </button>
            )}
            {refreshing && !listErr && <div className="text-[12px] text-ink-muted">⟳ Đang cập nhật kết quả mới…</div>}

            {!loading && !(listErr && !listErr.stale) && result?.items.length === 0 && (
              <div className="rounded-xl border border-border bg-white p-8 text-center text-ink-muted text-sm">
                Không tìm thấy tin tuyển dụng phù hợp. Thử từ khoá hoặc bộ lọc khác.
                {didYouMean && (
                  <div className="mt-3 text-base text-ink">
                    Ý bạn là:{' '}
                    <button type="button" className="font-semibold text-brand-700 underline" onClick={() => updateParams({ q: didYouMean })}>
                      {didYouMean}
                    </button>
                    ?
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {/* Đợt 24 — banner xen giữa danh sách: sau tin thứ 5 (ít hơn 5 tin thì sau tin cuối). */}
              {visibleItems.map((job, i, arr) => (
                <Fragment key={job.id}>
                  <div
                    id={`jc-${job.id}`}
                    className={quick && sel === job.id ? 'rounded-xl ring-2 ring-primary' : undefined}
                    onClickCapture={(e) => {
                      if (!quick || pickMode || !window.matchMedia('(min-width: 1024px)').matches) return;
                      if ((e.target as HTMLElement).closest('button, input, select, a[href^="tel:"]')) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setSel(job.id);
                    }}
                  >
                  <div onClickCapture={() => { const a = ab[job.id]; if (a) smartApi5.testEvent(a.testId, a.variant, 'click').catch(() => {}); }}>
                    {pickMode ? (
                      <div
                        className={`rounded-xl relative ${picked.has(job.id) ? 'ring-2 ring-primary' : ''} ${appliedIds.has(job.id) ? 'opacity-50' : ''}`}
                        onClickCapture={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!appliedIds.has(job.id)) togglePick(job.id);
                        }}
                      >
                        <span className={`absolute left-2 top-2 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center text-[14px] font-extrabold ${picked.has(job.id) ? 'bg-primary border-primary text-white' : 'bg-white border-border-strong text-transparent'}`} aria-hidden>✓</span>
                        <JobCard job={ab[job.id] ? { ...job, title: ab[job.id].title } : job} />
                      </div>
                    ) : (
                      <SwipeRow jobId={job.id} onHide={hideJob}>
                        <JobCard job={ab[job.id] ? { ...job, title: ab[job.id].title } : job} />
                      </SwipeRow>
                    )}
                  </div>
                  </div>
                  {i === Math.min(4, arr.length - 1) && <AdSlot slot="jobs-inline" />}
                </Fragment>
              ))}
            </div>

            {pickMode && (
              <div className="fixed inset-x-0 z-40 px-3" style={{ bottom: 'calc(68px + env(safe-area-inset-bottom, 0px))' }}>
                <div className="rounded-xl bg-white border border-border-strong shadow-lg p-2 flex items-center gap-2">
                  <div className="flex-1 text-[13.5px] font-bold pl-1">Đã chọn {picked.size}/15 tin</div>
                  <button type="button" onClick={() => { setPickMode(false); setPicked(new Set()); }} className="h-11 px-3 rounded-lg border border-border-strong text-[13.5px] font-bold">Hủy</button>
                  <button type="button" disabled={picked.size === 0} onClick={() => { setBulkJobs((result?.items ?? []).filter((j) => picked.has(j.id)).map((j) => ({ id: j.id, jobPostingId: j.id, createdAt: j.createdAt, jobPosting: j }))); setBulkOpen(true); }} className="h-11 px-4 rounded-lg bg-accent text-white text-[14px] font-extrabold disabled:opacity-50">⚡ Nộp {picked.size} tin</button>
                </div>
              </div>
            )}
            {bulkOpen && token && (
              <BulkApplyModal
                token={token}
                savedJobs={bulkJobs}
                appliedJobIds={appliedIds}
                onClose={() => { setBulkOpen(false); setPickMode(false); setPicked(new Set()); }}
                onApplied={() => undefined}
              />
            )}

            {lastHidden && (
              <div className="fixed left-1/2 -translate-x-1/2 z-50 rounded-full bg-ink text-white text-[13px] font-bold pl-4 pr-1.5 py-1.5 shadow-lg flex items-center gap-3" style={{ bottom: 'calc(130px + env(safe-area-inset-bottom, 0px))' }}>
                Đã ẩn 1 tin
                <button type="button" onClick={undoHide} className="rounded-full bg-white/20 px-3 h-8">Hoàn tác</button>
              </div>
            )}

            {/* Đợt 28 — banner cuối danh sách kết quả. */}
            <AdSlot slot="jobs-bottom" className="mt-3" />

            {result && result.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                {/* Đợt 13 (24/09/2026) — thêm nút "Đầu tiên"/"Cuối cùng" để nhảy nhanh 2 đầu danh
                    sách phân trang, theo yêu cầu người dùng. */}
                <button
                  disabled={page <= 1}
                  onClick={() => goToPage(1)}
                  className="tvl-btn-ghost !w-auto px-4 py-1.5 text-xs disabled:text-ink-faint disabled:bg-white"
                >
                  Đầu tiên
                </button>
                <button
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                  className="tvl-btn-ghost !w-auto px-4 py-1.5 text-xs disabled:text-ink-faint disabled:bg-white"
                >
                  ← Trước
                </button>
                <span className="text-xs text-ink-muted px-2 py-1 rounded-lg bg-white">
                  Trang {result.page} / {result.totalPages}
                </span>
                <button
                  disabled={page >= result.totalPages}
                  onClick={() => goToPage(page + 1)}
                  className="tvl-btn-ghost !w-auto px-4 py-1.5 text-xs disabled:text-ink-faint disabled:bg-white"
                >
                  Sau →
                </button>
                <button
                  disabled={page >= result.totalPages}
                  onClick={() => goToPage(result.totalPages)}
                  className="tvl-btn-ghost !w-auto px-4 py-1.5 text-xs disabled:text-ink-faint disabled:bg-white"
                >
                  Cuối cùng
                </button>
              </div>
            )}
          </div>

          {quick && sel ? (
            <div className="hidden lg:block lg:self-stretch">
              <JobQuickView jobId={sel} onClose={() => setSel(null)} />
            </div>
          ) : null}
          <div className={`flex flex-col gap-3.5 lg:self-stretch ${quick && sel ? 'lg:hidden' : ''}`}>
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

export default function JobSearchClient({ initial, initialFacets }: { initial: { key: string; data: JobListResponse } | null; initialFacets: { key: string; data: JobFacets } | null }) {
  return (
    <Suspense fallback={null}>
      <JobSearchPage initial={initial} initialFacets={initialFacets} />
    </Suspense>
  );
}
