'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import OnlineBanner from '@/components/OnlineBanner';
import { JobCard } from '@/components/JobCard';
import { jobsApi, type JobFacets, type JobPosting, type FeaturedEmployer } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PINNED_PROVINCES } from '@/lib/catalogs';
import { CompanyLogo } from '@/components/CompanyLogo';

export default function Home() {
  const router = useRouter();
  const { me } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [jobs, setJobs] = useState<JobPosting[] | null>(null);
  const [facets, setFacets] = useState<JobFacets | null>(null);
  const [featured, setFeatured] = useState<FeaturedEmployer[] | null>(null);
  // Đợt 12r (21/09/2026) — "Ngành nghề nổi bật" trước đây liệt kê HẾT mọi ngành (facets.industries
  // không giới hạn số lượng ở backend), tạo danh sách rất dài trên trang chủ. Nay chỉ hiện 6 mục đầu
  // (≈2 dòng ở màn hình rộng, khớp cách "Doanh nghiệp yêu thích" đang hiển thị) kèm nút "Xem tất cả"
  // để mở rộng xem hết — không có trang riêng liệt kê toàn bộ ngành nên dùng toggle mở/thu gọn tại chỗ
  // thay vì điều hướng sang trang khác.
  const [showAllIndustries, setShowAllIndustries] = useState(false);
  const HOME_SECTION_PREVIEW_COUNT = 6;

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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
        <div className="grid md:grid-cols-2 gap-5 items-stretch">
          <div className="rounded-2xl border border-border bg-white p-7 flex flex-col gap-4 justify-center">
            <div className="text-xs font-bold text-primary uppercase tracking-wide">
              {facets ? `${facets.total.toLocaleString('vi-VN')} việc làm đang tuyển hôm nay` : 'Đang tải...'}
            </div>
            <h1 className="text-2xl sm:text-[26px] font-extrabold leading-snug text-balance">
              Tìm đúng việc,
              <br />
              ứng tuyển nhanh trong 3 bước
            </h1>
            <form onSubmit={handleSearch} className="flex flex-col gap-3">
              <input
                className="tvl-input"
                placeholder="Chức danh, kỹ năng hoặc tên công ty..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <div className="flex gap-3 flex-wrap">
                <button type="submit" className="tvl-btn-accent !w-auto px-6">
                  Tìm Việc Ngay
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/viec-lam')}
                  className="tvl-btn-ghost !w-auto px-5"
                >
                  Tìm kiếm nâng cao
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[11.5px]">
                <span className="text-ink-faint">Nổi bật:</span>
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
                  Việc làm khẩn cấp
                </button>
              </div>
            </form>
            {!me && (
              <div className="rounded-xl bg-primary-tint p-3.5 flex items-center gap-3">
                <span className="text-lg">👋</span>
                <div className="flex-1">
                  <div className="text-xs font-bold text-primary">Chưa có tài khoản?</div>
                  <div className="text-[11.5px] text-ink-muted">
                    Đăng ký để lưu việc làm yêu thích và ứng tuyển nhanh hơn
                  </div>
                </div>
                <a href="/dang-nhap" className="tvl-btn-primary !w-auto px-4 py-2 text-xs">
                  Đăng ký
                </a>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-primary min-h-[220px] flex items-center justify-center p-6 relative overflow-hidden">
            <svg width="86%" height="82%" viewBox="0 0 300 220" fill="none">
              <rect x="18" y="120" width="80" height="70" rx="6" fill="rgba(255,255,255,.12)" />
              <circle cx="150" cy="90" r="30" fill="rgba(255,255,255,.16)" />
              <rect x="118" y="128" width="64" height="60" rx="10" fill="rgba(255,255,255,.16)" />
              <rect x="190" y="60" width="94" height="120" rx="10" fill="rgba(255,255,255,.10)" />
              <rect x="205" y="76" width="64" height="10" rx="3" fill="rgba(255,255,255,.4)" />
              <rect x="205" y="94" width="44" height="8" rx="3" fill="rgba(255,255,255,.25)" />
              <rect x="205" y="118" width="64" height="34" rx="6" fill="rgba(255,90,54,.85)" />
              <text x="237" y="139" fill="#fff" fontSize="10" fontWeight="700" textAnchor="middle">
                Đã ứng tuyển
              </text>
            </svg>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            ['2,4tr+', 'Thành viên'],
            ['9.600+', 'Doanh nghiệp sử dụng'],
            [facets ? facets.total.toLocaleString('vi-VN') : '—', 'Việc làm đang tuyển'],
            ['18.200', 'Hồ sơ cập nhật / ngày'],
          ].map(([val, lbl]) => (
            <div key={lbl} className="rounded-xl border border-border bg-white p-4 text-center">
              <div className="font-mono font-extrabold text-lg tabular-nums">{val}</div>
              <div className="text-[11px] text-ink-muted mt-0.5">{lbl}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-9 mb-3">
          <h2 className="font-extrabold text-lg">Việc làm mới nhất</h2>
          <a href="/viec-lam" className="text-primary text-xs font-bold">
            Xem thêm →
          </a>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {jobs === null && <div className="text-ink-faint text-sm py-8">Đang tải việc làm...</div>}
          {jobs?.length === 0 && <div className="text-ink-faint text-sm py-8">Chưa có tin tuyển dụng nào.</div>}
          {jobs?.map((job) => <JobCard key={job.id} job={job} />)}
        </div>

        {facets && facets.industries.length > 0 && (
          <>
            <div className="flex items-center justify-between mt-9 mb-3">
              <h2 className="font-extrabold text-lg">Ngành nghề nổi bật</h2>
              {facets.industries.length > HOME_SECTION_PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setShowAllIndustries((v) => !v)}
                  className="text-primary text-xs font-bold"
                >
                  {showAllIndustries ? 'Thu gọn ↑' : 'Xem tất cả →'}
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

        {featured && featured.length > 0 && (
          <>
            <div className="flex items-center justify-between mt-9 mb-3">
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

        <div className="mt-10 pt-4 border-t border-border text-[11.3px] text-ink-faint flex flex-wrap justify-between gap-2">
          <span>© 2026 Tuyển Dụng Việc Làm · tuyendungvieclam.vn</span>
          <span>Về chúng tôi · Điều khoản · Bảo mật · Liên hệ</span>
        </div>
      </div>
    </main>
  );
}
