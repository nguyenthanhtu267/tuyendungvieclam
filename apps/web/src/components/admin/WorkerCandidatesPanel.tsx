'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, workersApi, type AdminWorkerDetail, type AdminWorkerRow, type WorkerKind } from '@/lib/api';
import { formatDate, formatNumber, formatSalary } from '@/lib/format';
import { CALL_LABEL, GENDER_LABEL, KIND_LABEL, LABOR_GROUPS, SHIFTS, placeText } from '@/lib/labor';
import { PROVINCES } from '@/lib/catalogs';
import { Combobox } from '@/components/ui/Combobox';
import { Modal } from '@/components/profile/ui';
import { Pager } from './CvSourcingPanel';

// Đợt 135 — Admin "Ứng viên → Công nhân · SV · TTS": quản lý hồ sơ lao động phổ thông với cùng bộ chức năng như hồ sơ
// văn phòng: tìm (tên/SĐT/việc muốn làm/ghi chú, gõ không dấu), lọc, thẻ + ghi chú nội bộ, gợi ý tin gần nơi ở,
// mời ứng tuyển, ẩn/hiện hồ sơ, xem lịch sử ứng tuyển + sổ gọi điện của NTD.
type Q = { q?: string; kind?: string; province?: string; group?: string; shift?: string; seeking?: string; hidden?: string; account?: string; tag?: string; stale?: string; sort?: string };

export function WorkerCandidatesPanel({ token, onCounts }: { token: string; onCounts?: (n: number) => void }) {
  const [f, setFilters] = useState<Q>({});
  const [qInput, setQInput] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof workersApi.adminList>> | null>(null);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

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
      <div className="text-xs text-ink-faint">{data ? `${formatNumber(data.total)} hồ sơ` : ''}</div>
      <div className="rounded-xl bg-white border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-ink-faint bg-surface-alt">
                <th className="py-2.5 px-4 font-semibold">Người lao động</th>
                <th className="py-2.5 px-3 font-semibold">Việc muốn làm · ca</th>
                <th className="py-2.5 px-3 font-semibold">Thẻ / ghi chú</th>
                <th className="py-2.5 px-3 font-semibold">Trạng thái</th>
                <th className="py-2.5 px-3 font-semibold text-right">Ứng tuyển · NTD gọi</th>
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody className={loading ? 'opacity-60' : ''}>
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-ink-faint py-10">Không có hồ sơ nào phù hợp.</td>
                </tr>
              )}
              {data?.items.map((w: AdminWorkerRow) => (
                <tr key={w.id} className="border-t border-border align-top">
                  <td className="py-3 px-4 min-w-[200px]">
                    <div className="font-bold flex items-center gap-1.5 flex-wrap">
                      {w.fullName}
                      <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-primary-tint text-primary">{KIND_LABEL[w.kind]}</span>
                      {w.hasAccount && <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-success-tint text-success">Có tài khoản</span>}
                    </div>
                    <div className="text-ink-faint">{[w.phone, `${GENDER_LABEL[w.gender] ?? ''} ${w.age} tuổi`.trim(), w.place && w.place !== 'Chưa rõ quận/huyện' ? `${w.place}, ${w.province}` : w.province].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="py-3 px-3 max-w-[220px]">
                    <div>{w.desiredJobs.join(', ') || '—'}</div>
                    {w.shifts.length > 0 && <div className="text-ink-faint">🕒 {w.shifts.join(', ')}</div>}
                  </td>
                  <td className="py-3 px-3 max-w-[200px]">
                    <div className="flex flex-wrap gap-1">
                      {w.tags.map((t) => (<span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-info-tint text-info">{t}</span>))}
                    </div>
                    {w.note && <div className="text-ink-faint mt-1 line-clamp-2">📝 {w.note}</div>}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {w.isHidden ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-critical-tint text-critical">Đã ẩn</span>
                    ) : w.isSeeking ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success-tint text-success">Đang tìm việc</span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-alt text-ink-muted">Tạm dừng</span>
                    )}
                    <div className="text-ink-faint mt-1">Làm mới {formatDate(w.refreshedAt)}</div>
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                    <span className="font-bold">{formatNumber(w.applications)}</span> · {formatNumber(w.calls)}
                  </td>
                  <td className="py-3 px-4 text-right">
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
              {p.relativePhone ? ` · Người thân: ${p.relativePhone}` : ''} · {GENDER_LABEL[p.gender] ?? ''} · sinh {formatDate(p.birthDate)}
            </div>
            <div className="text-ink-muted">📍 {placeText(p)}{p.addressDetail ? ` — ${p.addressDetail}` : ''}{p.radiusKm ? ` · muốn làm trong ${p.radiusKm} km` : ''}</div>
            {p.shifts.length > 0 && <div>🕒 Ca có thể làm: {p.shifts.join(', ')}</div>}
            {(p.needsHousing || p.needsShuttle) && <div>Cần: {[p.needsHousing && 'chỗ ở', p.needsShuttle && 'xe đưa đón'].filter(Boolean).join(', ')}</div>}
            {p.school && <div>Trường: {p.school}{p.major ? ` · ${p.major}` : ''}</div>}
            <div className="text-ink-faint">
              {p.isSeeking ? 'Đang tìm việc' : 'Tạm dừng tìm việc'} · làm mới {formatDate(p.refreshedAt)} · đăng ký {formatDate(p.createdAt)} · {p.hasAccount ? 'có tài khoản' : 'chưa có tài khoản'}
              {p.isHidden && ' · ĐANG BỊ ẨN'}
            </div>
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
                  <span className="text-ink-faint whitespace-nowrap">{CALL_LABEL[a.status] ?? a.status} · {formatDate(a.createdAt)}</span>
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
                  <span className="text-ink-faint whitespace-nowrap">{CALL_LABEL[c.status] ?? c.status} · {formatDate(c.updatedAt)}</span>
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
          </div>
        </div>
      )}
    </Modal>
  );
}
