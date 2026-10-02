'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, workersApi, type AdminWorkerDetail, type AdminWorkerRow, type WorkerKind } from '@/lib/api';
import { formatDate, formatNumber, formatSalary, formatTimeDate } from '@/lib/format';
import { CALL_LABEL, GENDER_LABEL, KIND_LABEL, LABOR_GROUPS, SHIFTS, placeText } from '@/lib/labor';
import { PROVINCES } from '@/lib/catalogs';
import { Combobox } from '@/components/ui/Combobox';
import { Modal } from '@/components/profile/ui';
import { Pager } from './CvSourcingPanel';
import { WorkerSourcingPanel } from './WorkerSourcingPanel';
import { SortTh, useSort } from '@/components/ui/SortTh';

// Đợt 135 — Admin "Ứng viên → Công nhân · SV · TTS": quản lý hồ sơ lao động phổ thông với cùng bộ chức năng như hồ sơ
// văn phòng: tìm (tên/SĐT/việc muốn làm/ghi chú, gõ không dấu), lọc, thẻ + ghi chú nội bộ, gợi ý tin gần nơi ở,
// mời ứng tuyển, ẩn/hiện hồ sơ, xem lịch sử ứng tuyển + sổ gọi điện của NTD.
type Q = { source?: string; q?: string; kind?: string; province?: string; group?: string; shift?: string; seeking?: string; hidden?: string; account?: string; tag?: string; stale?: string; sort?: string };

const WCOLS: [string, string][] = [
  ['phone', 'Điện thoại'], ['kind', 'Nhóm'], ['age', 'Tuổi · giới tính'], ['place', 'Nơi ở'], ['jobs', 'Việc muốn làm · ca'], ['status', 'Trạng thái'],
  ['source', 'Nguồn'], ['apps', 'Số đơn'], ['calls', 'NTD gọi'], ['refreshedAt', 'Làm mới'], ['createdAt', 'Đăng ký'], ['tags', 'Thẻ / ghi chú'],
];

