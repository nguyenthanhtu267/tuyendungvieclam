'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { JobCard } from '@/components/JobCard';
import { jobsApi, type JobFacets, type JobPosting } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const router = useRouter();
  const { me } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [jobs, setJobs] = useState<JobPosting[] | null>(null);
  const [facets, setFacets] = useState<JobFacets | null>(null);

  useEffect(() => {
    jobsApi
      .list({ pageSize: 4 })
      .then((res) => setJobs(res.items))
      .catch(() => setJobs([]));
    jobsApi
      .facets()
      .then(setFacets)
      .catch(() => setFacets(null));
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
            <h2 className="font-extrabold text-lg mt-9 mb-3">Ngành nghề nổi bật</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {facets.industries.map((f) => (
                <a
                  key={f.industry}
                  href={`/viec-lam?industry=${encodeURIComponent(f.industry)}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-white px-3.5 py-2.5 text-[12.5px] font-semibold hover:border-primary transition-colors"
                >
                  <span>{f.industry}</span>
                  <b className="font-mono tabular-nums text-ink-faint">{f.count}</b>
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
