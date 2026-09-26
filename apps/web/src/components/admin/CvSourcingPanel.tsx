'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  adminSourcingApi,
  ApiError,
  type CvCardDraftResponse,
  type CvQueueResponse,
  type CvShareStatus,
  type ProfileRequestRow,
  type RealProfileState,
  type SourcedProfileRow,
} from '@/lib/api';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { Modal } from '@/components/profile/ui';
import { CandidateDraftForm } from '@/components/cv/CandidateDraftForm';
import { CvFileContent } from '@/components/cv/CvFileContent';

// Đợt 18c (26/09/2026) — Admin "Nguồn ngoài → CV ứng viên":
//  1. Hàng chờ chia sẻ: mọi CV ứng viên đã nộp cho 1 NTD (+ CV NTD tự nhập) → Admin duyệt thủ công hoặc
//     bật "Tự động sau 15 phút" để đăng lại thành hồ sơ "Nguồn tổng hợp" cho các NTD KHÁC tìm thấy.
//  2. Hồ sơ nguồn tổng hợp: danh sách + Admin tự tạo (dán nội dung / file CV / link / nhập tay).
//  3. Yêu cầu gỡ / nhận lại hồ sơ của người thật (trang công khai /yeu-cau-ho-so).

const STATUS_TABS: { key: CvShareStatus; label: string }[] = [
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'shared', label: 'Đã chia sẻ' },
  { key: 'already_public', label: 'Đã công khai sẵn' },
  { key: 'dismissed', label: 'Đã bỏ qua' },
];

const REAL_STATE: Record<RealProfileState, { label: string; cls: string; title: string }> = {
  none: { label: 'Chưa có tài khoản', cls: 'bg-surface-alt text-ink-muted', title: 'CV do NTD nhập từ nguồn ngoài' },
  deleted: { label: 'Đã xoá tài khoản', cls: 'bg-warning-tint text-warning', title: 'Ứng viên đã xoá tài khoản — chỉ còn bản lưu trong Kho CV' },
  public: { label: 'Đang công khai', cls: 'bg-success-tint text-success', title: 'Hồ sơ thật đã hiện trong Tìm CV — không cần tạo bản sao' },
  locked: { label: 'Để Khoá', cls: 'bg-critical-tint text-critical', title: 'Ứng viên đang để hồ sơ ở chế độ Khoá (không cho NTD tìm)' },
  not_searchable: { label: 'Hồ sơ chưa hoàn thiện', cls: 'bg-info-tint text-info', title: 'Hồ sơ thật chưa có chức danh nên chưa hiện trong Tìm CV' },
};