export function WorkerCandidatesPanel({ token, onCounts }: { token: string; onCounts?: (n: number) => void }) {
  const [f, setFilters] = useState<Q>({});
  const [qInput, setQInput] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof workersApi.adminList>> | null>(null);
  const ws = useSort(data?.items, {
    name: (w: AdminWorkerRow) => w.fullName,
    jobs: (w: AdminWorkerRow) => w.desiredJobs.join(', '),
    tags: (w: AdminWorkerRow) => w.tags.join(', '),
    status: (w: AdminWorkerRow) => (w.isHidden ? 'Đã ẩn' : w.isSeeking ? 'Đang tìm việc' : 'Tạm dừng'),
    apps: (w: AdminWorkerRow) => w.applications,
    phone: (w: AdminWorkerRow) => w.phone,
    kind: (w: AdminWorkerRow) => KIND_LABEL[w.kind],
    age: (w: AdminWorkerRow) => w.age,
    place: (w: AdminWorkerRow) => `${w.province} ${w.place}`,
    source: (w: AdminWorkerRow) => (w.isSourced ? w.sourceLabel ?? 'Nguồn tổng hợp' : 'Tự đăng ký'),
    calls: (w: AdminWorkerRow) => w.calls,
    refreshedAt: (w: AdminWorkerRow) => new Date(w.refreshedAt),
    createdAt: (w: AdminWorkerRow) => new Date(w.createdAt),
  });
  // Đợt 146 — tách cột + chọn cột hiển thị (nhớ trong trình duyệt).
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    try { setHidden(JSON.parse(localStorage.getItem('tvl_admin_worker_cols') ?? '[]')); } catch { /* bỏ qua */ }
  }, []);
  const toggleCol = (k: string) =>
    setHidden((h) => {
      const n = h.includes(k) ? h.filter((x) => x !== k) : [...h, k];
      try { localStorage.setItem('tvl_admin_worker_cols', JSON.stringify(n)); } catch { /* bỏ qua */ }
      return n;
    });
  const show = (k: string) => !hidden.includes(k);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [collect, setCollect] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((x) => ({ ...x, q: qInput.trim() || undefined }));
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);
  const loadTags = useCallback(() => {
    workersApi.adminTags(token).then(setTags).catch(() => setTags([]));
  }, [token]);
  useEffect(loadTags, [loadTags]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await workersApi.adminList(token, { ...f, page: String(page) });
      setData(r);
      onCounts?.(Object.values(r.counts).reduce((a, b) => a + b, 0));
    } finally {
      setLoading(false);
    }
  }, [token, f, page, onCounts]);
  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const setF = (k: keyof Q, v: string) => {
    setFilters((x) => ({ ...x, [k]: v || undefined, ...(k === 'kind' ? { group: undefined } : {}) }));
    setPage(1);
  };
  const groups = f.kind ? LABOR_GROUPS[f.kind as WorkerKind] : Array.from(new Set(Object.values(LABOR_GROUPS).flat()));
  const hasFilters = Object.values(f).some((v) => v);
  const sel = 'tvl-input !w-auto text-sm';

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-faint max-w-3xl">
        Hồ sơ công nhân, sinh viên, thực tập sinh tự điền trên web (không cần tài khoản — khoá theo số điện thoại). Lọc nhanh, gắn thẻ & ghi chú nội bộ,
        xem gợi ý việc gần nơi ở và mời ứng tuyển.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-expanded={collect} onClick={() => setCollect((v) => !v)} className={`rounded-lg px-3.5 py-2 text-sm font-bold border ${collect ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary'}`}>
          {collect ? '▾ Thu thập hồ sơ (đang mở)' : '＋ Thu thập hồ sơ: dán bài / dán bảng / hàng chờ'}
        </button>
        {data?.sourceCounts && (
          <span className="text-xs text-ink-faint">
            Tự điền {formatNumber(data.sourceCounts.self ?? 0)} · Nguồn tổng hợp {formatNumber(data.sourceCounts.sourced ?? 0)} · NTD tự nhập {formatNumber(data.sourceCounts.ntd ?? 0)}
          </span>
        )}
      </div>
      {collect && <WorkerSourcingPanel token={token} onSaved={() => load().catch(() => undefined)} />}
      <div role="tablist" className="flex gap-1.5 flex-wrap text-xs">
        {([['', 'Tất cả'], ['worker', 'Công nhân'], ['student', 'Sinh viên'], ['intern', 'Thực tập sinh']] as const).map(([k, l]) => (
          <button key={k || 'all'} type="button" role="tab" aria-selected={(f.kind ?? '') === k} onClick={() => setF('kind', k)} className={`rounded-full border px-3 py-1.5 font-bold ${(f.kind ?? '') === k ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white text-ink'}`}>
            {l}
            {data ? ` (${formatNumber(k ? data.counts[k] ?? 0 : Object.values(data.counts).reduce((a, b) => a + b, 0))})` : ''}
          </button>
        ))}
      </div>
      <div className="rounded-xl bg-white border border-border p-3 flex flex-wrap gap-2 items-center">
        <input className="tvl-input !w-auto flex-1 min-w-[220px] text-sm" placeholder="Tên, số điện thoại, việc muốn làm, ghi chú…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        <Combobox ariaLabel="Tỉnh/thành" className="min-w-[11rem] w-52" inputClassName="text-sm" value={f.province ?? ''} options={PROVINCES} allLabel="Mọi tỉnh/thành" onChange={(v) => setF('province', v)} />
        <Combobox ariaLabel="Việc muốn làm" className="min-w-[11rem] w-56" inputClassName="text-sm" value={f.group ?? ''} options={groups} allLabel="Mọi việc muốn làm" onChange={(v) => setF('group', v)} />
        <select className={sel} value={f.shift ?? ''} onChange={(e) => setF('shift', e.target.value)} aria-label="Ca làm">
          <option value="">Mọi ca làm</option>
          {SHIFTS.map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
        <select className={sel} value={f.source ?? ''} onChange={(e) => setF('source', e.target.value)} aria-label="Nguồn hồ sơ">
          <option value="">Mọi nguồn hồ sơ</option>
          <option value="self">Người lao động tự điền</option>
          <option value="sourced">Nguồn tổng hợp (Admin/NTD thu thập)</option>
          <option value="ntd">NTD tự nhập (kho riêng)</option>
        </select>
        <select className={sel} value={f.seeking ?? ''} onChange={(e) => setF('seeking', e.target.value)} aria-label="Đang tìm việc">
          <option value="">Đang tìm & tạm dừng</option>
          <option value="1">Đang tìm việc</option>
          <option value="0">Tạm dừng tìm việc</option>
        </select>
        <select className={sel} value={f.account ?? ''} onChange={(e) => setF('account', e.target.value)} aria-label="Tài khoản">
          <option value="">Có & chưa có tài khoản</option>
          <option value="1">Có tài khoản (mời qua web)</option>
          <option value="0">Chưa có tài khoản</option>
        </select>
        <Combobox ariaLabel="Thẻ" className="min-w-[10rem] w-48" inputClassName="text-sm" value={f.tag ?? ''} options={tags.map((t) => ({ value: t.tag, label: t.tag, hint: String(t.count) }))} allLabel="Mọi thẻ" onChange={(v) => setF('tag', v)} />
        <select className={sel} value={f.hidden ?? ''} onChange={(e) => setF('hidden', e.target.value)} aria-label="Hiển thị">
          <option value="">Đang hiển thị</option>
          <option value="1">Đã ẩn</option>
          <option value="all">Tất cả</option>
        </select>
        <select className={sel} value={f.sort ?? ''} onChange={(e) => setF('sort', e.target.value)} aria-label="Sắp xếp">
          <option value="">Làm mới gần nhất</option>
          <option value="new">Đăng ký mới nhất</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.stale === '1'} onChange={(e) => setF('stale', e.target.checked ? '1' : '')} />Quá 30 ngày chưa làm mới</label>
        {hasFilters && (
          <button type="button" onClick={() => { setFilters({}); setQInput(''); setPage(1); }} className="text-xs font-bold text-primary underline">Xoá lọc</button>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-ink-faint">{data ? `${formatNumber(data.total)} hồ sơ` : ''}</div>
        <details className="relative text-xs">
          <summary className="cursor-pointer list-none rounded-lg border border-border-strong bg-white px-2.5 py-1 font-bold text-ink">▦ Cột hiển thị</summary>
          <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-border bg-white p-2 shadow-lg grid gap-1">
            {WCOLS.map(([k, l]) => (
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
                <SortTh s={ws} k="name" className="py-2.5 px-3 font-semibold sticky left-0 z-10 bg-surface-alt">Người lao động</SortTh>
                {show('phone') && <SortTh s={ws} k="phone" className="py-2.5 px-3 font-semibold">Điện thoại</SortTh>}
                {show('kind') && <SortTh s={ws} k="kind" className="py-2.5 px-3 font-semibold">Nhóm</SortTh>}
                {show('age') && <SortTh s={ws} k="age" align="right" className="py-2.5 px-3 font-semibold">Tuổi</SortTh>}
                {show('place') && <SortTh s={ws} k="place" className="py-2.5 px-3 font-semibold">Nơi ở</SortTh>}
                {show('jobs') && <SortTh s={ws} k="jobs" className="py-2.5 px-3 font-semibold">Việc muốn làm · ca</SortTh>}
                {show('status') && <SortTh s={ws} k="status" className="py-2.5 px-3 font-semibold">Trạng thái</SortTh>}
                {show('source') && <SortTh s={ws} k="source" className="py-2.5 px-3 font-semibold">Nguồn</SortTh>}
                {show('apps') && <SortTh s={ws} k="apps" align="right" className="py-2.5 px-3 font-semibold">Số đơn</SortTh>}
                {show('calls') && <SortTh s={ws} k="calls" align="right" className="py-2.5 px-3 font-semibold">NTD gọi</SortTh>}
                {show('refreshedAt') && <SortTh s={ws} k="refreshedAt" className="py-2.5 px-3 font-semibold">Làm mới</SortTh>}
                {show('createdAt') && <SortTh s={ws} k="createdAt" className="py-2.5 px-3 font-semibold">Đăng ký</SortTh>}
                {show('tags') && <SortTh s={ws} k="tags" className="py-2.5 px-3 font-semibold">Thẻ / ghi chú</SortTh>}
                <th className="py-2.5 px-3" />
              </tr>
            </thead>
            <tbody className={loading ? 'opacity-60' : ''}>
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={14} className="text-center text-ink-faint py-10">Không có hồ sơ nào phù hợp.</td>
                </tr>
              )}
              {ws.rows.map((w: AdminWorkerRow) => (
                <tr key={w.id} className="border-t border-border align-top group">
                  <td className="py-3 px-3 min-w-[170px] sticky left-0 z-10 bg-white group-hover:bg-surface-alt">
                    <div className="font-bold flex items-center gap-1.5 flex-wrap">
                      {w.fullName}
                      {w.hasAccount && <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-success-tint text-success">Có tài khoản</span>}
                    </div>
                  </td>
                  {show('phone') && <td className="py-3 px-3 whitespace-nowrap tabular-nums">{w.phone}</td>}
                  {show('kind') && <td className="py-3 px-3 whitespace-nowrap"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-tint text-primary">{KIND_LABEL[w.kind]}</span></td>}
                  {show('age') && <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{w.age ? `${w.age} · ${GENDER_LABEL[w.gender] ?? ''}`.replace(/ · $/, '') : '—'}</td>}
                  {show('place') && <td className="py-3 px-3 min-w-[130px]">{w.place && w.place !== 'Chưa rõ quận/huyện' ? `${w.place}, ${w.province}` : w.province}</td>}
                  {show('jobs') && (
                    <td className="py-3 px-3 min-w-[150px] max-w-[220px]">
                      <div>{w.desiredJobs.join(', ') || '—'}</div>
                      {w.shifts.length > 0 && <div className="text-ink-faint">🕒 {w.shifts.join(', ')}</div>}
                    </td>
                  )}
                  {show('status') && (
                    <td className="py-3 px-3 whitespace-nowrap">
                      {w.isHidden ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-critical-tint text-critical">Đã ẩn</span>
                      ) : w.isSeeking ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success-tint text-success">Đang tìm việc</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-alt text-ink-muted">Tạm dừng</span>
                      )}
                    </td>
                  )}
                  {show('source') && (
                    <td className="py-3 px-3 min-w-[110px]">
                      {w.isSourced ? (
                        <>
                          <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-warning-tint text-ink" title={w.sourceLabel ?? ''}>Nguồn tổng hợp</span>
                          {w.shareStatus && <div className="text-ink-faint mt-1">{w.ownerCompany ? `${w.ownerCompany} · ` : ''}{w.shareStatus === 'shared' ? 'đã chia sẻ' : w.shareStatus === 'dismissed' ? 'bỏ qua' : 'chờ chia sẻ'}</div>}
                        </>
                      ) : 'Tự đăng ký'}
                    </td>
                  )}
                  {show('apps') && <td className="py-3 px-3 text-right tabular-nums font-bold">{formatNumber(w.applications)}</td>}
                  {show('calls') && <td className="py-3 px-3 text-right tabular-nums">{formatNumber(w.calls)}</td>}
                  {show('refreshedAt') && <td className="py-3 px-3 whitespace-nowrap tabular-nums text-ink-muted">{formatTimeDate(w.refreshedAt)}</td>}
                  {show('createdAt') && <td className="py-3 px-3 whitespace-nowrap tabular-nums text-ink-muted">{formatTimeDate(w.createdAt)}</td>}
                  {show('tags') && (
                    <td className="py-3 px-3 min-w-[130px] max-w-[200px]">
                      <div className="flex flex-wrap gap-1">
                        {w.tags.map((t) => (<span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-info-tint text-info">{t}</span>))}
                      </div>
                      {w.note && <div className="text-ink-faint mt-1 line-clamp-2">📝 {w.note}</div>}
                    </td>
                  )}
                  <td className="py-3 px-3 text-right">
                    <button onClick={() => setOpenId(w.id)} className="text-[11px] font-bold rounded-md bg-primary text-white px-3 py-1.5">Xem</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {data && data.totalPages > 1 && <Pager page={page} totalPages={data.totalPages} onPage={setPage} />}
      {openId && (
        <WorkerModal
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

function WorkerModal({ token, id, onClose, onChanged }: { token: string; id: string; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<AdminWorkerDetail | null>(null);
  const [jobs, setJobs] = useState<Awaited<ReturnType<typeof workersApi.adminSuggest>> | null>(null);
  const [tagText, setTagText] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());

  const reload = useCallback(() => {
    workersApi
      .adminDetail(token, id)
      .then((x) => {
        setD(x);
        setTagText(x.profile.tags.join(', '));
        setNote(x.profile.note ?? '');
      })
      .catch((err) => setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Không tải được hồ sơ' }));
  }, [token, id]);
  useEffect(() => {
    reload();
    workersApi.adminSuggest(token, id).then(setJobs).catch(() => setJobs([]));
  }, [token, id, reload]);

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
  const p = d?.profile;

  return (
    <Modal title={p ? p.fullName : 'Đang tải…'} onClose={onClose} wide>
      {!d || !p ? (
        msg ? <div className="rounded-lg bg-critical-tint text-critical text-xs font-semibold px-3.5 py-2.5">{msg.text}</div> : <div className="text-center text-ink-faint text-sm py-10">Đang tải…</div>
      ) : (
        <div className="flex flex-col gap-4 text-xs">
          {msg && <div className={`rounded-lg text-xs font-semibold px-3.5 py-2.5 ${msg.ok ? 'bg-success-tint text-success' : 'bg-critical-tint text-critical'}`}>{msg.text}</div>}
          <div className="flex flex-col gap-1">
            <div className="text-primary font-bold text-[13px]">{KIND_LABEL[p.kind]} · {p.desiredJobs.join(', ') || 'chưa chọn việc muốn làm'}</div>
            <div className="text-ink-muted">
              <a href={`tel:${p.phone}`} className="font-bold text-ink">{p.phone}</a>
              {p.relativePhone ? ` · Người thân: ${p.relativePhone}` : ''} · {GENDER_LABEL[p.gender] ?? ''} · {p.birthDate ? `sinh ${formatDate(p.birthDate)}` : p.birthYear ? `sinh năm ${p.birthYear}` : 'chưa rõ năm sinh'}
            </div>
            <div className="text-ink-muted">📍 {placeText(p)}{p.addressDetail ? ` — ${p.addressDetail}` : ''}{p.radiusKm ? ` · muốn làm trong ${p.radiusKm} km` : ''}</div>
            {p.shifts.length > 0 && <div>🕒 Ca có thể làm: {p.shifts.join(', ')}</div>}
            {(p.needsHousing || p.needsShuttle) && <div>Cần: {[p.needsHousing && 'chỗ ở', p.needsShuttle && 'xe đưa đón'].filter(Boolean).join(', ')}</div>}
            {p.school && <div>Trường: {p.school}{p.major ? ` · ${p.major}` : ''}</div>}
            <div className="text-ink-faint">
              {p.isSeeking ? 'Đang tìm việc' : 'Tạm dừng tìm việc'} · làm mới {formatTimeDate(p.refreshedAt)} · đăng ký {formatTimeDate(p.createdAt)} · {p.hasAccount ? 'có tài khoản' : 'chưa có tài khoản'}
              {p.isHidden && ' · ĐANG BỊ ẨN'}
            </div>
            {p.isSourced && <div className="text-ink"><b>Nguồn tổng hợp</b>{p.sourceLabel ? ` — ${p.sourceLabel}` : ''}{p.shareStatus ? ` · kho riêng của một NTD (${p.shareStatus === 'shared' ? 'đã chia sẻ' : p.shareStatus === 'dismissed' ? 'bỏ qua' : 'chờ chia sẻ'})` : ''}</div>}
            {p.warnings && p.warnings.length > 0 && <div className="text-warning font-semibold">⚠ {p.warnings.join(' · ')}</div>}
          </div>

          <section className="rounded-xl border border-border p-3.5 flex flex-col gap-2">
            <h4 className="text-[12.5px] font-extrabold uppercase tracking-wide">Thẻ & ghi chú nội bộ</h4>
            <input className="tvl-input text-sm" placeholder="Thẻ, cách nhau dấu phẩy — VD: Đã gọi, Chăm chỉ, Cần KTX" value={tagText} onChange={(e) => setTagText(e.target.value)} />
            <textarea className="tvl-input text-sm min-h-[70px]" placeholder="Ghi chú (chỉ Admin thấy)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex justify-end">
              <button
                disabled={!!busy}
                onClick={() =>
                  run('note', async () => {
                    const r = await workersApi.adminMeta(token, id, { tags: tagText.split(',').map((t) => t.trim()).filter(Boolean), note });
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
            <h4 className="text-[12.5px] font-extrabold uppercase tracking-wide">Việc làm gợi ý (gần nơi ở, đúng việc muốn làm)</h4>
            {jobs === null ? (
              <div className="text-ink-faint">Đang tìm tin phù hợp…</div>
            ) : jobs.length === 0 ? (
              <div className="text-ink-faint">Chưa có tin {KIND_LABEL[p.kind].toLowerCase()} đang tuyển phù hợp.</div>
            ) : (
              jobs.map((j) => (
                <div key={j.id} className="flex items-start gap-3 border-t border-border pt-2 first:border-0 first:pt-0">
                  <div className="flex-1 min-w-0">
                    <a href={`/viec-lam/${j.id}`} target="_blank" rel="noreferrer" className="font-bold hover:text-primary">{j.title}</a>
                    <div className="text-ink-muted">
                      {j.company} · {formatSalary(j.salaryMin ?? undefined, j.salaryMax ?? undefined)}
                      {j.distance ? ` · ${j.distance}` : ''}
                      {j.matched ? ' · ✔ đúng việc muốn làm' : ''}
                    </div>
                  </div>
                  {j.applied ? (
                    <span className="text-[11px] font-bold text-ink-faint whitespace-nowrap">Đã ứng tuyển</span>
                  ) : (
                    <button
                      disabled={!!busy || invited.has(j.id)}
                      onClick={() =>
                        run(`inv-${j.id}`, async () => {
                          const r = await workersApi.adminInvite(token, id, j.id);
                          setInvited((x) => new Set(x).add(j.id));
                          if (r.ok) return `Đã gửi lời mời “${j.title}” — người này sẽ thấy trong thông báo.`;
                          const link = `${window.location.origin}/viec-lam/${j.id}`;
                          try {
                            await navigator.clipboard.writeText(link);
                          } catch {
                            /* trình duyệt chặn chép */
                          }
                          return `Người này chưa có tài khoản — gọi hoặc nhắn Zalo ${r.phone} kèm link tin (đã chép sẵn): ${link}`;
                        })
                      }
                      className="text-[11px] font-bold rounded-md bg-success-tint text-success px-2.5 py-1.5 disabled:opacity-50 whitespace-nowrap"
                    >
                      {invited.has(j.id) ? 'Đã mời' : p.hasAccount ? 'Mời ứng tuyển' : 'Mời (gọi điện)'}
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
                  <span><a href={`/viec-lam/${a.jobId}`} target="_blank" rel="noreferrer" className="font-bold hover:text-primary">{a.title}</a> — {a.company ?? '—'}</span>
                  <span className="text-ink-faint whitespace-nowrap">{CALL_LABEL[a.status] ?? a.status} · {formatTimeDate(a.createdAt)}</span>
                </div>
              ))
            )}
          </section>

          <section className="rounded-xl border border-border p-3.5 flex flex-col gap-2">
            <h4 className="text-[12.5px] font-extrabold uppercase tracking-wide">Nhà tuyển dụng đã gọi ({d.calls.length})</h4>
            {d.calls.length === 0 ? (
              <div className="text-ink-faint">Chưa có NTD nào ghi sổ gọi.</div>
            ) : (
              d.calls.map((c, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span><b>{c.company ?? '—'}</b>{c.jobTitle ? ` — ${c.jobTitle}` : ''}</span>
                  <span className="text-ink-faint whitespace-nowrap">{CALL_LABEL[c.status] ?? c.status} · {formatTimeDate(c.updatedAt)}</span>
                </div>
              ))
            )}
            {d.notes.length > 0 && (
              <div className="text-ink-faint">Ghi chú NTD: {d.notes.map((n) => n.text).join(' · ')}</div>
            )}
          </section>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              disabled={!!busy}
              onClick={() =>
                run('hide', async () => {
                  await workersApi.adminHide(token, id, !p.isHidden);
                  reload();
                  return p.isHidden ? 'Đã hiện lại hồ sơ.' : 'Đã ẩn hồ sơ — NTD không còn thấy.';
                })
              }
              className={`text-[11px] font-bold rounded-md px-3 py-1.5 ${p.isHidden ? 'bg-success-tint text-success' : 'bg-critical-tint text-critical'}`}
            >
              {p.isHidden ? 'Hiện lại hồ sơ' : 'Ẩn hồ sơ (vi phạm / ảo)'}
            </button>
            {p.isSourced && (
              <button
                disabled={!!busy}
                onClick={() => {
                  if (!window.confirm(`Gỡ hẳn hồ sơ nguồn tổng hợp “${p.fullName}”? (xoá cả sổ gọi và ghi chú của NTD về người này)`)) return;
                  run('del', async () => {
                    await workersApi.adminDeleteSourced(token, id);
                    onClose();
                    return 'Đã gỡ hồ sơ.';
                  });
                }}
                className="text-[11px] font-bold rounded-md px-3 py-1.5 border border-critical text-critical"
              >
                Gỡ hẳn hồ sơ nguồn tổng hợp
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
