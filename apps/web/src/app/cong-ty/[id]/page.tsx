'use client';

import { AdStack } from '@/components/ads/AdStack';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from '@/components/SmartLink';
import SiteHeader from '@/components/SiteHeader';
import CompanyOverview from '@/components/CompanyOverview';
import { isCompanyUnverified } from '@/components/SourcedBadge';
import { companiesApi, candidatesApi, ApiError, type CompanyProfileResponse } from '@/lib/api';
import { track } from '@/lib/analytics';
import { useAuth } from '@/lib/auth-context';
import { AdSlot } from '@/components/ads/AdSlot';
import { SimilarCompanies } from '@/components/SimilarCompanies';

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
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-ink-faint text-sm">Đang tải...</div>
      </main>
    );
  }

  if (data === null) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <div className="text-ink-muted text-sm mb-3">Không tìm thấy công ty này.</div>
          <Link href="/viec-lam" className="text-primary font-semibold text-sm">
            ← Quay lại tìm việc làm
          </Link>
        </div>
      </main>
    );
  }

  const { company, jobs } = data;

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-4 pb-6">
        <div className="text-[11.5px] text-ink-muted mb-3 inline-block rounded-lg bg-white px-3 py-1.5">
          <Link href="/viec-lam" className="hover:text-primary">
            Tìm việc làm
          </Link>
          {' / '}
          <span className="co-name text-[12px]">{company.name}</span>
        </div>

        {/* Đợt 17 (25/09/2026) — "Đây là công ty của bạn?": chỉ hiện khi công ty đang ở trạng thái
            "chưa xác thực" (isAdminSourced && !claimedAt). */}
        {isCompanyUnverified(company) && <ClaimCompanySection companyId={company.id} />}

        {/* Đợt 49 — bố cục theo mẫu "Tổng quan công ty" (components/CompanyOverview.tsx), dùng chung với tab ở trang tin. */}
        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_300px] gap-5 mt-3 items-start">
          <div className="rounded-xl border border-border bg-white p-4 sm:p-5 min-w-0">
            <CompanyOverview
              company={company}
              jobs={jobs}
              canFollow={me?.role === 'candidate'}
              following={following}
              followBusy={followBusy}
              onToggleFollow={toggleFollow}
              maxJobs={100}
            />
          </div>
          <div className="flex flex-col gap-3.5 lg:self-stretch">
            <SimilarCompanies companyId={company.id} />
            <AdStack>
              <AdSlot slot="company-sidebar" />
            </AdStack>
          </div>
        </div>
        {/* Đợt 24 — banner cuối trang công ty. */}
        <AdSlot slot="company-bottom" className="mt-4" />
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

