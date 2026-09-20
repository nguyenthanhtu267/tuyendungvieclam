'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import EmployerHeader from '@/components/EmployerHeader';
import { useAuth } from '@/lib/auth-context';
import {
  employerApi,
  type EmployerJob,
  type EmployerApplication,
  type ApplicationStatus,
  type ApplicantFilters,
} from '@/lib/api';
import { APPLICATION_STATUS_CLASS, APPLICATION_STATUS_LABEL, formatDate } from '@/lib/format';

const STATUS_TABS: { value: ApplicationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'new', label: 'Mới ứng tuyển' },
  { value: 'reviewing', label: 'Đang xem xét' },
  { value: 'suitable', label: 'Phù hợp' },
  { value: 'interview', label: 'Mời phỏng vấn' },
  { value: 'rejected', label: 'Từ chối' },
];

const NO_FOLDER = '__none__';
const NEW_FOLDER = '__new__';

// Đợt 11b — Mục #4 ATS: đánh giá sao 1-5, click lại đúng số sao đang có sẽ không đổi (không hỗ trợ
// bỏ đánh giá — backend yêu cầu rating từ 1-5).
function StarRating({
  value,
  onChange,
  disabled,
}: {
  value?: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`text-sm leading-none disabled:opacity-50 ${
            value && n <= value ? 'text-warning' : 'text-border hover:text-warning/50'
          }`}
          title={`${n} sao`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function FolderPicker({
  value,
  folders,
  onChange,
  disabled,
}: {
  value?: string;
  folders: string[];
  onChange: (folder: string | undefined) => void;
  disabled?: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');

  if (creating) {
    return (
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const name = draft.trim();
          setCreating(false);
          setDraft('');
          if (name) onChange(name);
        }}
      >
        <input
          autoFocus
          className="tvl-input !w-28 text-[11px] py-1"
          placeholder="Tên thư mục"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setCreating(false)}
          maxLength={60}
        />
      </form>
    );
  }

  return (
    <select
      className="tvl-input !w-auto text-[11px] py-1"
      value={value ?? NO_FOLDER}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        if (v === NEW_FOLDER) setCreating(true);
        else if (v === NO_FOLDER) onChange(undefined);
        else onChange(v);
      }}
    >
      <option value={NO_FOLDER}>— Không thư mục —</option>
      {folders.map((f) => (
        <option key={f} value={f}>
          {f}
        </option>
      ))}
      <option value={NEW_FOLDER}>+ Tạo thư mục mới…</option>
    </select>
  );
}

function UngVienPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { me, token } = useAuth();

  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [jobId, setJobIdState] = useState<string>(searchParams.get('jobId') ?? '');
  const [view, setView] = useState<'active' | 'trash'>('active');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [folderFilter, setFolderFilter] = useState<string>('');
  const [ratingMinFilter, setRatingMinFilter] = useState<string>('');
  const [qFilter, setQFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [folders, setFolders] = useState<string[]>([]);
  const [applicants, setApplicants] = useState<EmployerApplication[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
    else if (me && !me.role.startsWith('employer')) router.replace('/');
  }, [me, router]);

  function setJobId(id: string) {
    setJobIdState(id);
    router.replace(`/nha-tuyen-dung/ung-vien?jobId=${id}`, { scroll: false });
  }

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoadingJobs(true);
      try {
        const list = await employerApi.listJobs(token);
        setJobs(list);
        const paramJobId = searchParams.get('jobId');
        if (paramJobId && list.some((j) => j.id === paramJobId)) setJobIdState(paramJobId);
        else if (list.length > 0) setJobId(list[0].id);
      } finally {
        setLoadingJobs(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    employerApi.listFolders(token).then(setFolders).catch(() => {});
  }, [token]);

  const loadApplicants = useCallback(async () => {
    if (!token || !jobId) return;
    setLoadingApplicants(true);
    setErrorMsg('');
    try {
      if (view === 'trash') {
        const list = await employerApi.listTrashedApplicants(token, jobId);
        setApplicants(list);
      } else {
        const filters: ApplicantFilters = {
          status: statusFilter === 'all' ? undefined : statusFilter,
          folder: folderFilter || undefined,
          ratingMin: ratingMinFilter ? Number(ratingMinFilter) : undefined,
          q: qFilter.trim() || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        };
        const list = await employerApi.listApplicants(token, jobId, filters);
        setApplicants(list);
      }
    } finally {
      setLoadingApplicants(false);
    }
  }, [token, jobId, view, statusFilter, folderFilter, ratingMinFilter, qFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadApplicants();
  }, [loadApplicants]);

  async function handleStatusChange(applicationId: string, status: ApplicationStatus) {
    if (!token) return;
    setBusyId(applicationId);
    try {
      await employerApi.updateApplicationStatus(token, applicationId, status);
      await loadApplicants();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRate(applicationId: string, rating: number) {
    if (!token) return;
    setBusyId(applicationId);
    setErrorMsg('');
    try {
      await employerApi.rateApplication(token, applicationId, rating);
      await loadApplicants();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSetFolder(applicationId: string, folder: string | undefined) {
    if (!token) return;
    setBusyId(applicationId);
    setErrorMsg('');
    try {
      await employerApi.setApplicationFolder(token, applicationId, folder);
      const [freshFolders] = await Promise.all([employerApi.listFolders(token), loadApplicants()]);
      setFolders(freshFolders);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
    } finally {
      setBusyId(null);
    }
  }

  async function handleTrash(applicationId: string) {
    if (!token) return;
    setBusyId(applicationId);
    try {
      await employerApi.trashApplication(token, applicationId);
      await loadApplicants();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRestore(applicationId: string) {
    if (!token) return;
    setBusyId(applicationId);
    try {
      await employerApi.restoreApplication(token, applicationId);
      await loadApplicants();
    } finally {
      setBusyId(null);
    }
  }

  async function handlePermanentDelete(applicationId: string) {
    if (!token) return;
    if (!window.confirm('Xoá vĩnh viễn hồ sơ này? Hành động không thể hoàn tác.')) return;
    setBusyId(applicationId);
    try {
      await employerApi.permanentlyDeleteApplication(token, applicationId);
      await loadApplicants();
    } finally {
      setBusyId(null);
    }
  }

  if (!me || !me.role.startsWith('employer')) return null;

  const currentJob = jobs.find((j) => j.id === jobId);
  const hasActiveFilters = !!(folderFilter || ratingMinFilter || qFilter || dateFrom || dateTo);

  return (
    <main className="min-h-screen bg-bg">
      <EmployerHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col gap-4">
        {loadingJobs ? (
          <div className="text-center text-ink-faint py-10 text-sm">Đang tải…</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-3">
            <div className="text-ink-faint text-sm">Bạn chưa có tin tuyển dụng nào để quản lý ứng viên.</div>
            <Link href="/nha-tuyen-dung/dang-tin" className="tvl-btn-primary !w-auto px-5">
              + Đăng tin đầu tiên
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h1 className="font-extrabold text-base uppercase">{currentJob?.title}</h1>
              <div className="flex items-center gap-2">
                <select className="tvl-input !w-auto text-sm" value={jobId} onChange={(e) => setJobId(e.target.value)}>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} ({j.applicationCount} hồ sơ)
                    </option>
                  ))}
                </select>
                <Link href="/nha-tuyen-dung/tin-dang" className="text-xs font-semibold text-primary whitespace-nowrap">
                  Quản lý tin
                </Link>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-lg bg-critical-tint text-critical text-xs font-semibold px-3.5 py-2.5">{errorMsg}</div>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-1 border-b border-border overflow-x-auto flex-1">
                {(view === 'active' ? STATUS_TABS : []).map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setStatusFilter(tab.value)}
                    className={`px-3.5 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 -mb-px ${
                      statusFilter === tab.value ? 'text-primary border-primary' : 'text-ink-faint border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pb-2">
                {view === 'active' && (
                  <button
                    onClick={() => setShowAdvanced((v) => !v)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
                      hasActiveFilters ? 'border-primary text-primary bg-primary/5' : 'border-border text-ink-faint'
                    }`}
                  >
                    Bộ lọc nâng cao {hasActiveFilters ? '●' : ''}
                  </button>
                )}
                <button
                  onClick={() => setView(view === 'active' ? 'trash' : 'active')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
                    view === 'trash' ? 'border-critical text-critical bg-critical-tint' : 'border-border text-ink-faint'
                  }`}
                >
                  🗑 Thùng rác
                </button>
              </div>
            </div>

            {view === 'active' && showAdvanced && (
              <div className="rounded-xl bg-white border border-border p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-ink-faint">Thư mục</label>
                  <select className="tvl-input text-xs" value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)}>
                    <option value="">Tất cả</option>
                    {folders.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-ink-faint">Đánh giá tối thiểu</label>
                  <select
                    className="tvl-input text-xs"
                    value={ratingMinFilter}
                    onChange={(e) => setRatingMinFilter(e.target.value)}
                  >
                    <option value="">Tất cả</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {'★'.repeat(n)} trở lên
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-ink-faint">Từ khoá (tên ứng viên)</label>
                  <input
                    className="tvl-input text-xs"
                    placeholder="Tìm theo tên…"
                    value={qFilter}
                    onChange={(e) => setQFilter(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-ink-faint">Từ ngày</label>
                  <input
                    type="date"
                    className="tvl-input text-xs"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-ink-faint">Đến ngày</label>
                  <input type="date" className="tvl-input text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                {hasActiveFilters && (
                  <button
                    className="text-critical font-semibold text-left sm:col-span-2 lg:col-span-5"
                    onClick={() => {
                      setFolderFilter('');
                      setRatingMinFilter('');
                      setQFilter('');
                      setDateFrom('');
                      setDateTo('');
                    }}
                  >
                    Xoá bộ lọc
                  </button>
                )}
              </div>
            )}

            <div className="rounded-xl bg-white border border-border overflow-hidden">
              {loadingApplicants ? (
                <div className="text-center text-ink-faint py-10 text-sm">Đang tải…</div>
              ) : applicants.length === 0 ? (
                <div className="text-center text-ink-faint py-10 text-sm">
                  {view === 'trash' ? 'Thùng rác trống' : 'Chưa có hồ sơ ứng tuyển nào phù hợp'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-ink-faint bg-surface-alt">
                        <th className="py-2.5 px-4 font-semibold">Ứng viên</th>
                        <th className="py-2.5 px-3 font-semibold">Ngày nộp</th>
                        {view === 'active' && <th className="py-2.5 px-3 font-semibold">Đánh giá</th>}
                        {view === 'active' && <th className="py-2.5 px-3 font-semibold">Thư mục</th>}
                        {view === 'active' && <th className="py-2.5 px-3 font-semibold">Trạng thái</th>}
                        <th className="py-2.5 px-3 font-semibold">CV</th>
                        <th className="py-2.5 px-4 font-semibold text-right">
                          {view === 'active' ? 'Cập nhật / Xoá' : 'Khôi phục / Xoá vĩnh viễn'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {applicants.map((app) => (
                        <tr key={app.id} className="border-t border-border align-top">
                          <td className="py-3 px-4">
                            <div className="font-bold">{app.cv.candidateProfile.fullName}</div>
                            <div className="text-ink-faint mt-0.5">
                              {app.cv.candidateProfile.desiredPosition ?? 'Chưa cập nhật vị trí mong muốn'}
                            </div>
                            {app.coverLetter && (
                              <div className="text-ink-faint mt-1 italic max-w-xs">&quot;{app.coverLetter}&quot;</div>
                            )}
                          </td>
                          <td className="py-3 px-3 tabular-nums whitespace-nowrap">{formatDate(app.appliedAt)}</td>
                          {view === 'active' && (
                            <td className="py-3 px-3">
                              <StarRating
                                value={app.rating}
                                disabled={busyId === app.id}
                                onChange={(r) => handleRate(app.id, r)}
                              />
                            </td>
                          )}
                          {view === 'active' && (
                            <td className="py-3 px-3">
                              <FolderPicker
                                value={app.folder}
                                folders={folders}
                                disabled={busyId === app.id}
                                onChange={(f) => handleSetFolder(app.id, f)}
                              />
                            </td>
                          )}
                          {view === 'active' && (
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${APPLICATION_STATUS_CLASS[app.status]}`}
                              >
                                {APPLICATION_STATUS_LABEL[app.status]}
                              </span>
                            </td>
                          )}
                          <td className="py-3 px-3">
                            {app.cv.fileUrl ? (
                              <a
                                className="text-primary font-semibold"
                                href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${app.cv.fileUrl}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Xem CV
                              </a>
                            ) : app.cv.externalLinkUrl ? (
                              <a className="text-primary font-semibold" href={app.cv.externalLinkUrl} target="_blank" rel="noreferrer">
                                Xem CV (Drive)
                              </a>
                            ) : (
                              <span className="text-ink-faint">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {view === 'active' ? (
                              <div className="flex justify-end items-center gap-2 flex-wrap">
                                <select
                                  className="tvl-input !w-auto text-xs py-1.5"
                                  value={app.status}
                                  disabled={busyId === app.id}
                                  onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                                >
                                  {STATUS_TABS.filter((t) => t.value !== 'all').map((t) => (
                                    <option key={t.value} value={t.value}>
                                      {t.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  title="Chuyển vào thùng rác"
                                  disabled={busyId === app.id}
                                  onClick={() => handleTrash(app.id)}
                                  className="rounded-lg border border-border px-2 py-1.5 text-ink-faint hover:text-critical hover:border-critical disabled:opacity-50"
                                >
                                  🗑
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-2">
                                <button
                                  disabled={busyId === app.id}
                                  onClick={() => handleRestore(app.id)}
                                  className="rounded-lg border border-border px-2.5 py-1.5 font-semibold text-ink-muted hover:bg-surface-alt whitespace-nowrap disabled:opacity-50"
                                >
                                  Khôi phục
                                </button>
                                <button
                                  disabled={busyId === app.id}
                                  onClick={() => handlePermanentDelete(app.id)}
                                  className="rounded-lg border border-critical text-critical px-2.5 py-1.5 font-semibold hover:bg-critical-tint whitespace-nowrap disabled:opacity-50"
                                >
                                  Xoá vĩnh viễn
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function UngVienPage() {
  return (
    <Suspense fallback={null}>
      <UngVienPageInner />
    </Suspense>
  );
}
