'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import EmployerHeader from '@/components/EmployerHeader';
import { useAuth } from '@/lib/auth-context';
import {
  cvSearchApi,
  employerApi,
  ApiError,
  type CandidateSearchParams,
  type CandidateSearchItem,
  type CandidateCredits,
  type UnlockedProfileRow,
  type EmployerJob,
} from '@/lib/api';
import { formatSalary, formatDate } from '@/lib/format';
import { ChipsInput, TextInput } from '@/components/profile/ui';

// Đợt 9 — Tìm kiếm hồ sơ ứng viên cho nhà tuyển dụng (/nha-tuyen-dung/tim-ho-so). Bộ lọc + danh
// sách + 2 tab (Tìm kiếm / Hồ sơ đã mở) + khối điểm còn lại, theo claude/05-dot-9-tim-ho-so-ung-vien.md.

const LANGUAGE_LEVEL_LABEL: Record<string, string> = {
  native: 'Bản ngữ',
  excellent: 'Rất tốt',
  good: 'Tốt',
  fair: 'Khá',
  beginner: 'Cơ bản',
};
const SKILL_LEVEL_LABEL: Record<string, string> = {
  beginner: 'Cơ bản',
  intermediate: 'Trung bình',
  advanced: 'Thành thạo',
  expert: 'Chuyên gia',
};

const PAGE_SIZE = 10;

const EMPTY_FILTERS: CandidateSearchParams = {
  q: '',
  industries: [],
  locations: [],
  skills: [],
  desiredLevel: '',
  highestDegree: '',
  experienceMin: undefined,
  experienceMax: undefined,
  salaryMin: undefined,
  salaryMax: undefined,
  urgentOnly: false,
  unlockedOnly: false,
  hiddenOnly: false,
};

