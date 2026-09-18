'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { jobsApi, candidatesApi, applicationsApi, ApiError, type JobPosting, type CV } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { companyInitials, formatDate, formatSalary } from '@/lib/format';

type Tab = 'details' | 'company';

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const { me, token } = useAuth();
  const [job, setJob] = useState<JobPosting | null | undefined>(undefined);
  const [related, setRelated] = useState<JobPosting[]>([]);
  const [tab, setTab] = useState<Tab>('details');
  const [saved, setSaved] = useState(false);

  const [applyOpen, setApplyOpen] = useState(false);
  const [cvs, setCvs] = useState<CV[] | null>(null);
  const [selectedCvId, setSelectedCvId] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [applyState, setApplyState] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    jobsApi
      .get(params.id)
      .then((res) => {
        setJob(res.job);
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

  async function toggleSave() {
    if (!me || !token) return;
    const next = !saved;
    setSaved(next);
    try {
      if (next) await candidatesApi.saveJob(token, params.id);
      else await candidatesApi.unsaveJob(token, params.id);
    } catch {
      setSaved(!next);
    }
  }

  async function handleApplyClick() {
    if (!me || !token) {
      setApplyOpen(true);
      return;
    }
    setApplyOpen(true);
    setApplyError(null);
    if (cvs === null) {
      try {
        const list = await candidatesApi.listCvs(token);
        setCvs(list);
        const primary = list.find((c) => c.isPrimary) ?? list[0];
        if (primary) setSelectedCvId(primary.id);
      } catch {
        setCvs([]);
      }
    }
  }

  async function submitApply() {
    if (!token || !selectedCvId) return;
    setApplyState('submitting');
    setApplyError(null);
    try {
      await applicationsApi.apply(token, params.id, { cvId: selectedCvId, coverLetter: coverLetter || undefined });
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
        <div className="max-w-6xl mx-auto px-4 py-16 text-center text-ink-faint text-sm">Đang tải...</div>
      </main>
    );
  }

  if (job === null) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6">
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
            <div className="text-white text-xl font-extrabold">{job.title}</div>
            <div className="text-white/75 text-[13px] mt-1">{job.company.name}</div>
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
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm text-ink-muted">Vui lòng đăng nhập để nộp hồ sơ ứng tuyển.</span>
                <Link href="/dang-nhap" className="tvl-btn-primary !w-auto px-5">
                  Đăng nhập / Đăng ký
                </Link>
              </div>
            ) : applyState === 'done' ? (
              <div className="flex items-center gap-3 text-success text-sm font-semibold">
                ✅ Đã gửi hồ sơ ứng tuyển thành công! Bạn có thể theo dõi trạng thái ở{' '}
                <Link href="/ho-so#applications" className="underline">
                  My Center
                </Link>
                .
              </div>
            ) : cvs === null ? (
              <div className="text-sm text-ink-faint">Đang tải CV của bạn...</div>
            ) : cvs.length === 0 ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm text-ink-muted">
                  Bạn chưa có CV nào trong hồ sơ. Thêm CV trước khi ứng tuyển.
                </span>
                <Link href="/ho-so#cvs" className="tvl-btn-primary !w-auto px-5">
                  Thêm CV ngay
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="font-bold text-sm">Nộp hồ sơ ứng tuyển — {job.title}</div>
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
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold">Thư ứng tuyển (không bắt buộc)</span>
                  <textarea
                    className="tvl-input min-h-[80px]"
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder="Giới thiệu ngắn gọn vì sao bạn phù hợp với vị trí này..."
                  />
                </label>
                {applyError && <div className="text-critical text-xs font-semibold">{applyError}</div>}
                <div className="flex gap-2">
                  <button
                    onClick={submitApply}
                    disabled={applyState === 'submitting'}
                    className="tvl-btn-accent !w-auto px-6"
                  >
                    {applyState === 'submitting' ? 'Đang gửi...' : 'Gửi hồ sơ ứng tuyển'}
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
                    <Detail label="📍 Địa điểm" value={job.location ?? '—'} />
                    <Detail label="🕒 Cập nhật" value={formatDate(job.createdAt)} />
                    <Detail label="🏷️ Ngành nghề" value={job.industry ?? '—'} />
                    <Detail label="💼 Hình thức" value={job.employmentType ?? '—'} />
                    <Detail label="💰 Lương" value={formatSalary(job.salaryMin, job.salaryMax)} />
                    <Detail label="🎖️ Cấp bậc" value={job.level ?? '—'} />
                    <Detail label="⏳ Hạn nộp" value={job.deadline ? formatDate(job.deadline) : '—'} />
                    <Detail label="👥 Số lượng" value={String(job.headcount)} />
                  </div>

                  {job.benefits && job.benefits.length > 0 && (
                    <div className="mt-5">
                      <div className="text-xs font-bold text-primary uppercase tracking-wide mb-2">Phúc lợi</div>
                      <div className="flex flex-wrap gap-1.5">
                        {job.benefits.map((b) => (
                          <span key={b} className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-surface-alt text-ink-muted">
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {job.description && (
                    <div className="mt-5">
                      <h3 className="font-bold text-sm mb-2">Mô tả công việc</h3>
                      <p className="text-[12.8px] text-ink-muted leading-relaxed whitespace-pre-line">
                        {job.description}
                      </p>
                    </div>
                  )}

                  {job.requirements && (
                    <div className="mt-4">
                      <h3 className="font-bold text-sm mb-2">Yêu cầu ứng viên</h3>
                      <ul className="text-[12.8px] text-ink-muted leading-loose list-disc pl-5">
                        {job.requirements.split('\n').filter(Boolean).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-3 text-[12.8px] text-ink-muted">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary-tint text-primary flex items-center justify-center font-bold text-sm shrink-0">
                      {companyInitials(job.company.name)}
                    </div>
                    <div>
                      <div className="font-bold text-ink text-sm">{job.company.name}</div>
                      <div className="text-ink-faint text-xs">Mã số thuế: {job.company.taxCode}</div>
                    </div>
                  </div>
                  {job.company.industry && <div>Lĩnh vực: {job.company.industry}</div>}
                  {job.company.size && <div>Quy mô: {job.company.size}</div>}
                  {job.company.website && <div>Website: {job.company.website}</div>}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            <div className="rounded-xl border border-border bg-white p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-primary-tint text-primary flex items-center justify-center font-bold text-xs">
                  {companyInitials(job.company.name)}
                </div>
                <div className="font-bold text-[13px]">{job.company.name}</div>
              </div>
              <button className="tvl-btn-ghost mt-3">+ Theo dõi</button>
            </div>

            {related.length > 0 && (
              <div className="rounded-xl border border-border bg-white p-4">
                <div className="text-xs font-bold text-primary uppercase tracking-wide mb-2.5">
                  Việc làm tương tự
                </div>
                <div className="flex flex-col gap-3">
                  {related.map((r) => (
                    <Link key={r.id} href={`/viec-lam/${r.id}`} className="block hover:text-primary">
                      <div className="font-bold text-[12.5px]">{r.title}</div>
                      <div className="text-ink-faint text-[11.3px]">
                        {r.company.name} · {formatSalary(r.salaryMin, r.salaryMax)}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
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
