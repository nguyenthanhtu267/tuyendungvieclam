'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import OnlineBanner from '@/components/OnlineBanner';
import { JobCard } from '@/components/JobCard';
import { jobsApi, type JobFacets, type JobPosting, type FeaturedEmployer, type HomepageStats } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PINNED_PROVINCES } from '@/lib/catalogs';
import { CompanyLogo } from '@/components/CompanyLogo';
import { formatNumber } from '@/lib/format';
import { useLanguage } from '@/lib/i18n';
import { MarketPanel } from '@/components/market/MarketPanel';
import { memberCountDisplay, profilesUpdatedTodayDisplay, applicationsTodayDisplay } from '@/lib/vanity-stats';
import { AdSlot } from '@/components/ads/AdSlot';

export default function Home() {
  const router = useRouter();
  const { me } = useAuth();
  const { t } = useLanguage();
  const [keyword, setKeyword] = useState('');
  const [jobs, setJobs] = useState<JobPosting[] | null>(null);
  const [facets, setFacets] = useState<JobFacets | null>(null);
  const [featured, setFeatured] = useState<FeaturedEmployer[] | null>(null);
  // Đợt 13 (24/09/2026) — "Thống kê trang chủ" thật, thay 3/4 số ảo hard-code trước đó (mục 7 danh
  // sách lỗi). Theo lựa chọn của người dùng: hiện đúng số thật, không đặt ngưỡng/làm tròn giả.
  const [stats, setStats] = useState<HomepageStats | null>(null);
  // Đợt 12r (21/09/2026) — "Ngành nghề nổi bật" trước đây liệt kê HẾT mọi ngành (facets.industries
  // không giới hạn số lượng ở backend), tạo danh sách rất dài trên trang chủ. Nay chỉ hiện 6 mục đầu
  // (≈2 dòng ở màn hình rộng, khớp cách "Doanh nghiệp yêu thích" đang hiển thị) kèm nút "Xem tất cả"
  // để mở rộng xem hết — không có trang riêng liệt kê toàn bộ ngành nên dùng toggle mở/thu gọn tại chỗ
  // thay vì điều hướng sang trang khác.
  const [showAllIndustries, setShowAllIndustries] = useState(false);
  const HOME_SECTION_PREVIEW_COUNT = 6;

  // Đợt 14 (25/09/2026) — mục 14 danh sách lỗi: người dùng đổi ý so với Đợt 13, muốn 3/5 thẻ LUÔN
  // hiện trên 1 ngưỡng tối thiểu, tăng nhẹ dần theo ngày (xem lib/vanity-stats.ts để biết lý do và
  // cách tính chi tiết — chỉ là lớp hiển thị, API vẫn trả số thật 100%). 2 thẻ còn lại (Doanh
  // nghiệp sử dụng, Việc làm đang tuyển) giữ nguyên số thật như quyết định cũ. Tính 1 lần ở đây để
  // dùng chung cho cả khối "mini dashboard" ở hero (mục 5) lẫn 5 thẻ số liệu bên dưới, tránh 2 nơi
  // hiện 2 con số lệch nhau.
  const displayMemberCount = stats ? memberCountDisplay(stats.memberCount) : null;
  const displayProfilesUpdatedToday = stats ? profilesUpdatedTodayDisplay(stats.profilesUpdatedToday) : null;
  const displayApplicationsToday = stats ? applicationsTodayDisplay(stats.applicationsToday) : null;

  // Đợt 16 (25/09/2026) — mục 21 danh sách lỗi: khối "Tin mới nhất" (trong "Hoạt động trực tuyến")
  // trước đây hiện thời gian THẬT (formatRelativeTime) nên có thể ra "2 ngày trước" nếu lâu rồi
  // không có tin mới hơn — theo yêu cầu người dùng, đổi sang số phút "hoa mỹ" ngẫu nhiên trong
  // khoảng 1-15 phút trước (không phản ánh thời gian thật) để luôn tạo cảm giác web đang hoạt động
  // liên tục. Người dùng chọn "cố định khi tải trang" (không tự làm mới liên tục) — tính 1 lần bằng
  // useMemo, chỉ tính lại khi danh sách `jobs` thay đổi (tức là mỗi lần tải/làm mới trang), không
  // đổi lại giữa các lần re-render khác của component.
  const recentJobsMinutesAgo = useMemo(
    () => (jobs ?? []).slice(0, 4).map(() => Math.floor(Math.random() * 15) + 1),
    [jobs],
  );

  useEffect(() => {
    jobsApi
      .list({ pageSize: 4 })
      .then((res) => setJobs(res.items))
      .catch(() => setJobs([]));
    jobsApi
      .facets()
      .then(setFacets)
      .catch(() => setFacets(null));
    jobsApi
      .featuredEmployers()
      .then(setFeatured)
      .catch(() => setFeatured([]));
    jobsApi
      .homepageStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('q', keyword.trim());
    router.push(`/viec-lam${params.toString() ? `?${params}` : ''}`);
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <OnlineBanner />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-4 pb-6">
        <div className="grid md:grid-cols-2 gap-3 items-stretch">
          <div className="rounded-2xl border border-border bg-white p-7 flex flex-col gap-4 justify-center">
            <div className="text-xs font-bold text-primary uppercase tracking-wide">
              {facets ? `${formatNumber(facets.total)} ${t('home.eyebrowJobsToday')}` : t('home.eyebrowLoading')}
            </div>
            <h1 className="text-2xl sm:text-[26px] font-extrabold leading-snug text-balance">
              {t('home.heading1')}
              <br />
              {t('home.heading2')}
            </h1>
            <form onSubmit={handleSearch} className="flex flex-col gap-3">
              <input
                className="tvl-input"
                placeholder={t('home.searchPlaceholder')}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <div className="flex gap-3 flex-wrap">
                <button type="submit" className="tvl-btn-accent !w-auto px-6">
                  {t('home.searchButton')}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/viec-lam')}
                  className="tvl-btn-ghost !w-auto px-5"
                >
                  {t('home.advancedSearch')}
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[11.5px]">
                <span className="text-ink-faint">{t('home.featured')}</span>
                {PINNED_PROVINCES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => router.push(`/viec-lam?provinces=${encodeURIComponent(p)}`)}
                    className="font-semibold px-2.5 py-1 rounded-full border border-border-strong text-ink-muted hover:border-primary hover:text-primary transition-colors"
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => router.push('/viec-lam?urgentOnly=1')}
                  className="font-semibold px-2.5 py-1 rounded-full border border-critical/40 text-critical hover:border-critical transition-colors"
                >
                  {t('home.urgentJobs')}
                </button>
              </div>
            </form>
            {!me && (
              <div className="rounded-xl bg-primary-tint p-3.5 flex items-center gap-3">
                <span className="text-lg">👋</span>
                <div className="flex-1">
                  <div className="text-xs font-bold text-primary">{t('home.noAccount')}</div>
                  <div className="text-[11.5px] text-ink-muted">
                    {t('home.noAccountDesc')}
                  </div>
                </div>
                <a href="/dang-nhap" className="tvl-btn-primary !w-auto px-4 py-2 text-xs">
                  {t('home.register')}
                </a>
              </div>
            )}
          </div>

          {/* Đợt 14 (25/09/2026) — mục 5 danh sách lỗi: khối minh hoạ SVG tĩnh (vài hình khối trừu
              tượng, không số liệu thật nào) đổi thành 1 "mini dashboard" thật — vài số liệu chính
              + "Tin mới nhất" lấy từ danh sách việc làm mới nhất đã fetch sẵn (jobs) — cho cảm giác
              sống động, đúng nghĩa "dashboard" hơn là hình minh hoạ tĩnh trước đây. Lựa chọn người
              dùng qua AskUserQuestion: "Mini dashboard số liệu thật + hoạt động gần đây".
              Đợt 15 (25/09/2026) — mục 16 danh sách lỗi: gộp thêm "Thành viên" + "Doanh nghiệp sử
              dụng" (trước đây chỉ nằm ở lưới 5 thẻ riêng bên dưới trang) vào khối này cho đủ cả 5 số
              liệu, rồi BỎ HẲN lưới 5 thẻ riêng — theo yêu cầu người dùng: "dữ liệu vào mục hoạt động
              trực tuyến luôn và không hiển thị dòng này nữa vì hiển thị tốt hơn" (tránh lặp số liệu
              2 nơi trên cùng 1 trang). Bố cục 2 hàng (3 số quan trọng nhất hàng trên, 2 số còn lại
              hàng dưới) thay vì 1 hàng 5 cột để không bị chật trong khối hero nhỏ cạnh ô tìm kiếm. */}
          {/* Đợt 27 — "Bảng thị trường việc làm" (nền vector chuyển đổi số + số liệu + biểu đồ), thay khối mini dashboard cũ. */}
          <MarketPanel
            openJobs={facets ? facets.total : null}
            applicationsToday={displayApplicationsToday}
            profilesToday={displayProfilesUpdatedToday}
            members={displayMemberCount}
            companies={stats ? stats.companyCount : null}
            industries={facets?.industries ?? []}
            locations={facets?.locations ?? []}
            jobs={jobs}
            minutesAgo={recentJobsMinutesAgo}
          />
        </div>

        {/* Đợt 24 — banner quảng cáo (vùng home-top). */}
        <AdSlot slot="home-top" className="mt-3" />

        <div className="flex items-center justify-between mt-5 mb-2.5">
          <h2 className="font-extrabold text-lg">{t('home.latestJobs')}</h2>
          <a href="/viec-lam" className="text-primary text-xs font-bold">
            {t('home.seeMore')}
          </a>
        </div>
        {/* Đợt 21 — thêm "grid-cols-1" tường minh (cùng lỗi tràn ngang mobile như trang chi tiết tin,
            xem viec-lam/[id]/page.tsx). */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {jobs === null && <div className="text-ink-faint text-sm py-8">{t('home.loadingJobs')}</div>}
          {jobs?.length === 0 && <div className="text-ink-faint text-sm py-8">{t('home.noJobs')}</div>}
          {jobs?.map((job) => <JobCard key={job.id} job={job} />)}
        </div>

        {facets && facets.industries.length > 0 && (
          <>
            <div className="flex items-center justify-between mt-5 mb-2.5">
              <h2 className="font-extrabold text-lg">{t('home.topIndustries')}</h2>
              {facets.industries.length > HOME_SECTION_PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setShowAllIndustries((v) => !v)}
                  className="text-primary text-xs font-bold"
                >
                  {showAllIndustries ? t('home.collapse') : t('home.showAll')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {(showAllIndustries ? facets.industries : facets.industries.slice(0, HOME_SECTION_PREVIEW_COUNT)).map(
                (f) => (
                  <a
                    key={f.industry}
                    href={`/viec-lam?industries=${encodeURIComponent(f.industry)}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-white px-3.5 py-2.5 text-[12.5px] font-semibold hover:border-primary transition-colors"
                  >
                    <span>{f.industry}</span>
                    <b className="font-mono tabular-nums text-ink-faint">{f.count}</b>
                  </a>
                ),
              )}
            </div>
          </>
        )}

        {/* Đợt 24 — banner giữa trang chủ (chỉ máy tính; điện thoại đã có home-top). */}
        <AdSlot slot="home-mid" className="mt-5 hidden lg:block" />

        {featured && featured.length > 0 && (
          <>
            <div className="flex items-center justify-between mt-5 mb-2.5">
              <h2 className="font-extrabold text-lg">💛 Doanh nghiệp yêu thích</h2>
              <a href="/viec-lam?featuredEmployerOnly=1" className="text-primary text-xs font-bold">
                Xem tất cả →
              </a>
            </div>
            {/* Đợt 12r — giới hạn 6 mục (≈2 dòng) trên trang chủ, đề phòng số Doanh nghiệp yêu thích
                tăng lên sau này (đã có công cụ bật/tắt ở Admin Console từ Batch 5) khiến danh sách dài
                ra. "Xem tất cả →" đã sẵn dẫn sang trang việc làm lọc theo NTD nổi bật — đủ để xem hết. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {featured.slice(0, HOME_SECTION_PREVIEW_COUNT).map((c) => (
                <a
                  key={c.id}
                  href={`/viec-lam?q=${encodeURIComponent(c.name)}`}
                  className="rounded-xl border border-border bg-white p-4 flex items-center gap-3 hover:border-primary hover:shadow-sm transition-all"
                >
                  <CompanyLogo name={c.name} logoUrl={c.logoUrl} size={40} className="text-xs" />
                  <div className="min-w-0">
                    <div className="font-bold text-[12.5px] truncate">{c.name}</div>
                    <div className="text-ink-faint text-[11px]">{c.jobCount} việc làm đang tuyển</div>
                  </div>
                </a>
              ))}
            </div>
          </>
        )}

        <div className="mt-6 pt-3 border-t border-border text-[11.3px] text-ink-faint flex flex-wrap justify-between gap-2">
          <span>© 2026 Tuyển Dụng Việc Làm · tuyendungvieclam</span>
          <span>Về chúng tôi · Điều khoản · Bảo mật · Liên hệ</span>
        </div>
      </div>
    </main>
  );
}