export default function TimHoSoPage() {
  const router = useRouter();
  const { me, token } = useAuth();

  const [tab, setTab] = useState<'search' | 'unlocked'>('search');
  const [filters, setFilters] = useState<CandidateSearchParams>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CandidateSearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [credits, setCredits] = useState<CandidateCredits | null>(null);
  const [unlockedRows, setUnlockedRows] = useState<UnlockedProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const loadedOnce = useRef(false);
  // Đợt 12ac (24/09/2026) — icon hành động: ghi chú riêng, mời ứng tuyển, ẩn khỏi danh sách.
  const [jobOptions, setJobOptions] = useState<EmployerJob[] | null>(null);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
    else if (me && !me.role.startsWith('employer')) router.replace('/');
  }, [me, router]);

  const loadCredits = useCallback(async () => {
    if (!token) return;
    try {
      setCredits(await cvSearchApi.getCredits(token));
    } catch {
      /* bỏ qua — không chặn tìm kiếm nếu lỗi tải điểm */
    }
  }, [token]);

  const runSearch = useCallback(async () => {
    if (!token) return;
    if (!loadedOnce.current) setLoading(true);
    try {
      const res = await cvSearchApi.search(token, { ...filters, page, pageSize: PAGE_SIZE });
      setItems(res.items);
      setTotal(res.total);
      loadedOnce.current = true;
    } finally {
      setLoading(false);
    }
  }, [token, filters, page]);

  const loadUnlocked = useCallback(async () => {
    if (!token) return;
    setUnlockedRows(await cvSearchApi.listUnlocked(token));
  }, [token]);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  useEffect(() => {
    if (tab === 'search') runSearch();
    else loadUnlocked();
  }, [tab, runSearch, loadUnlocked]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  function applyFilters() {
    setPage(1);
    runSearch();
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  async function handleUnlock(id: string) {
    if (!token) return;
    try {
      await cvSearchApi.unlock(token, id);
      setToast('Đã mở hồ sơ — bạn có thể xem lại miễn phí sau này.');
      await Promise.all([runSearch(), loadCredits()]);
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Không thể mở hồ sơ, vui lòng thử lại');
    }
  }

  async function ensureJobOptions() {
    if (jobOptions != null || !token) return;
    try {
      const jobs = await employerApi.listJobs(token, 'dang_dang');
      setJobOptions(jobs);
    } catch {
      setJobOptions([]);
    }
  }

  async function refreshCurrentTab() {
    if (tab === 'search') await runSearch();
    else await loadUnlocked();
  }

  async function handleSaveNote(id: string, note: string) {
    if (!token) return;
    try {
      await cvSearchApi.setNote(token, id, { note });
      setToast('Đã lưu ghi chú.');
      await refreshCurrentTab();
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Không thể lưu ghi chú, vui lòng thử lại');
    }
  }

  async function handleToggleHidden(id: string, hidden: boolean) {
    if (!token) return;
    try {
      await cvSearchApi.setNote(token, id, { hidden });
      setToast(hidden ? 'Đã ẩn hồ sơ khỏi danh sách tìm kiếm.' : 'Đã bỏ ẩn hồ sơ.');
      await refreshCurrentTab();
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Không thể cập nhật, vui lòng thử lại');
    }
  }

  async function handleInvite(id: string, jobPostingId: string) {
    if (!token) return;
    try {
      await cvSearchApi.invite(token, id, jobPostingId);
      setToast('Đã gửi lời mời ứng tuyển.');
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Không thể gửi lời mời, vui lòng thử lại');
    }
  }

  if (!me || !me.role.startsWith('employer')) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-bg">
      <EmployerHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1 border-b border-border flex-1">
            <button
              onClick={() => setTab('search')}
              className={`px-3.5 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 -mb-px ${
                tab === 'search' ? 'text-primary border-primary' : 'text-ink-faint border-transparent'
              }`}
            >
              Tìm kiếm hồ sơ
            </button>
            <button
              onClick={() => setTab('unlocked')}
              className={`px-3.5 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 -mb-px ${
                tab === 'unlocked' ? 'text-primary border-primary' : 'text-ink-faint border-transparent'
              }`}
            >
              Hồ sơ đã mở
            </button>
          </div>
          <div className="rounded-lg bg-white border border-border px-3.5 py-2 text-xs flex items-center gap-2 shrink-0">
            <span className="text-ink-faint">Điểm còn lại:</span>
            <span className="font-extrabold text-primary tabular-nums">{credits?.remaining ?? '—'}</span>
            {credits && credits.remaining <= 5 && (
              <Link href="/nha-tuyen-dung/don-hang" className="text-critical font-bold hover:underline ml-1">
                Mua thêm
              </Link>
            )}
          </div>
        </div>

        {toast && <div className="rounded-lg bg-info-tint text-info text-xs font-semibold px-3.5 py-2.5">{toast}</div>}

        {tab === 'search' ? (
          <div className="grid lg:grid-cols-[260px_1fr] gap-4 items-start">
            <aside className="rounded-xl border border-border bg-white p-4 flex flex-col gap-3.5 lg:sticky lg:top-[70px]">
              <div>
                <label className="text-xs font-bold text-ink">Từ khóa</label>
                <TextInput
                  className="mt-1.5"
                  placeholder="Tiêu đề hồ sơ, vị trí, kỹ năng…"
                  value={filters.q}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-ink">Ngành nghề</label>
                <div className="mt-1.5">
                  <ChipsInput
                    value={filters.industries ?? []}
                    onChange={(v) => setFilters((f) => ({ ...f, industries: v }))}
                    placeholder="Nhập rồi Enter"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-ink">Nơi làm việc</label>
                <div className="mt-1.5">
                  <ChipsInput
                    value={filters.locations ?? []}
                    onChange={(v) => setFilters((f) => ({ ...f, locations: v }))}
                    placeholder="Nhập rồi Enter"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-ink">Kỹ năng (khớp tất cả)</label>
                <div className="mt-1.5">
                  <ChipsInput
                    value={filters.skills ?? []}
                    onChange={(v) => setFilters((f) => ({ ...f, skills: v }))}
                    placeholder="Nhập rồi Enter"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-ink">Cấp bậc mong muốn</label>
                <TextInput
                  className="mt-1.5"
                  placeholder="VD: Trưởng nhóm"
                  value={filters.desiredLevel}
                  onChange={(e) => setFilters((f) => ({ ...f, desiredLevel: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-ink">Bằng cấp cao nhất</label>
                <TextInput
                  className="mt-1.5"
                  placeholder="VD: Cử nhân"
                  value={filters.highestDegree}
                  onChange={(e) => setFilters((f) => ({ ...f, highestDegree: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-ink">Số năm kinh nghiệm</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={0}
                    placeholder="Từ"
                    className="tvl-input"
                    value={filters.experienceMin ?? ''}
                    onChange={(e) => setFilters((f) => ({ ...f, experienceMin: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Đến"
                    className="tvl-input"
                    value={filters.experienceMax ?? ''}
                    onChange={(e) => setFilters((f) => ({ ...f, experienceMax: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-ink">Mức lương mong muốn (triệu)</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={0}
                    placeholder="Từ"
                    className="tvl-input"
                    value={filters.salaryMin ?? ''}
                    onChange={(e) => setFilters((f) => ({ ...f, salaryMin: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Đến"
                    className="tvl-input"
                    value={filters.salaryMax ?? ''}
                    onChange={(e) => setFilters((f) => ({ ...f, salaryMax: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={filters.urgentOnly ?? false}
                  onChange={(e) => setFilters((f) => ({ ...f, urgentOnly: e.target.checked }))}
                />
                Chỉ hồ sơ Khẩn cấp
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={filters.unlockedOnly ?? false}
                  onChange={(e) => setFilters((f) => ({ ...f, unlockedOnly: e.target.checked }))}
                />
                Chỉ hồ sơ đã mở
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={filters.hiddenOnly ?? false}
                  onChange={(e) => setFilters((f) => ({ ...f, hiddenOnly: e.target.checked }))}
                />
                Chỉ hồ sơ đã ẩn (để bỏ ẩn)
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={applyFilters} className="tvl-btn-primary !w-auto flex-1 text-xs">
                  Lọc
                </button>
                <button onClick={resetFilters} className="tvl-btn-ghost !w-auto px-3 text-xs">
                  Xóa lọc
                </button>
              </div>
            </aside>

            <div className="flex flex-col gap-3">
              <div className="text-xs text-ink-faint">
                {loading ? 'Đang tải…' : `Tìm thấy ${total} hồ sơ phù hợp`}
              </div>
              {!loading && items.length === 0 && (
                <div className="rounded-xl border border-border bg-white text-center text-ink-faint text-sm py-16">
                  Không có hồ sơ nào khớp với bộ lọc hiện tại.
                </div>
              )}
              <div className="flex flex-col gap-3">
                {items.map((it) => (
                  <CandidateCard
                    key={it.id}
                    item={it}
                    onUnlock={() => handleUnlock(it.id)}
                    jobOptions={jobOptions}
                    onOpenInvite={ensureJobOptions}
                    onSaveNote={(note) => handleSaveNote(it.id, note)}
                    onToggleHidden={(hidden) => handleToggleHidden(it.id, hidden)}
                    onInvite={(jobPostingId) => handleInvite(it.id, jobPostingId)}
                  />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="tvl-btn-ghost !w-auto px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    ← Trước
                  </button>
                  <span className="text-xs text-ink-faint">
                    Trang {page}/{totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="tvl-btn-ghost !w-auto px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    Sau →
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {unlockedRows.length === 0 ? (
              <div className="rounded-xl border border-border bg-white text-center text-ink-faint text-sm py-16">
                Bạn chưa mở hồ sơ ứng viên nào. Các hồ sơ đã mở sẽ xem lại được miễn phí vĩnh viễn.
              </div>
            ) : (
              unlockedRows.map((row) => (
                <div key={row.profile.id} className="flex flex-col gap-1">
                  <CandidateCard
                    item={row.profile}
                    onUnlock={() => handleUnlock(row.profile.id)}
                    jobOptions={jobOptions}
                    onOpenInvite={ensureJobOptions}
                    onSaveNote={(note) => handleSaveNote(row.profile.id, note)}
                    onToggleHidden={(hidden) => handleToggleHidden(row.profile.id, hidden)}
                    onInvite={(jobPostingId) => handleInvite(row.profile.id, jobPostingId)}
                  />
                  <div className="text-[10.5px] text-ink-faint pl-1">Đã mở lúc {formatDate(row.unlockedAt)}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function CandidateCard({
  item,
  onUnlock,
  jobOptions,
  onOpenInvite,
  onSaveNote,
  onToggleHidden,
  onInvite,
}: {
  item: CandidateSearchItem;
  onUnlock: () => void;
  jobOptions: EmployerJob[] | null;
  onOpenInvite: () => void;
  onSaveNote: (note: string) => void;
  onToggleHidden: (hidden: boolean) => void;
  onInvite: (jobPostingId: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(item.note ?? '');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteJobId, setInviteJobId] = useState('');

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2.5 ${item.hidden ? 'border-border bg-surface-alt/60' : 'border-border bg-white'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/nha-tuyen-dung/tim-ho-so/${item.id}`} className="font-extrabold text-[14.5px] hover:text-primary">
              {item.fullName}
            </Link>
            {item.visibility === 'urgent' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-critical-tint text-critical">
                Khẩn cấp
              </span>
            )}
            {item.unlocked && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success-tint text-success">
                Đã mở
              </span>
            )}
            {item.hidden && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-alt text-ink-faint">
                Đã ẩn
              </span>
            )}
          </div>
          <div className="text-primary font-semibold text-[13px] mt-0.5">{item.profileTitle}</div>
          <div className="text-ink-faint text-[11.5px] mt-1">
            {[item.desiredPosition, item.desiredLevel, formatSalary(item.desiredSalaryMin, item.desiredSalaryMax), item.province]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {/* Đợt 12ac (24/09/2026) — icon hành động: ghi chú riêng, mời ứng tuyển, ẩn/bỏ ẩn. */}
          <button
            title="Ghi chú riêng"
            onClick={() => setNoteOpen((v) => !v)}
            className={`h-8 w-8 rounded-lg border text-sm flex items-center justify-center ${
              item.note ? 'border-primary/40 bg-primary/5' : 'border-border bg-white'
            } hover:bg-surface-alt`}
          >
            🏷️
          </button>
          <button
            title="Mời ứng tuyển"
            onClick={() => {
              setInviteOpen((v) => !v);
              onOpenInvite();
            }}
            className="h-8 w-8 rounded-lg border border-border bg-white text-sm flex items-center justify-center hover:bg-surface-alt"
          >
            ✉️
          </button>
          <button
            title={item.hidden ? 'Bỏ ẩn' : 'Ẩn khỏi danh sách'}
            onClick={() => onToggleHidden(!item.hidden)}
            className="h-8 w-8 rounded-lg border border-border bg-white text-sm flex items-center justify-center hover:bg-surface-alt"
          >
            {item.hidden ? '👁️' : '🚫'}
          </button>
          {item.unlocked ? (
            <Link href={`/nha-tuyen-dung/tim-ho-so/${item.id}`} className="tvl-btn-ghost !w-auto px-4 text-xs">
              Xem hồ sơ
            </Link>
          ) : (
            <button onClick={onUnlock} className="tvl-btn-primary !w-auto px-4 text-xs">
              Mở hồ sơ (−1 điểm)
            </button>
          )}
        </div>
      </div>

      {noteOpen && (
        <div className="rounded-lg bg-surface-alt p-2.5 flex flex-col gap-1.5">
          <textarea
            className="tvl-input !h-auto text-xs"
            rows={2}
            placeholder="Ghi chú riêng về ứng viên này (chỉ công ty bạn thấy)…"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setNoteOpen(false)} className="tvl-btn-ghost !w-auto px-3 py-1 text-[11px]">
              Đóng
            </button>
            <button
              onClick={() => {
                onSaveNote(noteDraft);
                setNoteOpen(false);
              }}
              className="tvl-btn-primary !w-auto px-3 py-1 text-[11px]"
            >
              Lưu ghi chú
            </button>
          </div>
        </div>
      )}

      {inviteOpen && (
        <div className="rounded-lg bg-surface-alt p-2.5 flex flex-col gap-1.5">
          {jobOptions == null ? (
            <div className="text-[11px] text-ink-faint">Đang tải danh sách tin đang tuyển…</div>
          ) : jobOptions.length === 0 ? (
            <div className="text-[11px] text-ink-faint">Bạn chưa có tin nào đang đăng để mời ứng viên.</div>
          ) : (
            <>
              <select
                className="tvl-input text-xs"
                value={inviteJobId}
                onChange={(e) => setInviteJobId(e.target.value)}
              >
                <option value="">— Chọn tin tuyển dụng —</option>
                {jobOptions.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button onClick={() => setInviteOpen(false)} className="tvl-btn-ghost !w-auto px-3 py-1 text-[11px]">
                  Đóng
                </button>
                <button
                  disabled={!inviteJobId}
                  onClick={() => {
                    onInvite(inviteJobId);
                    setInviteOpen(false);
                    setInviteJobId('');
                  }}
                  className="tvl-btn-primary !w-auto px-3 py-1 text-[11px] disabled:opacity-40"
                >
                  Gửi lời mời
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {item.latestExperience && (
        <div className="text-[11.5px] text-ink-muted">
          Đang/đã làm: <span className="font-semibold">{item.latestExperience.position}</span>
          {item.latestExperience.companyName && ` tại ${item.latestExperience.companyName}`}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {item.skills.slice(0, 6).map((s) => (
          <span key={s.skillName} className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface-alt text-ink-muted">
            {s.skillName} · {SKILL_LEVEL_LABEL[s.level] ?? s.level}
          </span>
        ))}
        {item.languages.slice(0, 3).map((l) => (
          <span key={l.language} className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-info-tint text-info">
            {l.language} · {LANGUAGE_LEVEL_LABEL[l.level] ?? l.level}
          </span>
        ))}
        {item.yearsOfExperience != null && (
          <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface-alt text-ink-muted">
            {item.yearsOfExperience} năm kinh nghiệm
          </span>
        )}
        {item.highestDegree && (
          <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface-alt text-ink-muted">
            {item.highestDegree}
          </span>
        )}
      </div>
    </div>
  );
}
