'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { JobCard } from '@/components/JobCard';
import { CompanyLogo } from '@/components/CompanyLogo';
import { companiesApi, candidatesApi, ApiError, type CompanyProfileResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatNumber } from '@/lib/format';

// Đợt 12k (21/09/2026) — trang công ty công khai: bấm tên công ty trong tin tuyển dụng sẽ tới đây,
// xem thông tin công ty + toàn bộ tin đang tuyển khác của công ty đó (theo mẫu careerviet.vn).
// Đợt 12ab (24/09/2026) — thêm logo, nút "+ Theo dõi" (CompanyFollow) + số lượt theo dõi công khai.
export default function CongTyPage() {
  const params = useParams<{ id: string }>();
  const { me, token } = useAuth();
  const [data, setData] = useState<CompanyProfileResponse | null | undefined>(undefined);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    companiesApi
      .getProfile(params.id)
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setData(null);
        else setData(null);
      });
  }, [params.id]);

  useEffect(() => {
    if (!token || me?.role !== 'candidate') return;
    candidatesApi
      .listFollowedCompanies(token)
      .then((rows) => setFollowing(rows.some((r) => r.companyId === params.id)))
      .catch(() => {});
  }, [token, me, params.id]);

  const toggleFollow = useCallback(async () => {
    if (!token) return;
    setFollowBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      if (next) await candidatesApi.followCompany(token, params.id);
      else await candidatesApi.unfollowCompany(token, params.id);
      setData((d) =>
        d ? { ...d, company: { ...d.company, followersCount: (d.company.followersCount ?? 0) + (next ? 1 : -1) } } : d,
      );
    } catch {
      setFollowing(!next);
    } finally {
      setFollowBusy(false);
    }
  }, [token, following, params.id]);

  if (data === undefined) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="max-w-6xl mx-auto px-4 py-16 text-center text-ink-faint text-sm">Đang tải...</div>
      </main>
    );
  }

  if (data === null) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <div className="text-ink-muted text-sm mb-3">Không tìm thấy công ty này.</div>
          <Link href="/viec-lam" className="text-primary font-semibold text-sm">
            ← Quay lại tìm việc làm
          </Link>
        </div>
      </main>
    );
  }

  const { company, jobs, totalJobs } = data;

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6">
        <div className="text-[11.5px] text-ink-faint mb-3">
          <Link href="/viec-lam" className="hover:text-primary">
            Tìm việc làm
          </Link>
          {' / '}
          <span className="text-ink-muted font-semibold">{company.name}</span>
        </div>

        <div className="rounded-2xl bg-primary p-6 flex items-center gap-4 flex-wrap justify-between">
          <div className="flex items-center gap-4">
            <CompanyLogo name={company.name} logoUrl={company.logoUrl} size={64} variant="light" className="text-lg" />
            <div>
              <div className="text-white text-xl font-extrabold">{company.name}</div>
              <div className="text-white/75 text-[13px] mt-1">
                {formatNumber(totalJobs)} tin đang tuyển{company.industry ? ` · ${company.industry}` : ''}
                {' · '}
                {formatNumber(company.followersCount ?? 0)} người theo dõi
              </div>
            </div>
          </div>
          {me?.role === 'candidate' && (
            <button
              onClick={toggleFollow}
              disabled={followBusy}
              className={`!w-auto px-5 py-2 rounded-lg text-sm font-bold shrink-0 disabled:opacity-60 ${
                following ? 'bg-white/15 text-white' : 'bg-white text-primary'
              }`}
            >
              {following ? '✓ Đang theo dõi' : '+ Theo dõi'}
            </button>
          )}
        </div>

        <div className="grid lg:grid-cols-[1fr_280px] gap-5 mt-5 items-start">
          <div>
            <h2 className="font-extrabold text-lg mb-3">
              {totalJobs > 0 ? `${formatNumber(totalJobs)} việc làm đang tuyển tại ${company.name}` : 'Chưa có tin đang tuyển'}
            </h2>

            {jobs.length === 0 && (
              <div className="rounded-xl border border-border bg-white p-8 text-center text-ink-muted text-sm">
                Công ty này hiện chưa có tin tuyển dụng nào đang hiển thị.
              </div>
            )}

            <div className="flex flex-col gap-3">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            <div className="rounded-xl border border-border bg-white p-4">
              <div className="text-[11px] font-bold text-primary uppercase tracking-wide mb-2.5">
                Thông tin công ty
              </div>
              <div className="flex flex-col gap-2 text-[12.5px] text-ink-muted">
                <div>Mã số thuế: {company.taxCode}</div>
                {company.industry && <div>Lĩnh vực: {company.industry}</div>}
                {company.size && <div>Quy mô: {company.size}</div>}
                {company.website && <div>Website: {company.website}</div>}
              </div>
            </div>
            {/* Đợt 12ac (24/09/2026) — "Giới thiệu công ty", mở rộng/thu gọn khi dài. */}
            {company.description && (
              <div className="rounded-xl border border-border bg-white p-4">
                <div className="text-[11px] font-bold text-primary uppercase tracking-wide mb-2.5">
                  Giới thiệu công ty
                </div>
                <CompanyDescription text={company.description} />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// Đợt 12ac (24/09/2026) — "Giới thiệu công ty" mở rộng/thu gọn khi dài, theo mẫu careerviet.vn.
const COMPANY_DESCRIPTION_COLLAPSED_LENGTH = 260;

function CompanyDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > COMPANY_DESCRIPTION_COLLAPSED_LENGTH;
  const shown = expanded || !isLong ? text : `${text.slice(0, COMPANY_DESCRIPTION_COLLAPSED_LENGTH).trim()}…`;
  return (
    <div className="text-[12.5px] text-ink-muted">
      <p className="whitespace-pre-line leading-relaxed">{shown}</p>
      {isLong && (
        <button onClick={() => setExpanded((v) => !v)} className="text-primary font-semibold text-xs mt-1 hover:underline">
          {expanded ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </div>
  );
}