export function CvSourcingPanel({ token }: { token: string }) {
  const [sub, setSub] = useState<'queue' | 'profiles' | 'requests'>('queue');
  const [summary, setSummary] = useState<{ pending: number; sourced: number; requests: number; sharedLast7Days: number } | null>(null);
  const [auto, setAuto] = useState<{ enabled: boolean; enabledAt: string | null } | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);

  const loadSummary = useCallback(async () => {
    const [s, a] = await Promise.all([adminSourcingApi.summary(token), adminSourcingApi.getAutoShare(token)]);
    setSummary(s);
    setAuto(a);
  }, [token]);

  useEffect(() => {
    loadSummary().catch(() => undefined);
  }, [loadSummary]);

  async function toggleAuto() {
    if (!auto) return;
    if (!auto.enabled && !confirm('Bật tự động: mọi CV ứng viên nộp TỪ BÂY GIỜ sẽ tự đăng lại cho NTD khác sau 15 phút (nếu Admin chưa xử lý). CV cũ trong hàng chờ không bị ảnh hưởng. Tiếp tục?')) return;
    setAutoBusy(true);
    try {
      setAuto(await adminSourcingApi.setAutoShare(token, !auto.enabled));
    } finally {
      setAutoBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile value={summary?.pending} label="CV chờ duyệt chia sẻ" />
        <Tile value={summary?.sourced} label="Hồ sơ nguồn tổng hợp" />
        <Tile value={summary?.sharedLast7Days} label="Đã chia sẻ 7 ngày qua" />
        <Tile value={summary?.requests} label="Yêu cầu gỡ / nhận lại" />
      </div>

      <div className="rounded-xl bg-white border border-border p-4 flex flex-wrap items-center gap-3 justify-between">
        <div className="text-xs max-w-2xl">
          <div className="font-bold text-ink text-[13px]">Tự động chia sẻ sau 15 phút</div>
          <div className="text-ink-faint mt-0.5">
            Bật thì CV ứng viên nộp cho 1 NTD sẽ tự đăng lại thành hồ sơ “Nguồn tổng hợp” cho NTD khác sau 15 phút nếu Admin chưa
            duyệt/bỏ qua. Chỉ áp dụng cho CV nộp <b>sau lúc bật</b>. Công ty nhận CV gốc không thấy bản sao; ứng viên đã chặn công ty nào
            thì bản sao cũng chặn công ty đó.
            {auto?.enabled && auto.enabledAt && <> Đang bật từ {formatDateTime(auto.enabledAt)}.</>}
          </div>
        </div>
        <button
          onClick={toggleAuto}
          disabled={!auto || autoBusy}
          role="switch"
          aria-checked={!!auto?.enabled}
          className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${auto?.enabled ? 'bg-success' : 'bg-border-strong'} disabled:opacity-50`}
          title={auto?.enabled ? 'Đang bật — bấm để tắt' : 'Đang tắt — bấm để bật'}
        >
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${auto?.enabled ? 'left-6' : 'left-1'}`} />
        </button>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {(
          [
            { key: 'queue', label: 'Hàng chờ chia sẻ' },
            { key: 'profiles', label: 'Hồ sơ nguồn tổng hợp' },
            { key: 'requests', label: `Yêu cầu gỡ / nhận lại${summary?.requests ? ` (${formatNumber(summary.requests)})` : ''}` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            className={`px-3.5 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 -mb-px ${
              sub === t.key ? 'text-primary border-primary' : 'text-ink-faint border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'queue' ? (
        <QueueView token={token} onChanged={loadSummary} />
      ) : sub === 'profiles' ? (
        <SourcedProfilesView token={token} onChanged={loadSummary} />
      ) : (
        <RequestsView token={token} onChanged={loadSummary} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------

function QueueView({ token, onChanged }: { token: string; onChanged: () => void }) {
  const [status, setStatus] = useState<CvShareStatus>('pending');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CvQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminSourcingApi.queue(token, { status, q, page, pageSize: 20 }));
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Không tải được hàng chờ' });
    } finally {
      setLoading(false);
    }
  }, [token, status, q, page]);

  useEffect(() => {
    load();
    setSelected(new Set());
  }, [load]);

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
      setSelected(new Set());
      await load();
      onChanged();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Thao tác không thành công' });
    } finally {
      setBusy(null);
    }
  }

  const shareOne = (id: string, name: string) =>
    run(id, async () => {
      const r = await adminSourcingApi.share(token, id);
      return r.status === 'already_public'
        ? `${name}: hồ sơ thật đã công khai trong Tìm CV — không tạo bản sao.`
        : `Đã chia sẻ hồ sơ của ${name} cho các NTD khác.`;
    });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const ids = data?.items.map((i) => i.id) ?? [];
  const allChecked = ids.length > 0 && ids.every((id) => selected.has(id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setStatus(t.key);
              setPage(1);
            }}
            className={`text-[11.5px] font-bold rounded-full px-3 py-1.5 border ${
              status === t.key ? 'bg-primary text-white border-primary' : 'bg-white text-ink-muted border-border'
            }`}
          >
            {t.label}
            {data ? ` (${formatNumber(data.counts[t.key] ?? 0)})` : ''}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="tvl-input !w-auto flex-1 min-w-[220px] text-sm"
          placeholder="Tìm theo tên, SĐT, email, vị trí, kỹ năng, tên công ty… (gõ không dấu được)"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        {status === 'pending' && selected.size > 0 && (
          <>
            <button
              disabled={!!busy}
              onClick={() =>
                run('bulk', async () => {
                  const r = await adminSourcingApi.bulkShare(token, Array.from(selected));
                  return `Đã chia sẻ ${r.shared}, đã công khai sẵn ${r.alreadyPublic}${r.failed ? `, lỗi ${r.failed}` : ''}.`;
                })
              }
              className="tvl-btn-primary !w-auto px-3.5 text-xs"
            >
              Chia sẻ {selected.size} CV đã chọn
            </button>
            <button
              disabled={!!busy}
              onClick={() =>
                run('bulk', async () => {
                  const r = await adminSourcingApi.bulkDismiss(token, Array.from(selected));
                  return `Đã bỏ qua ${r.dismissed} CV.`;
                })
              }
              className="tvl-btn-ghost !w-auto px-3.5 text-xs"
            >
              Bỏ qua
            </button>
          </>
        )}
      </div>

      {msg && (
        <div className={`rounded-lg text-xs font-semibold px-3.5 py-2.5 ${msg.ok ? 'bg-success-tint text-success' : 'bg-critical-tint text-critical'}`}>
          {msg.text}
        </div>
      )}

      <div className="rounded-xl bg-white border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-ink-faint bg-surface-alt">
                {status === 'pending' && (
                  <th className="py-2.5 pl-4 w-8">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả"
                      checked={allChecked}
                      onChange={() => setSelected(allChecked ? new Set() : new Set(ids))}
                    />
                  </th>
                )}
                <th className="py-2.5 px-4 font-semibold">Ứng viên</th>
                <th className="py-2.5 px-3 font-semibold">Nộp cho / vị trí</th>
                <th className="py-2.5 px-3 font-semibold">Hồ sơ thật</th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Ngày nộp</th>
                <th className="py-2.5 px-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className={loading ? 'opacity-60' : ''}>
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-ink-faint py-10">
                    {loading ? 'Đang tải…' : 'Không có CV nào.'}
                  </td>
                </tr>
              )}
              {data?.items.map((c) => {
                const st = REAL_STATE[c.realProfileState];
                return (
                  <tr key={c.id} className="border-t border-border align-top">
                    {status === 'pending' && (
                      <td className="py-3 pl-4">
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${c.fullName}`}
                          checked={selected.has(c.id)}
                          onChange={() =>
                            setSelected((prev) => {
                              const n = new Set(prev);
                              if (n.has(c.id)) n.delete(c.id);
                              else n.add(c.id);
                              return n;
                            })
                          }
                        />
                      </td>
                    )}
                    <td className="py-3 px-4 min-w-[200px]">
                      <div className="font-bold text-ink">{c.fullName}</div>
                      {c.headline && <div className="text-primary font-semibold">{c.headline}</div>}
                      <div className="text-ink-faint mt-0.5">
                        {[c.phone, c.email, c.province, c.yearsOfExperience != null ? `${c.yearsOfExperience} năm KN` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      {c.skills.length > 0 && <div className="text-ink-faint mt-0.5 truncate max-w-[280px]">🛠 {c.skills.join(', ')}</div>}
                    </td>
                    <td className="py-3 px-3 min-w-[160px]">
                      <div className="font-semibold text-ink">{c.companyName}</div>
                      <div className="text-ink-faint">{c.positions.join(' · ')}</div>
                      {c.fromImport && (
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-alt text-ink-muted">
                          NTD nhập từ nguồn ngoài
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span title={st.title} className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 tabular-nums whitespace-nowrap">
                      {formatDate(c.lastAppliedAt)}
                      {c.shareDecidedAt && status !== 'pending' && (
                        <div className="text-ink-faint">xử lý {formatDate(c.shareDecidedAt)}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex gap-1.5 justify-end flex-wrap">
                        <button
                          onClick={() => setReviewId(c.id)}
                          className="text-[11px] font-bold rounded-md bg-surface-alt text-ink px-2.5 py-1.5 hover:text-primary"
                        >
                          Xem
                        </button>
                        {status === 'pending' && (
                          <>
                            <button
                              disabled={busy === c.id}
                              onClick={() => shareOne(c.id, c.fullName)}
                              className="text-[11px] font-bold rounded-md bg-success-tint text-success px-2.5 py-1.5 disabled:opacity-50"
                            >
                              Chia sẻ
                            </button>
                            <button
                              disabled={busy === c.id}
                              onClick={() =>
                                run(c.id, async () => {
                                  await adminSourcingApi.dismiss(token, c.id);
                                  return `Đã bỏ qua CV của ${c.fullName}.`;
                                })
                              }
                              className="text-[11px] font-bold rounded-md bg-critical-tint text-critical px-2.5 py-1.5 disabled:opacity-50"
                            >
                              Bỏ qua
                            </button>
                          </>
                        )}
                        {(status === 'dismissed' || status === 'already_public') && (
                          <button
                            disabled={busy === c.id}
                            onClick={() =>
                              run(c.id, async () => {
                                await adminSourcingApi.requeue(token, c.id);
                                return `Đã đưa CV của ${c.fullName} lại hàng chờ.`;
                              })
                            }
                            className="text-[11px] font-bold rounded-md bg-info-tint text-info px-2.5 py-1.5 disabled:opacity-50"
                          >
                            Đưa lại hàng chờ
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {data && totalPages > 1 && <Pager page={page} totalPages={totalPages} onPage={setPage} />}

      {reviewId && (
        <ReviewModal
          token={token}
          cardId={reviewId}
          onClose={() => setReviewId(null)}
          onDone={async (text) => {
            setReviewId(null);
            setMsg({ ok: true, text });
            await load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function ReviewModal({
  token,
  cardId,
  onClose,
  onDone,
}: {
  token: string;
  cardId: string;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const [data, setData] = useState<CvCardDraftResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminSourcingApi
      .draft(token, cardId)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không tải được CV'));
  }, [token, cardId]);

  async function openFile(entryId: string) {
    const blob = await adminSourcingApi.downloadEntryFile(token, entryId);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const st = data ? REAL_STATE[data.realProfileState] : null;
  const latest = data?.card.entries[0];

  return (
    <Modal title={data ? `CV: ${data.card.fullName}` : 'Đang tải CV…'} onClose={onClose} wide>
      {error && <div className="rounded-lg bg-critical-tint text-critical text-xs font-semibold px-3.5 py-2.5">{error}</div>}
      {!data && !error && <div className="text-center text-ink-faint text-sm py-10">Đang tải…</div>}
      {data && (
        <div className="flex flex-col gap-4">
          <div className="text-xs flex flex-wrap gap-2 items-center">
            <span>
              Nộp cho <b>{data.companyName}</b>
            </span>
            {st && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>}
            {data.card.entries.map((e) =>
              e.cvHasFile ? (
                <button key={e.id} onClick={() => openFile(e.id)} className="text-[11.5px] font-bold text-primary hover:underline">
                  📄 {e.cvFileName || 'File CV'}
                </button>
              ) : null,
            )}
          </div>
          {latest && <CvFileContent entry={latest} />}
          {data.shareStatus === 'shared' ? (
            <div className="rounded-lg bg-success-tint text-success text-xs font-semibold px-3.5 py-2.5">Đã chia sẻ thành hồ sơ nguồn tổng hợp.</div>
          ) : data.realProfileState === 'public' ? (
            <div className="rounded-lg bg-info-tint text-info text-xs font-semibold px-3.5 py-2.5">
              Hồ sơ thật của ứng viên đang công khai trong Tìm CV — NTD khác đã tìm thấy được, không cần tạo bản sao.
            </div>
          ) : data.draft ? (
            <>
              <p className="text-[12px] text-ink-faint">
                Kiểm tra và sửa bản hồ sơ sẽ đăng cho NTD khác (ưu tiên dữ liệu hồ sơ online, bổ sung từ file CV). NTD khác xem miễn phí
                phần tóm tắt, mở khoá liên hệ trừ 1 lượt như hồ sơ thường.
              </p>
              <CandidateDraftForm
                token={token}
                initialDraft={data.draft}
                requireTitle
                allowAttachFile={false}
                submitLabel="Chia sẻ cho NTD khác"
                onCancel={onClose}
                onSubmit={async (draft) => {
                  const r = await adminSourcingApi.share(token, cardId, draft);
                  onDone(
                    r.status === 'already_public'
                      ? 'Hồ sơ thật đã công khai sẵn — không tạo bản sao.'
                      : `Đã chia sẻ hồ sơ của ${draft.fullName} cho các NTD khác.`,
                  );
                }}
              />
            </>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------------

function SourcedProfilesView({ token, onChanged }: { token: string; onChanged: () => void }) {
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: SourcedProfileRow[]; total: number; pageSize: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async () => {
    setData(await adminSourcingApi.profiles(token, { q, page, pageSize: 20 }));
  }, [token, q, page]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  async function remove(p: SourcedProfileRow) {
    if (!confirm(`Xoá vĩnh viễn hồ sơ nguồn tổng hợp "${p.fullName}"? NTD đã mở khoá cũng không xem được nữa.`)) return;
    setBusy(p.id);
    try {
      await adminSourcingApi.deleteProfile(token, p.id);
      setMsg({ ok: true, text: `Đã xoá hồ sơ ${p.fullName}.` });
      await load();
      onChanged();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Không xoá được' });
    } finally {
      setBusy(null);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="tvl-input !w-auto flex-1 min-w-[220px] text-sm"
          placeholder="Tìm theo tên, chức danh, nguồn, SĐT, email…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <button onClick={() => setCreating(true)} className="tvl-btn-accent !w-auto px-4 text-xs whitespace-nowrap">
          ＋ Tạo hồ sơ nguồn tổng hợp
        </button>
      </div>
      {msg && (
        <div className={`rounded-lg text-xs font-semibold px-3.5 py-2.5 ${msg.ok ? 'bg-success-tint text-success' : 'bg-critical-tint text-critical'}`}>
          {msg.text}
        </div>
      )}
      <div className="rounded-xl bg-white border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-ink-faint bg-surface-alt">
                <th className="py-2.5 px-4 font-semibold">Hồ sơ</th>
                <th className="py-2.5 px-3 font-semibold">Liên hệ</th>
                <th className="py-2.5 px-3 font-semibold">Nguồn</th>
                <th className="py-2.5 px-3 font-semibold text-right">Lượt mở khoá</th>
                <th className="py-2.5 px-3 font-semibold">Ngày tạo</th>
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody>
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-ink-faint py-10">
                    Chưa có hồ sơ nguồn tổng hợp nào.
                  </td>
                </tr>
              )}
              {data?.items.map((p) => (
                <tr key={p.id} className="border-t border-border align-top">
                  <td className="py-3 px-4">
                    <div className="font-bold">{p.fullName}</div>
                    <div className="text-primary font-semibold">{p.profileTitle ?? '—'}</div>
                    <div className="text-ink-faint">
                      {p.province ?? ''} · hoàn thiện {formatNumber(p.completionPercent)}%
                    </div>
                  </td>
                  <td className="py-3 px-3 text-ink-muted">
                    {p.phone && <div>{p.phone}</div>}
                    {p.email && <div>{p.email}</div>}
                  </td>
                  <td className="py-3 px-3 text-ink-muted max-w-[240px] break-words">{p.sourceLabel ?? '—'}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{formatNumber(p.unlockCount)}</td>
                  <td className="py-3 px-3 tabular-nums whitespace-nowrap">{formatDate(p.createdAt)}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      disabled={busy === p.id}
                      onClick={() => remove(p)}
                      className="text-[11px] font-bold rounded-md bg-critical-tint text-critical px-2.5 py-1.5 disabled:opacity-50"
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {data && totalPages > 1 && <Pager page={page} totalPages={totalPages} onPage={setPage} />}

      {creating && (
        <Modal title="Tạo hồ sơ nguồn tổng hợp" onClose={() => setCreating(false)} wide>
          <CandidateDraftForm
            token={token}
            requireTitle
            submitLabel="Đăng hồ sơ cho NTD tìm"
            sourceHint="CV ứng viên chưa gửi cho NTD nào (nhóm Facebook, website việc làm, file CV…). Hồ sơ hiện trong Tìm CV với nhãn “Nguồn tổng hợp”; người thật có thể yêu cầu gỡ hoặc nhận lại."
            onCancel={() => setCreating(false)}
            onSubmit={async (draft, file) => {
              await adminSourcingApi.createProfile(token, draft, file);
              setCreating(false);
              setMsg({ ok: true, text: `Đã tạo hồ sơ nguồn tổng hợp cho ${draft.fullName}.` });
              await load();
              onChanged();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------

function RequestsView({ token, onChanged }: { token: string; onChanged: () => void }) {
  const [status, setStatus] = useState<'pending' | 'resolved' | 'rejected'>('pending');
  const [rows, setRows] = useState<ProfileRequestRow[] | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await adminSourcingApi.requests(token, status);
    setRows(r);
    setPick(Object.fromEntries(r.filter((x) => x.matches.length).map((x) => [x.id, x.matches[0].id])));
  }, [token, status]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  async function act(r: ProfileRequestRow, kind: 'remove' | 'claim' | 'reject') {
    const profileId = pick[r.id];
    if (kind !== 'reject' && !profileId) return setMsg({ ok: false, text: 'Chọn hồ sơ khớp trước khi xử lý.' });
    if (kind === 'remove' && !confirm('Gỡ (xoá vĩnh viễn) hồ sơ nguồn tổng hợp đã chọn?')) return;
    const note = kind === 'reject' ? (prompt('Lý do từ chối (không bắt buộc):') ?? undefined) : undefined;
    setBusy(r.id);
    setMsg(null);
    try {
      if (kind === 'remove') {
        await adminSourcingApi.resolveRemove(token, r.id, profileId);
        setMsg({ ok: true, text: `Đã gỡ hồ sơ theo yêu cầu của ${r.fullName}.` });
      } else if (kind === 'claim') {
        const res = await adminSourcingApi.resolveClaim(token, r.id, profileId);
        setMsg({
          ok: true,
          text: `Đã chuyển giao hồ sơ cho ${res.email} — mật khẩu tạm: ${res.tempPassword} (chỉ hiện 1 lần, hãy báo cho người dùng và nhắc đổi mật khẩu).`,
        });
      } else {
        await adminSourcingApi.reject(token, r.id, note);
        setMsg({ ok: true, text: 'Đã từ chối yêu cầu.' });
      }
      await load();
      onChanged();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Thao tác không thành công' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {(
          [
            ['pending', 'Chờ xử lý'],
            ['resolved', 'Đã xử lý'],
            ['rejected', 'Đã từ chối'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setStatus(k)}
            className={`text-[11.5px] font-bold rounded-full px-3 py-1.5 border ${
              status === k ? 'bg-primary text-white border-primary' : 'bg-white text-ink-muted border-border'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {msg && (
        <div className={`rounded-lg text-xs font-semibold px-3.5 py-2.5 ${msg.ok ? 'bg-success-tint text-success' : 'bg-critical-tint text-critical'}`}>
          {msg.text}
        </div>
      )}
      {rows?.length === 0 && <div className="rounded-xl bg-white border border-border text-center text-ink-faint py-10 text-sm">Không có yêu cầu nào.</div>}
      {rows?.map((r) => (
        <div key={r.id} className="rounded-xl bg-white border border-border p-4 text-xs flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                r.requestType === 'remove' ? 'bg-critical-tint text-critical' : 'bg-success-tint text-success'
              }`}
            >
              {r.requestType === 'remove' ? 'Yêu cầu GỠ hồ sơ' : 'Yêu cầu NHẬN LẠI hồ sơ'}
            </span>
            <span className="font-bold text-[13px]">{r.fullName}</span>
            <span className="text-ink-muted">
              {r.email}
              {r.phone ? ` · ${r.phone}` : ''}
            </span>
            <span className="text-ink-faint ml-auto">{formatDateTime(r.createdAt)}</span>
          </div>
          {r.note && <div className="text-ink-muted italic">&quot;{r.note}&quot;</div>}
          {r.adminNote && status !== 'pending' && <div className="text-ink-faint">Ghi chú xử lý: {r.adminNote}</div>}
          {status === 'pending' && (
            <>
              <div className="font-semibold text-ink mt-1">Hồ sơ nguồn tổng hợp khớp (theo email / SĐT / họ tên):</div>
              {r.matches.length === 0 ? (
                <div className="text-ink-faint">Không tìm thấy hồ sơ khớp — kiểm tra tay ở tab “Hồ sơ nguồn tổng hợp” hoặc từ chối.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {r.matches.map((m) => (
                    <label key={m.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`pick-${r.id}`}
                        checked={pick[r.id] === m.id}
                        onChange={() => setPick((p) => ({ ...p, [r.id]: m.id }))}
                      />
                      <span className="font-semibold">{m.fullName}</span>
                      <span className="text-ink-muted">
                        {[m.profileTitle, m.phone, m.email, m.sourceLabel].filter(Boolean).join(' · ')}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5 justify-end flex-wrap">
                {r.requestType === 'remove' ? (
                  <button
                    disabled={busy === r.id || !r.matches.length}
                    onClick={() => act(r, 'remove')}
                    className="text-[11px] font-bold rounded-md bg-critical-tint text-critical px-2.5 py-1.5 disabled:opacity-50"
                  >
                    Gỡ hồ sơ đã chọn
                  </button>
                ) : (
                  <button
                    disabled={busy === r.id || !r.matches.length}
                    onClick={() => act(r, 'claim')}
                    className="text-[11px] font-bold rounded-md bg-success-tint text-success px-2.5 py-1.5 disabled:opacity-50"
                  >
                    Chuyển giao cho người này
                  </button>
                )}
                <button
                  disabled={busy === r.id}
                  onClick={() => act(r, 'reject')}
                  className="text-[11px] font-bold rounded-md bg-surface-alt text-ink-muted px-2.5 py-1.5 disabled:opacity-50"
                >
                  Từ chối
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------

function Tile({ value, label }: { value?: number; label: string }) {
  return (
    <div className="rounded-xl bg-white border border-border p-4">
      <div className="text-2xl font-extrabold tabular-nums">{value == null ? '—' : formatNumber(value)}</div>
      <div className="text-xs text-ink-faint mt-1">{label}</div>
    </div>
  );
}

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-1.5 text-xs">
      <button
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
        className="px-3 py-1.5 rounded-lg border border-border bg-white font-semibold text-ink-muted disabled:opacity-40"
      >
        ‹ Trước
      </button>
      <span className="px-3 text-ink-muted tabular-nums">
        Trang {formatNumber(page)} / {formatNumber(totalPages)}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="px-3 py-1.5 rounded-lg border border-border bg-white font-semibold text-ink-muted disabled:opacity-40"
      >
        Sau ›
      </button>
    </div>
  );
}
