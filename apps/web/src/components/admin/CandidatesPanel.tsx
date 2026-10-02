'use client';

import { Combobox } from '@/components/ui/Combobox';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, type AdminCandidateDetail, type AdminCandidateQuery, type AdminCandidateRow, type ProfileVisibility, type SuggestedJob } from '@/lib/api';
import { adminCandidatesApi } from '@/lib/api-admin';
import { APPLICATION_STATUS_LABEL, formatNumber, formatSalary, formatTimeDate } from '@/lib/format';
import { PROVINCES } from '@/lib/catalogs';
import { Modal } from '@/components/profile/ui';
import { Pager } from './CvSourcingPanel';
import { SortTh, useSort } from '@/components/ui/SortTh';

// Đợt 18f (26/09/2026) — Admin "Ứng viên": quản lý thông minh MỌI hồ sơ ứng viên, kể cả hồ sơ tự nhập
// trên web / file CV mà chưa từng gửi cho NTD nào:
//  - Tìm & lọc: từ khoá (tên, chức danh, kỹ năng, vị trí từng làm, SĐT, email — gõ không dấu), đã/chưa
//    ứng tuyển, chế độ hồ sơ, % hoàn thiện, tỉnh/thành, kỹ năng, thẻ Admin, nguồn tổng hợp.
//  - Thẻ + ghi chú nội bộ (chỉ Admin thấy).
//  - Gợi ý tin phù hợp (theo quy tắc) + “Mời ứng tuyển” (gửi thông báo cho ứng viên).
//  - Chuyển thành hồ sơ nguồn tổng hợp (hồ sơ chưa hiện trong Tìm CV).

const VIS: Record<ProfileVisibility, { label: string; cls: string }> = {
  public: { label: 'Công khai', cls: 'bg-success-tint text-success' },
  urgent: { label: 'Tìm việc gấp', cls: 'bg-accent/10 text-accent' },
  locked: { label: 'Khoá', cls: 'bg-critical-tint text-critical' },
};

const COLS: [string, string][] = [
  ['phone', 'Điện thoại'], ['email', 'Email'], ['position', 'Chức danh'], ['province', 'Tỉnh/TP'], ['exp', 'Kinh nghiệm'],
  ['completion', 'Hoàn thiện'], ['visibility', 'Chế độ hồ sơ'], ['account', 'Tài khoản'], ['applications', 'Số đơn'],
  ['lastApplied', 'Ứng tuyển gần nhất'], ['updatedAt', 'Cập nhật'], ['tags', 'Thẻ / ghi chú'],
];

