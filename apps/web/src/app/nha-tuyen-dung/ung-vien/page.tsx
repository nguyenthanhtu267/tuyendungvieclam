'use client';

import { ReplyTemplates } from '@/components/ReplyTemplates';
import InterviewScheduler from '@/components/InterviewScheduler';
import ApplicantBulkTools from '@/components/ApplicantBulkTools';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from '@/components/SmartLink';
import EmployerHeader from '@/components/EmployerHeader';
import { RichTextView } from '@/components/RichTextView';
import { useAuth } from '@/lib/auth-context';
import {
  employerApi,
  ApiError,
  type EmployerJob,
  type EmployerApplication,
  type ApplicationStatus,
  type ApplicantFilters,
  type CandidateDetail,
  smartApi,
  smartApi3,
  type ApplicantScoreInfo,
  smartApi6,
  type ApplicantFlags,
} from '@/lib/api';
import { APPLICATION_STATUS_CLASS, APPLICATION_STATUS_LABEL, formatDate, formatNumber } from '@/lib/format';

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
  // Đợt 63 — điểm phù hợp từng hồ sơ + sắp xếp theo độ phù hợp.
  const [scores, setScores] = useState<Record<string, ApplicantScoreInfo>>({});
  const [flagInfo, setFlagInfo] = useState<ApplicantFlags | null>(null);
  const [pushFail, setPushFail] = useState(true);
  // Đợt 65 — NTD tự chỉnh trọng số tiêu chí (hệ số 0–3, mặc định 1) để xếp hạng lại tại chỗ.
  const [mult, setMult] = useState<Record<string, number>>({});
  const [showWeights, setShowWeights] = useState(false);
  const [reinvite, setReinvite] = useState<{ profileId: string; name: string; title: string | null; score: number; reasons: string[]; oldJob: string; oldStatus: string }[]>([]);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const adjScore = (id: string): number | undefined => {
    const sc = scores[id];
    if (!sc) return undefined;
    if (!sc.parts || Object.keys(mult).length === 0) return sc.score;
    let num = 0, den = 0;
    for (const p of sc.parts) {
      const w = p.weight * (mult[p.key] ?? 1);
      num += p.score * w;
      den += w;
    }
    return den === 0 ? sc.score : Math.min(100, Math.round(num / den + (sc.bonus ?? 0)));
  };
  const [sortBest, setSortBest] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Đợt 21 (27/09/2026) — xem "Hồ sơ trực tuyến" của ứng viên ứng tuyển bằng cách 2 (không có file).
  const [profileModal, setProfileModal] = useState<{
    detail: CandidateDetail | null;
    loading: boolean;
    error: string | null;
  } | null>(null);

  async function openOnlineProfile(applicationId: string) {
    if (!token) return;
    setProfileModal({ detail: null, loading: true, error: null });
    try {
      const detail = await employerApi.getApplicantOnlineProfile(token, applicationId);
      setProfileModal({ detail, loading: false, error: null });
    } catch (err) {
      setProfileModal({
        detail: null,
        loading: false,
        error: err instanceof ApiError ? err.message : 'Không thể tải hồ sơ',
      });
    }
  }

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

  useEffect(() => {
    if (!token || !jobId) return;
    smartApi6.applicantFlags(token, jobId).then(setFlagInfo).catch(() => setFlagInfo(null));
  }, [token, jobId, applicants.length]);

  useEffect(() => {
    if (!token || !jobId) return;
    smartApi.applicantScores(token, jobId).then((r) => setScores(r.scores)).catch(() => setScores({}));
  }, [token, jobId, applicants.length]);

  useEffect(() => {
    if (!token || !jobId) {
      setReinvite([]);
      return;
    }
    smartApi3.reinvite(token, jobId).then((r) => setReinvite(r.items)).catch(() => setReinvite([]));
  }, [token, jobId]);

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
    <main className="min-h-screen">
      <EmployerHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col gap-4">
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
              <h1 className="font-extrabold text-base uppercase tvl-title">{currentJob?.title}</h1>
              <div className="flex items-center gap-2">
                <select className="tvl-input !w-auto text-sm" value={jobId} onChange={(e) => setJobId(e.target.value)}>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} ({formatNumber(j.applicationCount)} hồ sơ)
                    </option>
                  ))}
                </select>
                <Link href="/nha-tuyen-dung/tin-dang" className="text-xs font-semibold text-primary whitespace-nowrap tvl-title">
                  Quản lý tin
                </Link>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-lg bg-critical-tint text-critical text-xs font-semibold px-3.5 py-2.5">{errorMsg}</div>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-1 border-b border-border bg-white rounded-t-xl px-2 overflow-x-auto flex-1">
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
                      hasActiveFilters ? 'border-primary text-primary bg-[#F3F6FB]' : 'border-border text-ink-faint bg-white'
                    }`}
                  >
                    Bộ lọc nâng cao {hasActiveFilters ? '●' : ''}
                  </button>
                )}
                <button
                  onClick={() => setView(view === 'active' ? 'trash' : 'active')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
                    view === 'trash' ? 'border-critical text-critical bg-critical-tint' : 'border-border text-ink-faint bg-white'
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

            {view === 'active' && showWeights && Object.values(scores).some((x) => x.parts) && (
              <div className="rounded-xl border border-border bg-white p-3 mb-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="font-extrabold text-[13px]">Trọng số tiêu chí (kéo để xếp hạng lại)</div>
                  <button type="button" onClick={() => setMult({})} className="text-[12px] font-bold text-primary">Về mặc định</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
                  {(Object.values(scores).find((x) => x.parts)?.parts ?? []).map((p) => (
                    <label key={p.key} htmlFor={`w-${p.key}`} className="flex items-center gap-2 text-[12.5px]">
                      <span className="w-24 shrink-0 font-semibold">{p.label}</span>
                      <input id={`w-${p.key}`} type="range" min={0} max={3} step={0.5} value={mult[p.key] ?? 1} onChange={(e) => setMult({ ...mult, [p.key]: Number(e.target.value) })} className="flex-1" />
                      <span className="w-8 text-right tabular-nums">×{mult[p.key] ?? 1}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {view === 'active' && reinvite.length > 0 && token && (
              <div className="rounded-xl border border-border bg-white p-3 mb-3">
                <div className="font-extrabold text-[13px] mb-0.5">Ứng viên cũ có thể phù hợp với tin này</div>
                <div className="text-[12px] text-ink-muted mb-2">Từng nộp tin khác của bạn, chưa được nhận. Mời lại chỉ với một cú nhấp.</div>
                <ul className="flex flex-col gap-1.5">
                  {reinvite.map((r) => (
                    <li key={r.profileId} className="flex items-center gap-2 flex-wrap text-[12.5px]">
                      <span className="font-bold">{r.name}</span>
                      <span className="text-ink-muted">{r.title || ''}</span>
                      <span className="rounded px-1.5 py-0.5 text-[11px] font-extrabold bg-primary text-white">{r.score}%</span>
                      <span className="text-ink-muted flex-1 min-w-[160px]">Đã nộp: {r.oldJob}{r.reasons[0] ? ` · ${r.reasons[0]}` : ''}</span>
                      <button
                        type="button"
                        disabled={invited.has(r.profileId)}
                        onClick={async () => {
                          try {
                            await smartApi3.invite(token, r.profileId, jobId);
                            setInvited(new Set(invited).add(r.profileId));
                          } catch (e) {
                            alert(e instanceof Error ? e.message : 'Không mời được');
                          }
                        }}
                        className="rounded-lg border border-primary text-primary font-bold text-[12px] px-2.5 py-1 disabled:opacity-60"
                      >
                        {invited.has(r.profileId) ? 'Đã mời' : 'Mời ứng tuyển'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {view === 'active' && token && (
              <ApplicantBulkTools
                token={token}
                selected={applicants.filter((x) => picked.has(x.id))}
                scores={scores}
                onDone={() => {
                  setPicked(new Set());
                  loadApplicants();
                }}
                onClear={() => setPicked(new Set())}
              />
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
                        {view === 'active' && (
                          <th className="py-2.5 pl-4 pr-0 w-8">
                            <input
                              id="pick-all"
                              type="checkbox"
                              aria-label="Chọn tất cả"
                              checked={applicants.length > 0 && applicants.every((x) => picked.has(x.id))}
                              onChange={(e) => setPicked(e.target.checked ? new Set(applicants.map((x) => x.id)) : new Set())}
                            />
                          </th>
                        )}
                        <th className="py-2.5 px-4 font-semibold">
                          Ứng viên
                          {view === 'active' && Object.keys(scores).length > 0 && (
                            <button type="button" onClick={() => setSortBest((v) => !v)} className="ml-2 rounded-full border border-border px-2 py-0.5 text-[11px] font-bold text-primary">
                              {sortBest ? '↓ Phù hợp nhất' : 'Mới nộp trước'}
                            </button>
                          )}
                          {view === 'active' && flagInfo?.hasScreening && (
                            <button type="button" onClick={() => setPushFail((v) => !v)} className="ml-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-bold text-primary">
                              {pushFail ? '✓ Không đạt sàng lọc xếp cuối' : 'Xếp theo thứ tự thường'}
                            </button>
                          )}
                          {view === 'active' && Object.keys(scores).length > 0 && (
                            <button type="button" onClick={() => setShowWeights((v) => !v)} className="ml-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-bold text-primary">
                              ⚖ Chỉnh trọng số
                            </button>
                          )}
                        </th>
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
                      {(() => {
                        const base = view === 'active' && sortBest ? [...applicants].sort((a, b) => (adjScore(b.id) ?? -1) - (adjScore(a.id) ?? -1)) : applicants;
                        if (view !== 'active' || !flagInfo?.hasScreening || !pushFail) return base;
                        const bad = (id: string) => (flagInfo.screening[id] ?? 0) > 0;
                        return [...base.filter((a) => !bad(a.id)), ...base.filter((a) => bad(a.id))];
                      })().map((app) => (
                        <tr key={app.id} className="border-t border-border align-top">
                          {view === 'active' && (
                            <td className="py-3 pl-4 pr-0">
                              <input
                                id={`pick-${app.id}`}
                                type="checkbox"
                                aria-label="Chọn hồ sơ"
                                checked={picked.has(app.id)}
                                onChange={(e) =>
                                  setPicked((prev) => {
                                    const n = new Set(prev);
                                    if (e.target.checked) n.add(app.id);
                                    else n.delete(app.id);
                                    return n;
                                  })
                                }
                              />
                            </td>
                          )}
                          <td className="py-3 px-4">
                            {app.cv.candidateProfile ? (
                              <>
                                <div className="font-bold">{app.cv.candidateProfile.fullName}</div>
                                <div className="text-ink-faint mt-0.5">
                                  {app.cv.candidateProfile.desiredPosition ?? 'Chưa cập nhật vị trí mong muốn'}
                                </div>
                              </>
                            ) : (
                              // Đợt 22 — khách ứng tuyển không đăng nhập: hiện thẳng thông tin liên hệ họ đã nhập.
                              <>
                                <div className="font-bold">
                                  {app.cv.guestFullName ?? 'Ứng viên'}{' '}
                                  <span className="ml-1 rounded-full bg-surface-alt border border-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted align-middle">
                                    Khách
                                  </span>
                                </div>
                                <div className="text-ink-faint mt-0.5 flex flex-col">
                                  {app.cv.guestPhone && (
                                    <a className="text-primary" href={`tel:${app.cv.guestPhone}`}>
                                      📞 {app.cv.guestPhone}
                                    </a>
                                  )}
                                  {app.cv.guestEmail && (
                                    <a className="text-primary break-all" href={`mailto:${app.cv.guestEmail}`}>
                                      ✉ {app.cv.guestEmail}
                                    </a>
                                  )}
                                </div>
                              </>
                            )}
                            {view === 'active' && (
                              <ReplyTemplates
                                name={app.cv.candidateProfile?.fullName ?? app.cv.guestFullName ?? ''}
                                job={jobs.find((j) => j.id === jobId)?.title ?? ''}
                                company={jobs.find((j) => j.id === jobId)?.company?.name ?? ''}
                                email={app.cv.guestEmail}
                              />
                            )}
                            {view === 'active' && flagInfo?.flags[app.id] && (
                              <div className="mt-1 flex flex-col gap-0.5">
                                {flagInfo.flags[app.id].map((f) => (
                                  <span key={f} className="inline-block w-fit max-w-xs rounded px-1.5 py-0.5 text-[11px] font-bold bg-critical-tint text-critical">⚠ {f}</span>
                                ))}
                              </div>
                            )}
                            {view === 'active' && scores[app.id] && (
                              <div className="mt-1 max-w-xs" title={[...scores[app.id].reasons, ...scores[app.id].gaps.map((g) => `⚠ ${g}`)].join('\n')}>
                                <span
                                  className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-extrabold ${
                                    (adjScore(app.id) ?? 0) >= 80 ? 'bg-success text-white' : (adjScore(app.id) ?? 0) >= 65 ? 'bg-primary text-white' : 'bg-surface-alt border border-border-strong text-ink'
                                  }`}
                                >
                                  Phù hợp {adjScore(app.id)}%
                                </span>
                                {scores[app.id].hot && (
                                  <span className="ml-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-extrabold bg-warning-tint text-[#7A4A00]" title={scores[app.id].hot}>
                                    🔥 Đang quan tâm
                                  </span>
                                )}
                                {scores[app.id].hot && <div className="text-[11.5px] text-[#7A4A00]">{scores[app.id].hot}</div>}
                                <div className="text-[11.5px] text-ink-muted mt-0.5">
                                  {scores[app.id].reasons[0] ?? scores[app.id].gaps[0]}
                                </div>
                                {scores[app.id].parts && (
                                  <details className="mt-0.5">
                                    <summary className="text-[11.5px] text-primary cursor-pointer font-bold">Chi tiết từng tiêu chí</summary>
                                    <ul className="mt-1 flex flex-col gap-0.5">
                                      {scores[app.id].parts!.map((p) => (
                                        <li key={p.key} className="flex items-center gap-1.5 text-[11.5px]">
                                          <span className="w-[76px] shrink-0">{p.label}</span>
                                          <span className="flex-1 h-1.5 rounded bg-surface-alt overflow-hidden"><span className="block h-full bg-primary" style={{ width: `${p.score}%` }} /></span>
                                          <span className="w-8 text-right tabular-nums">{p.score}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </details>
                                )}
                              </div>
                            )}
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
                              {token && (
                                <div className="mt-1.5">
                                  <InterviewScheduler token={token} app={app} onDone={loadApplicants} />
                                </div>
                              )}
                            </td>
                          )}
                          <td className="py-3 px-3">
                            {app.cv.fileUrl ? (
                              <a
                                className="text-primary font-semibold"
                                href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${app.cv.fileUrl}`}
                                onClick={() => token && employerApi.markApplicationViewed(token, app.id).catch(() => undefined)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Xem CV
                              </a>
                            ) : app.cv.externalLinkUrl ? (
                              <a
                                className="text-primary font-semibold"
                                href={app.cv.externalLinkUrl}
                                onClick={() => token && employerApi.markApplicationViewed(token, app.id).catch(() => undefined)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Xem CV (Drive)
                              </a>
                            ) : app.cv.type === 'template' ? (
                              // Đợt 21 — ứng viên ứng tuyển bằng "Hồ sơ trực tuyến" (cách 2, không có file).
                              <button
                                onClick={() => openOnlineProfile(app.id)}
                                className="text-primary font-semibold hover:underline"
                              >
                                📝 Hồ sơ trực tuyến
                              </button>
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

      {profileModal && (
        <OnlineProfileModal
          detail={profileModal.detail}
          loading={profileModal.loading}
          error={profileModal.error}
          onClose={() => setProfileModal(null)}
        />
      )}
    </main>
  );
}

// Đợt 21 (27/09/2026) — hiện nội dung "Hồ sơ trực tuyến" của ứng viên ứng tuyển bằng cách 2 (không có
// file CV), ngay trong trang danh sách ứng viên — không cần điều hướng sang trang khác.
function fmtDateShort(v?: string | null) {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return d && m && y ? `${d}/${m}/${y}` : v;
}
function fmtRangeShort(s?: string | null, e?: string | null, current?: boolean) {
  const from = fmtDateShort(s);
  const to = current ? 'Hiện tại' : fmtDateShort(e);
  return [from, to].filter(Boolean).join(' – ');
}

function OnlineProfileModal({
  detail,
  loading,
  error,
  onClose,
}: {
  detail: CandidateDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="font-extrabold text-sm">Hồ sơ trực tuyến của ứng viên</div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink text-lg leading-none">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="text-center text-ink-faint text-sm py-10">Đang tải...</div>
        ) : error ? (
          <div className="text-critical text-sm font-semibold py-6 text-center">{error}</div>
        ) : !detail ? null : (
          <div className="flex flex-col gap-4 text-[12.5px]">
            <div>
              <div className="font-extrabold text-base text-ink">{detail.fullName}</div>
              {detail.profileTitle && <div className="text-primary font-bold mt-0.5">{detail.profileTitle}</div>}
              <div className="text-ink-faint mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                {detail.phone && <span>📞 {detail.phone}</span>}
                {detail.contactEmail && <span>✉️ {detail.contactEmail}</span>}
                {detail.address && <span>📍 {detail.address}</span>}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-surface-alt px-3.5 py-3">
              <div>
                <span className="font-semibold text-ink">Vị trí mong muốn: </span>
                <span className="text-ink-muted">{detail.desiredPosition || 'Chưa cập nhật'}</span>
              </div>
              <div>
                <span className="font-semibold text-ink">Số năm kinh nghiệm: </span>
                <span className="text-ink-muted">
                  {detail.yearsOfExperience != null ? `${detail.yearsOfExperience} năm` : 'Chưa cập nhật'}
                </span>
              </div>
            </div>

            {detail.careerObjective && (
              <div>
                <div className="font-bold text-ink mb-1">Mục tiêu nghề nghiệp</div>
                <RichTextView value={detail.careerObjective} className="text-ink-muted" />
              </div>
            )}

            {detail.experiences.length > 0 && (
              <div>
                <div className="font-bold text-ink mb-1.5">Kinh nghiệm làm việc</div>
                <div className="flex flex-col gap-2">
                  {detail.experiences.map((e) => (
                    <div key={e.id} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-ink">{e.position}</span>
                        <span className="text-ink-faint text-[11px] shrink-0">
                          {fmtRangeShort(e.startDate, e.endDate, e.isCurrent)}
                        </span>
                      </div>
                      {e.companyName && <div className="text-primary font-semibold text-[11.5px]">{e.companyName}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.educations.length > 0 && (
              <div>
                <div className="font-bold text-ink mb-1.5">Học vấn</div>
                <div className="flex flex-col gap-1.5">
                  {detail.educations.map((e) => (
                    <div key={e.id} className="flex justify-between gap-2">
                      <span className="font-semibold text-ink">{e.schoolName}</span>
                      <span className="text-ink-faint text-[11px] shrink-0">{fmtRangeShort(e.startDate, e.endDate)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.skills.length > 0 && (
              <div>
                <div className="font-bold text-ink mb-1.5">Kỹ năng</div>
                <div className="flex flex-wrap gap-1.5">
                  {detail.skills.map((s) => (
                    <span key={s.id} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface-alt text-ink-muted">
                      {s.skillName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function UngVienPage() {
  return (
    <Suspense fallback={null}>
      <UngVienPageInner />
    </Suspense>
  );
}
