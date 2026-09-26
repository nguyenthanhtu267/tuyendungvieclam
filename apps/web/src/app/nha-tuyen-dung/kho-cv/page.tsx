'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import EmployerHeader from '@/components/EmployerHeader';
import { useAuth } from '@/lib/auth-context';
import {
  cvArchiveApi,
  employerApi,
  type EmployerJob,
  ApiError,
  type CvArchiveJobOption,
  type CvArchiveListResponse,
} from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/format';
import { Modal } from '@/components/profile/ui';
import { CandidateDraftForm } from '@/components/cv/CandidateDraftForm';

// Đợt 18a (26/09/2026) — "Kho CV" của nhà tuyển dụng (theo yêu cầu người dùng). Mọi CV ứng viên đã nộp
// cho công ty được hệ thống tự chụp lại TOÀN BỘ (hồ sơ 13 mục + file CV) ngay lúc nộp, lưu vĩnh viễn —
// kể cả khi ứng viên xoá tài khoản. 1 thẻ = 1 người (gộp mọi lần ứng tuyển của cùng 1 người).
// Tìm kiếm "gõ không dấu vẫn ra" theo tên/SĐT/email/vị trí/kỹ năng/công ty từng làm/trường học…

const PAGE_SIZE = 20;

export default function KhoCvPage() {
  const router = useRouter();
  const { me, token } = useAuth();

  const [view, setView] = useState<'active' | 'trash'>('active');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [jobId, setJobId] = useState('');
  const [page, setPage] = useState(1);
  const [jobs, setJobs] = useState<CvArchiveJobOption[]>([]);
  const [data, setData] = useState<CvArchiveListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Đợt 18d (26/09/2026) — "＋ Thêm CV" từ nguồn ngoài (email, Zalo, Facebook, file…).
  const [importOpen, setImportOpen] = useState(false);
  const [importJobId, setImportJobId] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const [myJobs, setMyJobs] = useState<EmployerJob[]>([]);

  useEffect(() => {
    if (!token || !importOpen || myJobs.length) return;
    employerApi
      .listJobs(token)
      .then(setMyJobs)
      .catch(() => setMyJobs([]));
  }, [token, importOpen, myJobs.length]);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
    else if (me && !me.role.startsWith('employer')) router.replace('/');
  }, [me, router]);

  // Gõ tới đâu tìm tới đó nhưng chờ 350ms sau lần gõ cuối để không gọi API mỗi ký tự.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    if (!token) return;
    cvArchiveApi
      .listJobs(token)
      .then(setJobs)
      .catch(() => setJobs([]));
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setData(await cvArchiveApi.list(token, { q, jobId, trash: view === 'trash', page, pageSize: PAGE_SIZE }));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được Kho CV');
    } finally {
      setLoading(false);
    }
  }, [token, q, jobId, view, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleTrash(id: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await cvArchiveApi.trash(token, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xoá được hồ sơ');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRestore(id: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await cvArchiveApi.restore(token, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không khôi phục được hồ sơ');
    } finally {
      setBusyId(null);
    }
  }

  if (!me || !me.role.startsWith('employer')) return null;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const hasFilters = !!q || !!jobId;

  return (
    <main className="min-h-screen bg-bg">
      <EmployerHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-[240px]">
          <h1 className="font-extrabold text-base uppercase">Kho CV</h1>
          <p className="text-[12px] text-ink-faint mt-1 max-w-3xl">
            Mọi CV ứng viên đã nộp cho công ty bạn được tự động lưu lại đầy đủ (hồ sơ, quá trình làm việc, học vấn,
            kỹ năng, file CV…) ngay khi nộp — lưu vĩnh viễn, vẫn còn kể cả khi ứng viên xoá tài khoản. Cùng 1 người
            ứng tuyển nhiều vị trí được gộp chung 1 thẻ.
          </p>
          </div>
          <button
            onClick={() => {
              setImportJobId('');
              setImportOpen(true);
            }}
            className="tvl-btn-accent !w-auto px-4 text-xs whitespace-nowrap"
          >
            ＋ Thêm CV từ nguồn ngoài
          </button>
        </div>

        {flash && <div className="rounded-lg bg-success-tint text-success text-xs font-semibold px-3.5 py-2.5">{flash}</div>}

        {importOpen && token && (
          <Modal title="Thêm CV vào Kho CV" onClose={() => setImportOpen(false)} wide>
            <CandidateDraftForm
              token={token}
              submitLabel="Lưu vào Kho CV"
              sourceHint="CV nhận qua email, Zalo, Facebook, file… — dán nội dung, tải file hoặc dán link, hệ thống tự tách thông tin để bạn xem lại trước khi lưu."
              extra={
                <label className="flex flex-col gap-1">
                  <span className="text-[11.5px] font-bold text-ink-muted">Gắn với tin tuyển dụng (không bắt buộc)</span>
                  <select className="tvl-input text-sm" value={importJobId} onChange={(e) => setImportJobId(e.target.value)}>
                    <option value="">— Không gắn tin nào —</option>
                    {myJobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                      </option>
                    ))}
                  </select>
                </label>
              }
              onCancel={() => setImportOpen(false)}
              onSubmit={async (draft, file) => {
                const res = await cvArchiveApi.importCv(token, { ...draft, jobPostingId: importJobId || undefined }, file);
                setImportOpen(false);
                setFlash(`Đã lưu CV của ${draft.fullName} vào Kho CV.`);
                await load();
                router.push(`/nha-tuyen-dung/kho-cv/${res.id}`);
              }}
            />
          </Modal>
        )}

        <div className="flex gap-1 border-b border-border">
          {(
            [
              { key: 'active', label: 'Trong kho', count: data?.activeCount },
              { key: 'trash', label: '🗑 Thùng rác', count: data?.trashCount },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setView(tab.key);
                setPage(1);
              }}
              className={`px-3.5 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 -mb-px ${
                view === tab.key ? 'text-primary border-primary' : 'text-ink-faint border-transparent'
              }`}
            >
              {tab.label}
              {tab.count != null ? ` (${formatNumber(tab.count)})` : ''}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            className="tvl-input !w-auto flex-1 min-w-[220px] text-sm"
            placeholder="Tìm theo tên, SĐT, email, vị trí, kỹ năng, công ty từng làm… (gõ không dấu cũng được)"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
          <select
            className="tvl-input !w-auto text-sm max-w-[320px]"
            value={jobId}
            onChange={(e) => {
              setJobId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả vị trí đã ứng tuyển</option>
            {jobs.map((j) => (
              <option key={j.jobId} value={j.jobId}>
                {j.jobTitle} ({formatNumber(j.count)})
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              className="text-xs font-semibold text-critical px-2"
              onClick={() => {
                setQInput('');
                setQ('');
                setJobId('');
                setPage(1);
              }}
            >
              Xoá bộ lọc
            </button>
          )}
        </div>

        {error && <div className="rounded-lg bg-critical-tint text-critical text-xs font-semibold px-3.5 py-2.5">{error}</div>}

        <div className="flex items-center justify-between text-xs text-ink-faint">
          <span>
            {data ? `${formatNumber(data.total)} ứng viên` : ''}
            {hasFilters && data ? ' phù hợp bộ lọc' : ''}
          </span>
        </div>

        {loading && !data ? (
          <div className="text-center text-ink-faint py-10 text-sm">Đang tải…</div>
        ) : !data || data.items.length === 0 ? (
          <div className="rounded-xl bg-white border border-border text-center text-ink-faint py-12 text-sm">
            {view === 'trash'
              ? 'Thùng rác trống.'
              : hasFilters
                ? 'Không tìm thấy ứng viên nào phù hợp.'
                : 'Kho CV chưa có hồ sơ nào — CV sẽ tự động vào kho mỗi khi có ứng viên ứng tuyển tin của bạn.'}
          </div>
        ) : (
          <div className={`flex flex-col gap-2.5 ${loading ? 'opacity-60' : ''}`}>
            {data.items.map((c) => (
              <div key={c.id} className="rounded-xl bg-white border border-border p-4 flex flex-wrap gap-4 items-start">
                <div className="w-11 h-11 rounded-full bg-primary-tint text-primary flex items-center justify-center font-bold text-sm shrink-0">
                  {initials(c.fullName)}
                </div>
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/nha-tuyen-dung/kho-cv/${c.id}`} className="font-bold text-[14px] text-ink hover:text-primary">
                      {c.fullName}
                    </Link>
                    {c.applicationCount > 1 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-info-tint text-info">
                        {formatNumber(c.applicationCount)} lần ứng tuyển
                      </span>
                    )}
                    {c.positions.some((p) => p.entrySource === 'employer_import') && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-alt text-ink-muted">
                        Nhập từ nguồn ngoài
                      </span>
                    )}
                    {c.accountDeleted && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning-tint text-warning"
                        title="Ứng viên đã xoá tài khoản — dữ liệu trong kho vẫn còn đầy đủ"
                      >
                        Tài khoản đã xoá
                      </span>
                    )}
                  </div>
                  {c.headline && <div className="text-primary font-semibold text-[12.5px] mt-0.5">{c.headline}</div>}
                  <div className="text-[12px] text-ink-muted mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {c.phone && <span>📞 {c.phone}</span>}
                    {c.email && <span>✉️ {c.email}</span>}
                    {c.province && <span>📍 {c.province}</span>}
                    {c.yearsOfExperience != null && <span>💼 {formatNumber(c.yearsOfExperience)} năm kinh nghiệm</span>}
                  </div>
                  {c.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.skills.slice(0, 6).map((s) => (
                        <span key={s} className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface-alt text-ink-muted">
                          {s}
                        </span>
                      ))}
                      {c.skills.length > 6 && (
                        <span className="text-[10.5px] text-ink-faint px-1">+{formatNumber(c.skills.length - 6)}</span>
                      )}
                    </div>
                  )}
                  <div className="text-[11.5px] text-ink-faint mt-2">
                    Đã ứng tuyển:{' '}
                    {c.positions.slice(0, 3).map((p, i) => (
                      <span key={p.entryId}>
                        {i > 0 && ' · '}
                        <span className="font-semibold text-ink-muted">{p.jobTitle}</span> ({formatDate(p.appliedAt)})
                      </span>
                    ))}
                    {c.positions.length > 3 && <span> · +{formatNumber(c.positions.length - 3)} vị trí khác</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 items-stretch">
                  <Link href={`/nha-tuyen-dung/kho-cv/${c.id}`} className="tvl-btn-primary !w-auto px-4 text-xs text-center">
                    Xem hồ sơ
                  </Link>
                  {view === 'active' ? (
                    <button
                      onClick={() => handleTrash(c.id)}
                      disabled={busyId === c.id}
                      className="tvl-btn-ghost !w-auto px-4 text-xs disabled:opacity-50"
                    >
                      {busyId === c.id ? 'Đang xoá…' : 'Đưa vào thùng rác'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRestore(c.id)}
                      disabled={busyId === c.id}
                      className="tvl-btn-ghost !w-auto px-4 text-xs disabled:opacity-50"
                    >
                      {busyId === c.id ? 'Đang khôi phục…' : 'Khôi phục'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {data && totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 text-xs">
            <PageButton label="« Đầu tiên" disabled={page === 1} onClick={() => setPage(1)} />
            <PageButton label="‹ Trước" disabled={page === 1} onClick={() => setPage(page - 1)} />
            <span className="px-3 text-ink-muted tabular-nums">
              Trang {formatNumber(page)} / {formatNumber(totalPages)}
            </span>
            <PageButton label="Sau ›" disabled={page >= totalPages} onClick={() => setPage(page + 1)} />
            <PageButton label="Cuối cùng »" disabled={page >= totalPages} onClick={() => setPage(totalPages)} />
          </div>
        )}
      </div>
    </main>
  );
}

function PageButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-lg border border-border bg-white font-semibold text-ink-muted hover:text-primary disabled:opacity-40 disabled:hover:text-ink-muted"
    >
      {label}
    </button>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}
