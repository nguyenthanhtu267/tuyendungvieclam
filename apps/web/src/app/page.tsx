'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseNaturalQuery, nlToParams } from '@/lib/nl-search';
import AskAnswerBox from '@/components/AskAnswerBox';
import { RefreshReminder } from '@/components/labor/RefreshReminder';
import SiteHeader from '@/components/SiteHeader';
import OnlineBanner from '@/components/OnlineBanner';
import { JobCard } from '@/components/JobCard';
import { RecommendedJobs } from '@/components/RecommendedJobs';
import ContinueBlock from '@/components/ContinueBlock';
import { jobsApi, type JobFacets, type JobPosting, type FeaturedEmployer, type HomepageStats } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { CompanyLogo } from '@/components/CompanyLogo';
import { formatNumber } from '@/lib/format';
import { useLanguage } from '@/lib/i18n';
import { MarketPanel } from '@/components/market/MarketPanel';
import { memberCountDisplay, profilesUpdatedTodayDisplay, applicationsTodayDisplay } from '@/lib/vanity-stats';
import { AdSlot } from '@/components/ads/AdSlot';
import { VoiceSearchButton } from '@/components/VoiceSearchButton';
import { FitText } from '@/components/FitText';

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
    const params = nlToParams(parseNaturalQuery(keyword).filters);
    router.push(`/viec-lam${params.toString() ? `?${params}` : ''}`);
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <OnlineBanner />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-1.5 pb-3">
        {/* Đợt 80 — nhắc người lao động làm mới thông tin (chỉ hiện khi máy này từng đăng ký và quá 7 ngày) */}
        <div className="empty:hidden mb-1.5"><RefreshReminder /></div>
        <div className="grid md:grid-cols-2 gap-2 items-stretch">
          <div className="rounded-2xl border border-border bg-white px-6 py-3 flex flex-col gap-2 justify-center">
            <div className="text-xs font-bold text-primary uppercase tracking-wide">
              {facets ? `${formatNumber(facets.total)} ${t('home.eyebrowJobsToday')}` : t('home.eyebrowLoading')}
            </div>
            <h1 className="text-2xl sm:text-[26px] font-extrabold leading-snug text-balance">
              {t('home.heading1')}
              <br />
              {t('home.heading2')}
            </h1>
            <form onSubmit={handleSearch} className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  className="tvl-input"
                  placeholder={t('home.searchPlaceholder')}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
                <VoiceSearchButton
                  onText={(text) => {
                    setKeyword(text);
                    const params = nlToParams(parseNaturalQuery(text).filters);
                    router.push(`/viec-lam${params.toString() ? `?${params}` : ''}`);
                  }}
                />
              </div>
              <AskAnswerBox text={keyword} />
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
                {['Hà Nội', 'Bắc Ninh', 'Đà Nẵng', 'Hồ Chí Minh'].map((p) => (
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
                <button
                  type="button"
                  onClick={() => router.push('/viec-lam?salaryTier=50')}
                  title="Việc làm lương từ 50 triệu trở lên"
                  className="font-semibold px-2.5 py-1 rounded-full border border-[#C99A00] bg-[#FFD84D] text-[#5A3A00] hover:brightness-95 transition-colors"
                >
                  ★ Cao cấp
                </button>
              </div>
              {/* Đợt 79 — 3 lối vào kênh lao động phổ thông (không bắt buộc đăng nhập) */}
              <div className="grid grid-cols-2 sm:grid-cols-[1.9fr_1fr_1fr] gap-1.5">
                <a
                  href="/lao-dong-pho-thong?loai=cong-nhan"
                  className="col-span-2 sm:col-span-1 rounded-lg border-2 border-[#C8102E] bg-[#FFD84D] text-[#C8102E] font-extrabold uppercase text-[14px] sm:text-[15px] text-center px-2 py-2 hover:bg-[#FFCC1A] leading-tight"
                >
                  Dành riêng tuyển công nhân
                </a>
                <a href="/lao-dong-pho-thong?loai=sinh-vien" className="rounded-lg border-2 border-border-strong bg-white text-ink font-extrabold uppercase text-[13px] text-center px-1.5 py-2 hover:border-primary hover:text-primary leading-tight">
                  Sinh viên
                </a>
                <a href="/lao-dong-pho-thong?loai=thuc-tap-sinh" className="rounded-lg border-2 border-border-strong bg-white text-ink font-extrabold uppercase text-[13px] text-center px-1.5 py-2 hover:border-primary hover:text-primary leading-tight">
                  Thực tập sinh
                </a>
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
        <AdSlot slot="home-top" className="mt-1.5" />

        <ContinueBlock />

        <RecommendedJobs />

        <div className="flex items-center justify-between mt-2 mb-1.5">
          <h2 className="font-extrabold text-lg tvl-title">{t('home.latestJobs')}</h2>
          <a href="/viec-lam" className="text-primary text-xs font-bold tvl-title">
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
            <div className="flex items-center justify-between mt-2 mb-1.5">
              <h2 className="font-extrabold text-lg tvl-title">{t('home.topIndustries')}</h2>
              {facets.industries.length > HOME_SECTION_PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setShowAllIndustries((v) => !v)}
                  className="text-primary text-xs font-bold tvl-title"
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
                    <b className="tabular-nums text-ink-faint">{f.count}</b>
                  </a>
                ),
              )}
            </div>
          </>
        )}

        {/* Đợt 24 — banner giữa trang chủ (chỉ máy tính; điện thoại đã có home-top). */}
        <AdSlot slot="home-mid" className="mt-2 hidden lg:block" />

        {featured && featured.length > 0 && (
          <>
            <div className="flex items-center justify-between mt-2 mb-1.5">
              <h2 className="font-extrabold text-lg tvl-title">💛 Doanh nghiệp yêu thích</h2>
              <a href="/viec-lam?featuredEmployerOnly=1" className="text-primary text-xs font-bold tvl-title">
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
                  <CompanyLogo name={c.name} logoUrl={c.logoUrl} size={52} className="text-xs" />
                  <div className="min-w-0">
                    <div className="text-[12.5px]"><FitText lines={1} min={0.7} className="co-name">{c.name}</FitText></div>
                    <div className="text-ink-faint text-[11px]">{c.jobCount} việc làm đang tuyển</div>
                  </div>
                </a>
              ))}
            </div>
          </>
        )}

        {/* Đợt 28 — banner cuối trang chủ. */}
        <AdSlot slot="home-bottom" className="mt-2" />

      </div>
    </main>
  );
}
