'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { JobCard } from '@/components/JobCard';
import { CompanyLogo } from '@/components/CompanyLogo';
import { SourcedBadge, isCompanyUnverified } from '@/components/SourcedBadge';
import { companiesApi, candidatesApi, ApiError, type CompanyProfileResponse } from '@/lib/api';
import { track } from '@/lib/analytics';
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
    track(next ? 'follow_company' : 'unfollow_company', { entityType: 'company', entityId: params.id });
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
              <div className="text-white text-xl font-extrabold flex items-center gap-2 flex-wrap">
                {company.name}
                {isCompanyUnverified(company) && <SourcedBadge />}
              </div>
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

        {/* Đợt 17 (25/09/2026) — "Đây là công ty của bạn?": chỉ hiện khi công ty đang ở trạng thái
            "chưa xác thực" (isAdminSourced && !claimedAt) — công ty tự đăng ký từ đầu hoặc đã claim
            rồi thì không cần nút này. */}
        {isCompanyUnverified(company) && <ClaimCompanySection companyId={company.id} />}

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

// Đợt 17 (25/09/2026) — "Đây là công ty của bạn?": form công khai, không cần đăng nhập (công ty thật
// chưa có tài khoản để đăng nhập vào lúc này — xem ghi chú ở company-claim-request.entity.ts). Admin
// xác minh thông tin NGOÀI hệ thống rồi mới duyệt/chuyển giao ở tab "Nguồn ngoài".
function ClaimCompanySection({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    setError('');
    try {
      await companiesApi.submitClaimRequest(companyId, {
        requesterName: name.trim(),
        requesterEmail: email.trim(),
        requesterPhone: phone.trim() || undefined,
        note: note.trim() || undefined,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gửi được yêu cầu, vui lòng thử lại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-warning/30 bg-warning-tint p-4">
      <div className="text-[12.5px] text-warning font-semibold">
        Hồ sơ công ty này do đội ngũ tổng hợp từ nguồn khác — nếu bạn là đại diện công ty, hãy gửi yêu cầu để
        &ldquo;nhận lại&rdquo; và tự quản lý tài khoản này.
      </div>
      {sent ? (
        <div className="text-[12.5px] text-ink-muted mt-2">
          ✓ Đã gửi yêu cầu. Đội ngũ sẽ liên hệ xác minh và bàn giao tài khoản trong thời gian sớm nhất.
        </div>
      ) : open ? (
        <form onSubmit={handleSubmit} className="mt-3 grid sm:grid-cols-2 gap-2.5 text-xs max-w-lg">
          <input
            required
            placeholder="Họ tên của bạn *"
            className="tvl-input text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            required
            type="email"
            placeholder="Email liên hệ *"
            className="tvl-input text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            placeholder="Số điện thoại (không bắt buộc)"
            className="tvl-input text-sm sm:col-span-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <textarea
            placeholder="Ghi chú thêm (chức vụ, cách xác minh...)"
            className="tvl-input text-sm sm:col-span-2"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <div className="text-critical font-semibold sm:col-span-2">{error}</div>}
          <button type="submit" disabled={busy} className="tvl-btn-primary !w-auto px-5 sm:col-span-2 self-start">
            Gửi yêu cầu
          </button>
        </form>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-2.5 !w-auto px-4 py-2 rounded-lg text-xs font-bold bg-white text-warning border border-warning/30"
        >
          Đây là công ty của bạn?
        </button>
      )}
    </div>
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
