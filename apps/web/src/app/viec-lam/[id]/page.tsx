'use client';

import { PopularKeywords } from '@/components/PopularKeywords';
import { AdStack } from '@/components/ads/AdStack';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { JobCard } from '@/components/JobCard';
import CompanyOverview from '@/components/CompanyOverview';
import { RichTextView } from '@/components/RichTextView';
import { CompanyLogo } from '@/components/CompanyLogo';
import { SourcedBadge, isCompanyUnverified } from '@/components/SourcedBadge';
import { CompatibilityRadar } from '@/components/CompatibilityRadar';
import { GuestApplyForm } from '@/components/GuestApplyForm';
import { CompatibilityChecklist } from '@/components/CompatibilityChecklist';
import {
  jobsApi,
  candidatesApi,
  applicationsApi,
  companiesApi,
  ApiError,
  type JobPosting,
  type CV,
  type CompatibilityResult,
  type CompanyProfileResponse,
} from '@/lib/api';
import { track } from '@/lib/analytics';
import { useAuth } from '@/lib/auth-context';
import {
  formatDate,
  formatSalary,
  formatSalaryTag,
  jobAddressDisplay,
  jobAgeRangeDisplay,
  jobGenderDisplay,
  jobWorkScheduleDisplay,
} from '@/lib/format';
import { benefitsRichTextValue } from '@/lib/richtext';
import { useSalaryEstimate, fmtTrieu } from '@/components/JobInsights';
import { draftCoverLetter } from '@/lib/job-insights';
import { distanceLabel, useHomePlace } from '@/lib/geo';
import { AdSlot } from '@/components/ads/AdSlot';
import { pushRecentJob } from '@/lib/recent-jobs';
import { FitText } from '@/components/FitText';

type Tab = 'details' | 'company';

function JobDetailInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const [job, setJob] = useState<JobPosting | null | undefined>(undefined);
  const [related, setRelated] = useState<JobPosting[]>([]);
  const [tab, setTab] = useState<Tab>('details');
  const [saved, setSaved] = useState(false);
  const autoApplyTriggered = useRef(false);

  const [applyOpen, setApplyOpen] = useState(false);
  const [cvs, setCvs] = useState<CV[] | null>(null);
  const [selectedCvId, setSelectedCvId] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [applyState, setApplyState] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [applyError, setApplyError] = useState<string | null>(null);
  // Đợt 21 (27/09/2026) — 2 cách chia sẻ hồ sơ khi ứng tuyển: chọn 1 CV file/link có sẵn, HOẶC dùng
  // thẳng "Hồ sơ trực tuyến" đã điền (không cần file) nếu đã đủ 3 mục bắt buộc (100%).
  const [onlineProfilePercent, setOnlineProfilePercent] = useState<number | null>(null);
  const [useOnlineProfile, setUseOnlineProfile] = useState(false);
  const onlineProfileAvailable = (onlineProfilePercent ?? 0) >= 100;

  // Đợt 12ab (24/09/2026) — "Theo dõi công ty" (nút trước đó chỉ là UI tĩnh) + "Đánh giá mức độ
  // tương thích" (radar chart), chỉ ứng viên đã đăng nhập mới thấy/dùng được.
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [compatibility, setCompatibility] = useState<CompatibilityResult | null | undefined>(undefined);
  // Đợt 12ac (24/09/2026) — tab "Tổng quan công ty": giới thiệu công ty + số lượt theo dõi + danh
  // sách tin đang tuyển khác ngay trong tab (trước đó chỉ có 1 link "Xem tất cả…"). Tải lười (chỉ khi
  // mở tab) vì đa số người xem không bấm sang tab này.
  const salaryEst = useSalaryEstimate(job);
  const home = useHomePlace();
  const [companyOverview, setCompanyOverview] = useState<CompanyProfileResponse | null | undefined>(undefined);

  useEffect(() => {
    jobsApi
      .get(params.id)
      .then((res) => {
        setJob(res.job);
        pushRecentJob({ id: res.job.id, title: res.job.title, company: res.job.company?.name ?? '' });
        setRelated(res.related);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setJob(null);
        else setJob(null);
      });
  }, [params.id]);

  useEffect(() => {
    if (!token) return;
    candidatesApi
      .listSavedJobs(token)
      .then((rows) => setSaved(rows.some((r) => r.jobPostingId === params.id)))
      .catch(() => {});
  }, [token, params.id]);

  useEffect(() => {
    if (!token || !job || me?.role !== 'candidate') return;
    candidatesApi
      .listFollowedCompanies(token)
      .then((rows) => setFollowing(rows.some((r) => r.companyId === job.company.id)))
      .catch(() => {});
  }, [token, job, me]);

  useEffect(() => {
    if (!token || me?.role !== 'candidate') {
      setCompatibility(null);
      return;
    }
    jobsApi
      .getCompatibility(token, params.id)
      .then(setCompatibility)
      .catch(() => setCompatibility(null));
  }, [token, me, params.id]);

  useEffect(() => {
    if (tab !== 'company' || !job || companyOverview !== undefined) return;
    companiesApi
      .getProfile(job.company.id)
      .then(setCompanyOverview)
      .catch(() => setCompanyOverview(null));
  }, [tab, job, companyOverview]);

  async function toggleSave() {
    if (!me || !token) return;
    const next = !saved;
    setSaved(next);
    track(next ? 'save_job' : 'unsave_job', { entityType: 'job', entityId: params.id });
    try {
      if (next) await candidatesApi.saveJob(token, params.id);
      else await candidatesApi.unsaveJob(token, params.id);
    } catch {
      setSaved(!next);
    }
  }

  async function toggleFollow() {
    if (!token || !job) return;
    setFollowBusy(true);
    const next = !following;
    setFollowing(next);
    track(next ? 'follow_company' : 'unfollow_company', { entityType: 'company', entityId: job.company.id });
    try {
      if (next) await candidatesApi.followCompany(token, job.company.id);
      else await candidatesApi.unfollowCompany(token, job.company.id);
    } catch {
      setFollowing(!next);
    } finally {
      setFollowBusy(false);
    }
  }

  async function handleApplyClick() {
    track('apply_click', { entityType: 'job', entityId: params.id, meta: { loggedIn: !!me } });
    if (!me || !token) {
      setApplyOpen(true);
      return;
    }
    setApplyOpen(true);
    setApplyError(null);
    if (cvs === null) {
      try {
        const [list, profile] = await Promise.all([
          candidatesApi.listCvs(token),
          candidatesApi.getProfile(token).catch(() => null),
        ]);
        setCvs(list);
        const percent = profile?.completionPercent ?? 0;
        setOnlineProfilePercent(percent);
        const primary = list.find((c) => c.isPrimary) ?? list[0];
        if (primary) setSelectedCvId(primary.id);
        // Chưa có CV file nào nhưng hồ sơ trực tuyến đã đủ dùng → chọn sẵn cách 2, khỏi chặn ứng tuyển.
        if (list.length === 0 && percent >= 100) setUseOnlineProfile(true);
      } catch {
        setCvs([]);
      }
    }
  }

  // Đợt 10 — nút "ỨNG TUYỂN NGAY" trên thẻ việc làm (JobCard) điều hướng tới đây kèm ?apply=1 để mở
  // sẵn khối nộp hồ sơ, không cần người dùng bấm lại "Nộp Đơn Ứng Tuyển".
  useEffect(() => {
    if (autoApplyTriggered.current) return;
    if (!job) return;
    if (searchParams.get('apply') !== '1') return;
    autoApplyTriggered.current = true;
    handleApplyClick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, searchParams]);

  async function submitApply(quickLetter?: string) {
    if (!token) return;
    if (!useOnlineProfile && !selectedCvId) return;
    setApplyState('submitting');
    setApplyError(null);
    try {
      await applicationsApi.apply(token, params.id, {
        ...(useOnlineProfile ? { useOnlineProfile: true } : { cvId: selectedCvId }),
        coverLetter: (quickLetter ?? coverLetter) || undefined,
      });
      track('apply_submit', { entityType: 'job', entityId: params.id, meta: { useOnlineProfile } });
      setApplyState('done');
    } catch (err) {
      setApplyState('idle');
      setApplyError(
        err instanceof ApiError ? err.message : 'Không thể nộp hồ sơ lúc này, vui lòng thử lại',
      );
    }
  }

  if (job === undefined) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-ink-faint text-sm">Đang tải...</div>
      </main>
    );
  }

  if (job === null) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <div className="text-ink-muted text-sm mb-3">Không tìm thấy tin tuyển dụng này.</div>
          <Link href="/viec-lam" className="text-primary font-semibold text-sm">
            ← Quay lại tìm việc làm
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-4 pb-6">
        <div className="text-[11.5px] text-ink-faint mb-3">
          <Link href="/viec-lam" className="hover:text-primary">
            Tìm việc làm
          </Link>
          {job.industry && (
            <>
              {' / '}
              <Link href={`/viec-lam?industry=${encodeURIComponent(job.industry)}`} className="hover:text-primary">
                {job.industry}
              </Link>
            </>
          )}
          {' / '}
          <span className="text-ink-muted font-semibold">{job.title}</span>
        </div>

        <div className="rounded-2xl bg-primary p-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-white text-xl font-extrabold flex items-center gap-2 flex-wrap">
              {job.title}
              {job.isUrgent && (
                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-white/20 text-white align-middle">
                  KHẨN CẤP
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <Link href={`/cong-ty/${job.company.id}`} className="co-name-dark text-[13px] hover:underline">
                {job.company.name}
              </Link>
              {isCompanyUnverified(job.company) && <SourcedBadge />}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={toggleSave}
              className="w-9 h-9 rounded-lg bg-white/15 text-white flex items-center justify-center"
              aria-label="Lưu tin"
            >
              {saved ? '♥' : '♡'}
            </button>
            <button onClick={handleApplyClick} className="tvl-btn-accent !w-auto px-5">
              Nộp Đơn Ứng Tuyển
            </button>
          </div>
        </div>

        {applyOpen && (
          <div className="mt-3 rounded-xl border border-border bg-white p-5">
            {!me ? (
              // Đợt 22 — khách chưa đăng nhập vẫn ứng tuyển được (họ tên/SĐT/email + file hoặc link CV).
              <GuestApplyForm jobId={params.id} jobTitle={job.title} onCancel={() => setApplyOpen(false)} />
            ) : applyState === 'done' ? (
              <>
                <div className="flex items-center gap-3 text-success text-sm font-semibold">
                  ✅ Đã gửi hồ sơ ứng tuyển thành công! Bạn có thể theo dõi trạng thái ở{' '}
                  <Link href="/ho-so#applications" className="underline">
                    My Center
                  </Link>
                  .
                </div>
                {/* Đợt 24 — banner nhỏ gọn ngay sau khi nộp đơn (người xem vừa xong việc chính). */}
                <AdSlot slot="apply-success" className="mt-3" />
              </>
            ) : cvs === null ? (
              <div className="text-sm text-ink-faint">Đang tải CV của bạn...</div>
            ) : cvs.length === 0 && !onlineProfileAvailable ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm text-ink-muted">
                  Bạn chưa có CV nào trong hồ sơ. Thêm CV, hoặc hoàn thiện{' '}
                  <Link href="/ho-so/truc-tuyen" className="text-primary font-semibold hover:underline">
                    Hồ sơ trực tuyến
                  </Link>{' '}
                  (Tiêu đề hồ sơ, Thông tin cá nhân, Kinh nghiệm làm việc) để ứng tuyển không cần file.
                </span>
                <Link href="/ho-so#cvs" className="tvl-btn-primary !w-auto px-5">
                  Thêm CV ngay
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="font-bold text-sm">Nộp hồ sơ ứng tuyển — {job.title}</div>
                {/* Đợt 21 — 2 cách chia sẻ hồ sơ: CV file/link có sẵn, hoặc "Hồ sơ trực tuyến" (không
                    cần file). Chỉ hiện lựa chọn khi ứng viên thực sự có cả 2 cách để chọn. */}
                {cvs.length > 0 && onlineProfileAvailable && (
                  <div className="flex gap-2 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setUseOnlineProfile(false)}
                      className={`px-3 py-1.5 rounded-lg border ${
                        !useOnlineProfile ? 'bg-primary text-white border-primary' : 'border-border text-ink-muted'
                      }`}
                    >
                      Chọn CV đã có
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseOnlineProfile(true)}
                      className={`px-3 py-1.5 rounded-lg border ${
                        useOnlineProfile ? 'bg-primary text-white border-primary' : 'border-border text-ink-muted'
                      }`}
                    >
                      Dùng Hồ sơ trực tuyến
                    </button>
                  </div>
                )}
                {useOnlineProfile ? (
                  <div className="rounded-lg bg-surface-alt px-3.5 py-3 text-[12px] text-ink-muted">
                    Nhà tuyển dụng sẽ nhận toàn bộ nội dung trong{' '}
                    <Link href="/ho-so/truc-tuyen" className="text-primary font-semibold hover:underline">
                      Hồ sơ trực tuyến
                    </Link>{' '}
                    của bạn — không kèm file CV.
                  </div>
                ) : (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold">Chọn CV</span>
                    <select
                      className="tvl-input"
                      value={selectedCvId}
                      onChange={(e) => setSelectedCvId(e.target.value)}
                    >
                      {cvs.map((cv) => (
                        <option key={cv.id} value={cv.id}>
                          {cv.fileUrl ? (cv.originalFileName ?? cv.fileUrl.split('/').pop()) : cv.externalLinkUrl}
                          {cv.isPrimary ? ' (CV chính)' : ''}
                        </option>
                      ))}
                    </select>
                    {!onlineProfileAvailable && (
                      <span className="text-[11px] text-ink-faint">
                        Muốn ứng tuyển không cần file? Hoàn thiện{' '}
                        <Link href="/ho-so/truc-tuyen" className="text-primary hover:underline">
                          Hồ sơ trực tuyến
                        </Link>{' '}
                        (Tiêu đề hồ sơ, Thông tin cá nhân, Kinh nghiệm làm việc).
                      </span>
                    )}
                  </label>
                )}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold flex items-center justify-between gap-2">
                    Thư ứng tuyển (không bắt buộc)
                    <button
                      type="button"
                      disabled={drafting}
                      onClick={async () => {
                        if (coverLetter.trim() && !window.confirm('Thay thư đang viết bằng thư gợi ý?')) return;
                        setDrafting(true);
                        const profile = token ? await candidatesApi.getProfile(token).catch(() => null) : null;
                        setCoverLetter(draftCoverLetter(job, profile as never, compatibility?.checklist));
                        setDrafting(false);
                      }}
                      className="text-primary font-semibold hover:underline text-[12px] disabled:opacity-50"
                    >
                      ✨ {drafting ? 'Đang soạn…' : 'Gợi ý thư ứng tuyển'}
                    </button>
                  </span>
                  <textarea
                    className={`tvl-input whitespace-pre-wrap ${coverLetter.length > 200 ? "min-h-[220px]" : "min-h-[80px]"}`}
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder="Giới thiệu ngắn gọn vì sao bạn phù hợp với vị trí này..."
                  />
                </label>
                {applyError && <div className="text-critical text-xs font-semibold">{applyError}</div>}
                <div className="flex gap-2">
                  <button
                    onClick={() => submitApply()}
                    disabled={applyState === 'submitting' || (!useOnlineProfile && !selectedCvId)}
                    className="tvl-btn-accent !w-auto px-6"
                  >
                    {applyState === 'submitting' ? 'Đang gửi...' : 'Gửi hồ sơ ứng tuyển'}
                  </button>
                  {/* Đợt 52 — Nộp nhanh một chạm: dùng CV/hồ sơ đã chọn + thư gợi ý tự soạn (khi ô thư còn trống). */}
                  <button
                    type="button"
                    disabled={applyState === 'submitting' || (!useOnlineProfile && !selectedCvId)}
                    onClick={async () => {
                      let letter = coverLetter;
                      if (!letter.trim()) {
                        const profile = token ? await candidatesApi.getProfile(token).catch(() => null) : null;
                        letter = draftCoverLetter(job, profile as never, compatibility?.checklist);
                        setCoverLetter(letter);
                      }
                      submitApply(letter);
                    }}
                    className="tvl-btn-ghost !w-auto px-4 disabled:opacity-50"
                    title="Nộp ngay bằng CV đã chọn và thư gợi ý tự soạn"
                  >
                    ⚡ Nộp nhanh
                  </button>
                  <button onClick={() => setApplyOpen(false)} className="tvl-btn-ghost !w-auto px-4">
                    Huỷ
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_280px] gap-5 mt-5 items-start">
          <div>
            <div className="flex gap-1 border-b border-border">
              {(
                [
                  ['details', 'Chi tiết'],
                  ['company', 'Tổng quan công ty'],
                ] as [Tab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px ${
                    tab === key ? 'text-primary border-primary' : 'text-ink-faint border-transparent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="rounded-b-xl border border-t-0 border-border bg-white p-5">
              {tab === 'details' ? (
                <>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-[12.5px]">
                    <Detail
                      label="📍 Địa điểm"
                      value={job.provinces?.length ? job.provinces.join(' | ') : job.location ?? '—'}
                    />
                    {job.district && <Detail label="🏙️ Quận/Huyện" value={job.district} />}
                    {home && distanceLabel(home, job.provinces ?? []) && (
                      <Detail label="🚗 Khoảng cách (ước tính)" value={distanceLabel(home, job.provinces ?? [])!} />
                    )}
                    <Detail label="🕒 Cập nhật" value={formatDate(job.updatedAt ?? job.createdAt)} />
                    <Detail label="🏷️ Ngành nghề" value={job.industry ?? '—'} />
                    <Detail label="💼 Hình thức" value={job.employmentType ?? '—'} />
                    <Detail
                      label="💰 Lương"
                      value={
                        salaryEst
                          ? `${formatSalary(job.salaryMin, job.salaryMax)} (thường ${fmtTrieu(salaryEst.low)}–${fmtTrieu(salaryEst.high)} triệu*)`
                          : formatSalary(job.salaryMin, job.salaryMax)
                      }
                    />
                    <Detail label="🎖️ Cấp bậc" value={job.level ?? '—'} />
                    {job.experienceLevel && <Detail label="📊 Kinh nghiệm" value={job.experienceLevel} />}
                    <Detail label="⏳ Hạn nộp" value={job.deadline ? formatDate(job.deadline) : '—'} />
                    <Detail label="👥 Số lượng" value={String(job.headcount)} />
                  </div>
                  {salaryEst && (
                    <div className="mt-2 text-[11.5px] text-ink-faint">
                      * Ước lượng từ {salaryEst.count} tin ghi rõ lương ngành {salaryEst.scope} trên web — chỉ mang tính tham khảo.
                    </div>
                  )}

                  {job.description && (
                    <div className="mt-5">
                      <h3 className="font-bold text-sm mb-2">Mô tả công việc</h3>
                      <RichTextView value={job.description} className="text-[12.8px] text-ink-muted" />
                    </div>
                  )}

                  {job.requirements && (
                    <div className="mt-4">
                      <h3 className="font-bold text-sm mb-2">Yêu cầu ứng viên</h3>
                      <RichTextView value={job.requirements} listFallback className="text-[12.8px] text-ink-muted leading-loose" />
                    </div>
                  )}

                  {/* Đợt 14 (25/09/2026) — mục 15: "Quyền lợi được hưởng" nay là rich text tự do
                      (HTML), hiển thị bằng RichTextView như Mô tả/Yêu cầu ứng viên thay vì mảng
                      chip cố định. listFallback giữ đúng cách hiển thị cũ (tách dòng thành <li>)
                      cho dữ liệu tin cũ trước Đợt 14 (dạng "A,B,C" từ cột simple-array).
                      Đợt 17i (25/09/2026) — theo yêu cầu người dùng: chuyển xuống SAU "Mô tả công
                      việc"/"Yêu cầu ứng viên" để khớp đúng thứ tự nhập liệu ở wizard đăng tin (Mô tả
                      công việc → Yêu cầu ứng viên → Quyền lợi được hưởng), trước đó hiện SAI thứ tự
                      (Quyền lợi lại hiện lên đầu). */}
                  {job.benefits && (
                    <div className="mt-4">
                      <div className="text-xs font-bold text-primary uppercase tracking-wide mb-2">Quyền lợi được hưởng</div>
                      <RichTextView value={benefitsRichTextValue(job.benefits)} listFallback className="text-[12.8px] text-ink-muted leading-loose" />
                    </div>
                  )}

                  {/* Đợt 12k (21/09/2026) — khối "Địa điểm làm việc" (địa chỉ chi tiết) + "Thông
                      tin khác" (Giới tính, Độ tuổi, Thời gian làm việc, Lương), theo mẫu
                      careerviet.vn. Tin cũ chưa có dữ liệu vẫn hiện giá trị mặc định hợp lý.
                      Đợt 12n (21/09/2026) — chuyển xuống dưới "Yêu cầu ứng viên" theo mẫu. */}
                  <div className="mt-5">
                    <div className="text-xs font-bold text-primary uppercase tracking-wide mb-2">
                      Địa điểm làm việc
                    </div>
                    <div className="text-[12.8px] font-bold text-ink">
                      {job.provinces?.length ? job.provinces.join(' | ') : job.location ?? 'Đang cập nhật'}
                    </div>
                    <div className="text-[12.5px] text-ink-muted mt-1 flex items-start gap-1.5">
                      <span>📍</span>
                      <span>
                        {jobAddressDisplay(
                          job.address,
                          job.provinces?.length ? job.provinces.join(' | ') : job.location,
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="text-xs font-bold text-primary uppercase tracking-wide mb-2">
                      Thông tin khác
                    </div>
                    <ul className="text-[12.8px] text-ink-muted leading-loose list-disc pl-5">
                      <li>Giới tính: {jobGenderDisplay(job.gender)}</li>
                      <li>Độ tuổi: {jobAgeRangeDisplay(job.ageRange)}</li>
                      <li>Thời gian làm việc: {jobWorkScheduleDisplay(job.workSchedule)}</li>
                      <li>Lương: {formatSalaryTag(job.salaryMin, job.salaryMax)}</li>
                    </ul>
                  </div>

                  {/* Đợt 12v (21/09/2026) — "JOB TAGS / SKILLS": thẻ từ khoá/kỹ năng NTD tự nhập khi
                      đăng tin (theo ảnh mẫu người dùng gửi), chỉ hiện khi tin có ít nhất 1 tag. */}
                  {job.tags && job.tags.length > 0 && (
                    <div className="mt-5">
                      <div className="text-xs font-bold text-primary uppercase tracking-wide mb-2">
                        Job tags / Skills
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {job.tags.map((t) => (
                          <span key={t} className="text-[11.5px] font-normal px-2.5 py-1 rounded-full bg-surface-alt text-ink-muted">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Đợt 12aa (24/09/2026) — "Thông tin liên hệ" (không bắt buộc) NTD nhập khi đăng
                      tin, chỉ hiện khi có ít nhất 1 trường, theo mẫu careerviet.vn.
                      Đợt 14 (25/09/2026) — mục 15: thêm `contactNote` (rich text tự do) song song với
                      3 trường có cấu trúc, để vẫn giữ link tự động mailto:/tel: mà thêm được ghi chú. */}
                  {(job.contactName || job.contactEmail || job.contactPhone || job.contactNote) && (
                    <div className="mt-5">
                      <div className="text-xs font-bold text-primary uppercase tracking-wide mb-2">
                        Thông tin liên hệ
                      </div>
                      {(job.contactName || job.contactEmail || job.contactPhone) && (
                        <ul className="text-[12.8px] text-ink-muted leading-loose list-disc pl-5">
                          {job.contactName && <li>Người liên hệ: {job.contactName}</li>}
                          {job.contactEmail && (
                            <li>
                              Email: <a href={`mailto:${job.contactEmail}`} className="text-primary hover:underline">{job.contactEmail}</a>
                            </li>
                          )}
                          {job.contactPhone && (
                            <li>
                              Điện thoại: <a href={`tel:${job.contactPhone}`} className="text-primary hover:underline">{job.contactPhone}</a>
                            </li>
                          )}
                        </ul>
                      )}
                      {job.contactNote && (
                        <RichTextView
                          value={job.contactNote}
                          className={`text-[12.8px] text-ink-muted leading-loose${
                            job.contactName || job.contactEmail || job.contactPhone ? ' mt-2' : ''
                          }`}
                        />
                      )}
                    </div>
                  )}
                </>
              ) : companyOverview ? (
                /* Đợt 49 — "Tổng quan công ty" theo mẫu (components/CompanyOverview.tsx). */
                <CompanyOverview
                  company={{ ...job.company, ...companyOverview.company }}
                  jobs={companyOverview.jobs}
                  excludeJobId={job.id}
                  canFollow={me?.role === 'candidate'}
                  following={following}
                  followBusy={followBusy}
                  onToggleFollow={toggleFollow}
                  maxJobs={6}
                  showAllLink
                />
              ) : (
                <div className="text-ink-faint text-[13px]">
                  {companyOverview === undefined ? 'Đang tải thông tin công ty…' : 'Không tải được thông tin công ty.'}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3.5 lg:self-stretch min-w-0">
            {/* Đợt 49 — tab "Tổng quan công ty" đã có khung công ty + nút FOLLOW → ẩn thẻ công ty cột phải để không trùng. */}
            {tab !== 'company' && (
            <div className="rounded-xl border border-border bg-white p-4">
              <div className="flex flex-col gap-2.5 min-w-0">
                <CompanyLogo name={job.company.name} logoUrl={job.company.logoUrl} size={96} className="text-lg" />
                <Link href={`/cong-ty/${job.company.id}`} className="font-bold text-[13px] hover:text-primary hover:underline block min-w-0">
                  <FitText lines={2} min={0.7} className="co-name">{job.company.name}</FitText>
                </Link>
                {isCompanyUnverified(job.company) && (
                  <div>
                    <FitText>
                      <SourcedBadge />
                    </FitText>
                  </div>
                )}
              </div>
              {me?.role === 'candidate' && (
                <button onClick={toggleFollow} disabled={followBusy} className="tvl-btn-ghost mt-3 disabled:opacity-60">
                  {following ? '✓ Đang theo dõi' : '+ Theo dõi'}
                </button>
              )}
            </div>
            )}

            {/* Đợt 12ab (24/09/2026) — "Đánh giá mức độ tương thích" (radar chart), theo mẫu
                careerviet.vn — chỉ hiện cho ứng viên đã đăng nhập và đã có hồ sơ. */}
            {me?.role === 'candidate' && compatibility && (
              <div className="rounded-xl border border-border bg-white p-4">
                <div className="text-[11px] font-bold text-primary uppercase tracking-wide mb-2 text-center">
                  Đánh giá mức độ tương thích
                </div>
                <CompatibilityRadar criteria={compatibility.criteria} overall={compatibility.overall} />
              </div>
            )}

            {/* Đợt 13 (24/09/2026) — "TIÊU CHÍ ĐÁNH GIÁ" dạng checklist chia nhóm, đúng mẫu
                careerviet.vn người dùng gửi ảnh. Hiện SONG SONG với radar ở trên (người dùng chọn
                giữ cả 2 dạng), cùng điều kiện hiện (ứng viên đã đăng nhập + có hồ sơ). */}
            {me?.role === 'candidate' && compatibility && (
              <div className="rounded-xl border border-border bg-white p-4">
                <div className="text-[11px] font-bold text-primary uppercase tracking-wide mb-2.5">
                  Tiêu chí đánh giá
                </div>
                <CompatibilityChecklist checklist={compatibility.checklist} missingSkills={compatibility.missingSkills} />
              </div>
            )}
            {/* Đợt 33 — banner cột phải nằm TRÊN khối "Việc làm được tìm kiếm nhiều nhất"; khối từ khoá dính theo khi cuộn. */}
            <AdStack sticky={false}>
              <AdSlot slot="job-sidebar" />
              <AdSlot slot="job-sidebar-2" />
              <AdSlot slot="job-sidebar-3" />
            </AdStack>
            <PopularKeywords sticky />
          </div>
        </div>

        {/* Đợt 45 — không chèn quảng cáo giữa nội dung tin (mất thiện cảm): banner "job-mid" đặt SAU toàn bộ
            nội dung tin (sau Thông tin liên hệ), "job-bottom" dời xuống cuối trang sau "Các công việc tương tự". */}
        <AdSlot slot="job-mid" className="mt-4" />

        {/* Đợt 12n (21/09/2026) — "Các công việc tương tự" chuyển từ khối nhỏ trên sidebar xuống
            cuối trang, dạng lưới đầy đủ như JobCard ở trang tìm việc, theo mẫu tham khảo. */}
        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="font-extrabold text-base uppercase tracking-wide mb-3">Các công việc tương tự</h2>
            {/* Đợt 21 — thêm "grid-cols-1" tường minh: thiếu khai báo cột ở mobile khiến track "auto"
                không bị giới hạn theo container, đẩy thẻ việc làm (flex-wrap bên trong) tràn ngang
                trang trên điện thoại (phát hiện qua kiểm thử tự động ui21.js, không liên quan Đợt 21). */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {related.map((r) => (
                <JobCard key={r.id} job={r} />
              ))}
            </div>
          </div>
        )}

        <AdSlot slot="job-bottom" className="mt-6" />
      </div>
    </main>
  );
}


function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-ink-faint text-[11px]">{label}</div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}

export default function JobDetailPage() {
  return (
    <Suspense fallback={null}>
      <JobDetailInner />
    </Suspense>
  );
}