export function CandidatesPanel({ token, embedded = false }: { token: string; embedded?: boolean }) {
  const [filters, setFilters] = useState<AdminCandidateQuery>({});
  const [qInput, setQInput] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [page, setPage] = useState(1);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [data, setData] = useState<{ items: AdminCandidateRow[]; total: number; pageSize: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, q: qInput.trim() || undefined, skill: skillInput.trim() || undefined }));
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput, skillInput]);

  const loadTags = useCallback(() => {
    adminCandidatesApi
      .tags(token)
      .then(setTags)
      .catch(() => setTags([]));
  }, [token]);

  useEffect(loadTags, [loadTags]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminCandidatesApi.list(token, { ...filters, page, pageSize: 20 }));
    } finally {
      setLoading(false);
    }
  }, [token, filters, page]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  function setF<K extends keyof AdminCandidateQuery>(k: K, v: AdminCandidateQuery[K]) {
    setFilters((f) => ({ ...f, [k]: v || undefined }));
    setPage(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== '');
  const cs = useSort(data?.items, {
    name: (c) => c.fullName,
    tags: (c) => c.tags.join(', '),
    visibility: (c) => VIS[c.visibility]?.label ?? c.visibility,
    applications: (c) => c.applicationCount,
    phone: (c) => c.phone,
    email: (c) => c.contactEmail ?? c.email,
    position: (c) => c.profileTitle ?? c.desiredPosition,
    province: (c) => c.province,
    exp: (c) => c.yearsOfExperience,
    completion: (c) => c.completionPercent,
    account: (c) => (c.userStatus === 'suspended' ? 'Bị khoá' : 'Hoạt động'),
    lastApplied: (c) => (c.lastAppliedAt ? new Date(c.lastAppliedAt) : null),
    updatedAt: (c) => (c.updatedAt ? new Date(c.updatedAt) : null),
  });
  // Đợt 146 — chọn cột hiển thị (nhớ trong trình duyệt); mặc định hiện đủ các cột chính.
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    try { setHidden(JSON.parse(localStorage.getItem('tvl_admin_cand_cols') ?? '[]')); } catch { /* bỏ qua */ }
  }, []);
  const toggleCol = (k: string) =>
    setHidden((h) => {
      const n = h.includes(k) ? h.filter((x) => x !== k) : [...h, k];
      try { localStorage.setItem('tvl_admin_cand_cols', JSON.stringify(n)); } catch { /* bỏ qua */ }
      return n;
    });
  const show = (k: string) => !hidden.includes(k);

  return (
    <div className="flex flex-col gap-3">
      <div className={embedded ? 'hidden' : ''}>
        <h1 className="font-bold text-base">Ứng viên</h1>
        <p className="text-xs text-ink-faint mt-1 max-w-3xl">
          Mọi hồ sơ ứng viên trên web — kể cả hồ sơ chưa từng nộp cho NTD nào. Lọc nhanh, gắn thẻ & ghi chú nội bộ, xem gợi ý việc làm phù
          hợp và mời ứng tuyển.
        </p>
      </div>
      <div className="rounded-xl bg-white border border-border p-3 flex flex-wrap gap-2 items-center">
        <input
          className="tvl-input !w-auto flex-1 min-w-[220px] text-sm"
          placeholder="Tên, chức danh, kỹ năng, vị trí từng làm, SĐT, email…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <select className="tvl-input !w-auto text-sm" value={filters.applied ?? ''} onChange={(e) => setF('applied', e.target.value as 'none' | 'any')} aria-label="Ứng tuyển">
          <option value="">Đã/chưa ứng tuyển</option>
          <option value="none">Chưa ứng tuyển lần nào</option>
          <option value="any">Đã ứng tuyển</option>
        </select>
        <select
          className="tvl-input !w-auto text-sm"
          value={filters.visibility ?? ''}
          onChange={(e) => setF('visibility', e.target.value as ProfileVisibility)}
          aria-label="Chế độ hồ sơ"
        >
          <option value="">Mọi chế độ</option>
          <option value="public">Công khai</option>
          <option value="urgent">Tìm việc gấp</option>
          <option value="locked">Khoá</option>
        </select>
        <select
          className="tvl-input !w-auto text-sm"
          value={filters.completionMin ?? ''}
          onChange={(e) => setF('completionMin', e.target.value ? Number(e.target.value) : undefined)}
          aria-label="Hoàn thiện"
        >
          <option value="">Mọi mức hoàn thiện</option>
          <option value="50">Hoàn thiện ≥ 50%</option>
          <option value="80">Hoàn thiện ≥ 80%</option>
        </select>
        <Combobox ariaLabel="Tỉnh/thành" className="min-w-[11rem] w-52" inputClassName="text-sm" value={filters.province ?? ''} options={PROVINCES} allLabel="Mọi tỉnh/thành" onChange={(v) => setF('province', v)} />
        <input
          className="tvl-input !w-[150px] text-sm"
          placeholder="Kỹ năng…"
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
        />
        <Combobox ariaLabel="Thẻ" className="min-w-[10rem] w-48" inputClassName="text-sm" value={filters.tag ?? ''} options={tags.map((t) => ({ value: t.tag, label: t.tag, hint: String(t.count) }))} allLabel="Mọi thẻ" onChange={(v) => setF('tag', v)} />
        <select className="tvl-input !w-auto text-sm" value={filters.sourced ?? ''} onChange={(e) => setF('sourced', e.target.value as 'only' | 'exclude')} aria-label="Nguồn">
          <option value="">Mọi nguồn</option>
          <option value="exclude">Ứng viên tự đăng ký</option>
          <option value="only">Nguồn tổng hợp</option>
        </select>
        {hasFilters && (
          <button
            className="text-xs font-semibold text-critical px-2"
            onClick={() => {
              setFilters({});
              setQInput('');
              setSkillInput('');
              setPage(1);
            }}
          >
            Xoá bộ lọc
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-ink-faint">{data ? `${formatNumber(data.total)} hồ sơ` : ''}</div>
        <details className="relative text-xs">
          <summary className="cursor-pointer list-none rounded-lg border border-border-strong bg-white px-2.5 py-1 font-bold text-ink">▦ Cột hiển thị</summary>
          <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-border bg-white p-2 shadow-lg grid gap-1">
            {COLS.map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 font-semibold text-ink">
                <input type="checkbox" checked={show(k)} onChange={() => toggleCol(k)} /> {l}
              </label>
            ))}
          </div>
        </details>
      </div>
      <div className="rounded-xl bg-white border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-ink-faint bg-surface-alt whitespace-nowrap">
                <SortTh s={cs} k="name" className="py-2.5 px-3 font-semibold sticky left-0 z-10 bg-surface-alt">Ứng viên</SortTh>
                {show('phone') && <SortTh s={cs} k="phone" className="py-2.5 px-3 font-semibold">Điện thoại</SortTh>}
                {show('email') && <SortTh s={cs} k="email" className="py-2.5 px-3 font-semibold">Email</SortTh>}
                {show('position') && <SortTh s={cs} k="position" className="py-2.5 px-3 font-semibold">Chức danh</SortTh>}
                {show('province') && <SortTh s={cs} k="province" className="py-2.5 px-3 font-semibold">Tỉnh/TP</SortTh>}
                {show('exp') && <SortTh s={cs} k="exp" align="right" className="py-2.5 px-3 font-semibold">Kinh nghiệm</SortTh>}
                {show('completion') && <SortTh s={cs} k="completion" align="right" className="py-2.5 px-3 font-semibold">Hoàn thiện</SortTh>}
                {show('visibility') && <SortTh s={cs} k="visibility" className="py-2.5 px-3 font-semibold">Hồ sơ</SortTh>}
                {show('account') && <SortTh s={cs} k="account" className="py-2.5 px-3 font-semibold">Tài khoản</SortTh>}
                {show('applications') && <SortTh s={cs} k="applications" align="right" className="py-2.5 px-3 font-semibold">Số đơn</SortTh>}
                {show('lastApplied') && <SortTh s={cs} k="lastApplied" className="py-2.5 px-3 font-semibold">Ứng tuyển gần nhất</SortTh>}
                {show('updatedAt') && <SortTh s={cs} k="updatedAt" className="py-2.5 px-3 font-semibold">Cập nhật</SortTh>}
                {show('tags') && <SortTh s={cs} k="tags" className="py-2.5 px-3 font-semibold">Thẻ / ghi chú</SortTh>}
                <th className="py-2.5 px-3" />
              </tr>
            </thead>
            <tbody className={loading ? 'opacity-60' : ''}>
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={14} className="text-center text-ink-faint py-10">
                    Không có hồ sơ nào phù hợp.
                  </td>
                </tr>
              )}
              {cs.rows.map((c) => (
                <tr key={c.id} className="border-t border-border align-top group">
                  <td className="py-3 px-3 min-w-[170px] sticky left-0 z-10 bg-white group-hover:bg-surface-alt">
                    <div className="font-bold flex items-center gap-1.5 flex-wrap">
                      {c.fullName}
                      {c.isAdminSourced && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-warning-tint text-warning">Nguồn tổng hợp</span>
                      )}
                    </div>
                  </td>
                  {show('phone') && <td className="py-3 px-3 whitespace-nowrap tabular-nums">{c.phone ?? '—'}</td>}
                  {show('email') && <td className="py-3 px-3 whitespace-nowrap">{c.contactEmail ?? c.email ?? "—"}</td>}
                  {show('position') && <td className="py-3 px-3 min-w-[150px] text-primary font-semibold">{c.profileTitle ?? c.desiredPosition ?? 'Chưa có chức danh'}</td>}
                  {show('province') && <td className="py-3 px-3 whitespace-nowrap">{c.province ?? '—'}</td>}
                  {show('exp') && <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{c.yearsOfExperience != null ? `${c.yearsOfExperience} năm` : '—'}</td>}
                  {show('completion') && (
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                      <span className={`font-bold ${c.completionPercent >= 80 ? 'text-success' : c.completionPercent >= 50 ? 'text-ink' : 'text-warning'}`}>{formatNumber(c.completionPercent)}%</span>
                    </td>
                  )}
                  {show('visibility') && (
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${VIS[c.visibility]?.cls ?? ''}`}>
                        {VIS[c.visibility]?.label ?? c.visibility}
                      </span>
                    </td>
                  )}
                  {show('account') && (
                    <td className="py-3 px-3 whitespace-nowrap">
                      {c.userStatus === 'suspended' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-critical-tint text-critical">Bị khoá</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success-tint text-success">Hoạt động</span>
                      )}
                    </td>
                  )}
                  {show('applications') && <td className="py-3 px-3 text-right tabular-nums font-bold">{formatNumber(c.applicationCount)}</td>}
                  {show('lastApplied') && <td className="py-3 px-3 whitespace-nowrap tabular-nums text-ink-muted">{c.lastAppliedAt ? formatTimeDate(c.lastAppliedAt) : '—'}</td>}
                  {show('updatedAt') && <td className="py-3 px-3 whitespace-nowrap tabular-nums text-ink-muted">{c.updatedAt ? formatTimeDate(c.updatedAt) : '—'}</td>}
                  {show('tags') && (
                    <td className="py-3 px-3 min-w-[140px] max-w-[220px]">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-info-tint text-info">{t}</span>
                        ))}
                      </div>
                      {c.note && <div className="text-ink-faint mt-1 line-clamp-2">📝 {c.note}</div>}
                    </td>
                  )}
                  <td className="py-3 px-3 text-right">
                    <button onClick={() => setOpenId(c.id)} className="text-[11px] font-bold rounded-md bg-primary text-white px-3 py-1.5">
                      Xem
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {data && totalPages > 1 && <Pager page={page} totalPages={totalPages} onPage={setPage} />}
      {openId && (
        <CandidateModal
          token={token}
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            load().catch(() => undefined);
            loadTags();
          }}
        />
      )}
    </div>
  );
}

function CandidateModal({ token, id, onClose, onChanged }: { token: string; id: string; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<AdminCandidateDetail | null>(null);
  const [jobs, setJobs] = useState<SuggestedJob[] | null>(null);
  const [tagText, setTagText] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());

  useEffect(() => {
    adminCandidatesApi
      .detail(token, id)
      .then((x) => {
        setD(x);
        setTagText(x.tags.join(', '));
        setNote(x.note ?? '');
      })
      .catch((err) => setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Không tải được hồ sơ' }));
    adminCandidatesApi
      .suggestedJobs(token, id)
      .then(setJobs)
      .catch(() => setJobs([]));
  }, [token, id]);

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
      onChanged();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Thao tác không thành công' });
    } finally {
      setBusy(null);
    }
  }

  const s = d?.snapshot;
  const searchable = d && !!s?.profileTitle && d.visibility !== 'locked';

  return (
    <Modal title={s ? s.fullName : 'Đang tải…'} onClose={onClose} wide>
      {!d ? (
        msg ? (
          <div className="rounded-lg bg-critical-tint text-critical text-xs font-semibold px-3.5 py-2.5">{msg.text}</div>
        ) : (
          <div className="text-center text-ink-faint text-sm py-10">Đang tải…</div>
        )
      ) : (
        <div className="flex flex-col gap-4 text-xs">
          {msg && (
            <div className={`rounded-lg text-xs font-semibold px-3.5 py-2.5 ${msg.ok ? 'bg-success-tint text-success' : 'bg-critical-tint text-critical'}`}>
              {msg.text}
            </div>
          )}
          {s && (
            <div className="flex flex-col gap-1">
              <div className="text-primary font-bold text-[13px]">{s.profileTitle ?? s.desiredPosition ?? 'Chưa có chức danh'}</div>
              <div className="text-ink-muted">
                {[s.phone, s.contactEmail ?? d.email, s.province, s.yearsOfExperience != null ? `${s.yearsOfExperience} năm KN` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              <div className="text-ink-faint">
                {VIS[d.visibility]?.label} · hoàn thiện {formatNumber(d.completionPercent)}% · cập nhật {formatTimeDate(d.updatedAt)}
                {d.isAdminSourced && ` · Nguồn tổng hợp (${d.sourceLabel ?? '—'})`}
                {d.claimedAt && ` · Đã được người thật nhận lại ${formatTimeDate(d.claimedAt)}`}
              </div>
              {s.experiences.length > 0 && (
                <div className="mt-1">
                  <span className="font-semibold">Kinh nghiệm: </span>
                  {s.experiences
                    .slice(0, 4)
                    .map((e) => [e.position, e.companyName].filter(Boolean).join(' @ '))
                    .join(' · ')}
                </div>
              )}
              {s.skills.length > 0 && (
                <div>
                  <span className="font-semibold">Kỹ năng: </span>
                  {s.skills.map((k) => k.skillName).join(', ')}
                </div>
              )}
            </div>
          )}

          <section className="rounded-xl border border-border p-3.5 flex flex-col gap-2">
            <h4 className="text-[12.5px] font-extrabold uppercase tracking-wide">Thẻ & ghi chú nội bộ</h4>
            <input
              className="tvl-input text-sm"
              placeholder="Thẻ, cách nhau dấu phẩy — VD: Tiềm năng, Kế toán, Đã gọi"
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
            />
            <textarea className="tvl-input text-sm min-h-[70px]" placeholder="Ghi chú (chỉ Admin thấy)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex justify-between items-center gap-2">
              <span className="text-ink-faint">{d.noteUpdatedBy ? `Sửa lần cuối: ${d.noteUpdatedBy}` : ''}</span>
              <button
                disabled={!!busy}
                onClick={() =>
                  run('note', async () => {
                    const r = await adminCandidatesApi.setNote(token, id, {
                      tags: tagText.split(',').map((t) => t.trim()).filter(Boolean),
                      note,
                    });
                    setTagText(r.tags.join(', '));
                    return 'Đã lưu thẻ & ghi chú.';
                  })
                }
                className="tvl-btn-primary !w-auto px-4 text-xs"
              >
                Lưu
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-border p-3.5 flex flex-col gap-2">
            <h4 className="text-[12.5px] font-extrabold uppercase tracking-wide">Việc làm gợi ý</h4>
            {jobs === null ? (
              <div className="text-ink-faint">Đang tìm tin phù hợp…</div>
            ) : jobs.length === 0 ? (
              <div className="text-ink-faint">Chưa có tin đang tuyển nào đủ phù hợp (cần chức danh / kỹ năng / nơi làm việc trên hồ sơ).</div>
            ) : (
              jobs.map((j) => (
                <div key={j.id} className="flex items-start gap-3 border-t border-border pt-2 first:border-0 first:pt-0">
                  <div className="w-10 shrink-0 text-center">
                    <div className="font-extrabold text-primary text-[14px] tabular-nums">{j.score}</div>
                    <div className="text-[9.5px] text-ink-faint">điểm</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <a href={`/viec-lam/${j.id}`} target="_blank" rel="noreferrer" className="font-bold hover:text-primary">
                      {j.title}
                    </a>
                    <div className="text-ink-muted">
                      {j.companyName} · {j.provinces.join(', ')} · {formatSalary(j.salaryMin ?? undefined, j.salaryMax ?? undefined)}
                    </div>
                    <div className="text-ink-faint">{j.reasons.join(' · ')}</div>
                  </div>
                  {!d.isAdminSourced && (
                    <button
                      disabled={!!busy || invited.has(j.id)}
                      onClick={() =>
                        run(`inv-${j.id}`, async () => {
                          await adminCandidatesApi.invite(token, id, j.id);
                          setInvited((x) => new Set(x).add(j.id));
                          return `Đã gửi lời mời ứng tuyển “${j.title}” tới ứng viên.`;
                        })
                      }
                      className="text-[11px] font-bold rounded-md bg-success-tint text-success px-2.5 py-1.5 disabled:opacity-50 whitespace-nowrap"
                    >
                      {invited.has(j.id) ? 'Đã mời' : 'Mời ứng tuyển'}
                    </button>
                  )}
                </div>
              ))
            )}
          </section>

          <section className="rounded-xl border border-border p-3.5 flex flex-col gap-2">
            <h4 className="text-[12.5px] font-extrabold uppercase tracking-wide">Lịch sử ứng tuyển ({d.applications.length})</h4>
            {d.applications.length === 0 ? (
              <div className="text-ink-faint">Chưa ứng tuyển tin nào.</div>
            ) : (
              d.applications.map((a) => (
                <div key={a.id} className="flex justify-between gap-2">
                  <span>
                    <b>{a.jobTitle}</b> — {a.companyName}
                  </span>
                  <span className="text-ink-faint whitespace-nowrap">
                    {APPLICATION_STATUS_LABEL[a.status] ?? a.status} · {formatTimeDate(a.appliedAt)}
                  </span>
                </div>
              ))
            )}
            {d.archiveCards.length > 0 && (
              <div className="text-ink-faint">
                Kho CV:{' '}
                {d.archiveCards
                  .map((c) => `${c.companyName} (${c.shareStatus === 'shared' ? 'đã chia sẻ' : c.shareStatus === 'pending' ? 'chờ duyệt' : c.shareStatus === 'dismissed' ? 'bỏ qua' : 'đã công khai'})`)
                  .join(' · ')}
              </div>
            )}
          </section>

          {!d.isAdminSourced && !searchable && (
            <div className="rounded-xl border border-dashed border-border-strong p-3.5 flex flex-wrap items-center gap-3 justify-between">
              <span className="text-ink-muted max-w-md">
                Hồ sơ này chưa hiện trong Tìm CV ({d.visibility === 'locked' ? 'ứng viên để Khoá' : 'chưa có chức danh'}). Có thể tạo 1 bản “Nguồn
                tổng hợp” để NTD tìm thấy (người thật có thể yêu cầu gỡ / nhận lại).
              </span>
              <button
                disabled={!!busy}
                onClick={() => {
                  if (!confirm('Tạo hồ sơ nguồn tổng hợp từ hồ sơ này?')) return;
                  run('src', async () => {
                    const r = await adminCandidatesApi.toSourced(token, id);
                    return r.status === 'already_public' ? 'Hồ sơ đã công khai sẵn — không cần tạo bản sao.' : 'Đã tạo hồ sơ nguồn tổng hợp.';
                  });
                }}
                className="tvl-btn-accent !w-auto px-4 text-xs"
              >
                Chuyển thành nguồn tổng hợp
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
