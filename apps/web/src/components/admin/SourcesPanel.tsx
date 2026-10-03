'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, type JobSourcePreview, type JobSourceRow } from '@/lib/api';
import { adminApi } from '@/lib/api-admin';
import { formatNumber, formatTimeDate } from '@/lib/format';
import { SortTh, useSort } from '@/components/ui/SortTh';
import { SourceLink } from '@/components/ui/SourceLink';

// Đợt 147 — "Nguồn theo dõi": dán link công ty / ngành nghề / từ khoá của một trang tuyển dụng (hoặc gõ tên công ty để tìm),
// hệ thống đọc hết tin, đưa vào "Hộp nhập tin từ link" (Chờ xem) và tự quét lại mỗi ngày để lấy tin mới.
const KIND_LABEL: Record<string, string> = { company: 'Công ty', category: 'Ngành nghề', keyword: 'Từ khoá', list: 'Danh sách' };

function errText(e: unknown) {
  return e instanceof ApiError ? e.message : (e as Error)?.message || 'Có lỗi xảy ra';
}

export function SourcesPanel({ token }: { token: string }) {
  const [rows, setRows] = useState<JobSourceRow[] | null>(null);
  const [running, setRunning] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [cronKeySet, setCronKeySet] = useState(true);
  const [mode, setMode] = useState<'link' | 'name'>('link');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [site, setSite] = useState('');
  const [manual, setManual] = useState(true);
  const [stepping, setStepping] = useState<string | null>(null);
  const [sites, setSites] = useState<{ id: string; name: string; canSearch: boolean }[]>([]);
  const [prev, setPrev] = useState<JobSourcePreview | null>(null);
  const [found, setFound] = useState<{ name: string; url: string; listingUrl: string }[] | null>(null);
  const [autoPub, setAutoPub] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(true);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await adminApi.sourcesList(token);
      setRows(r.items);
      setRunning(r.running);
      setRunningId(r.runningId);
      setCronKeySet(r.cronKeySet);
    } catch {
      setRows((x) => x ?? []);
    }
  }, [token]);

  useEffect(() => {
    load();
    adminApi.sourcesSites(token).then((s) => { setSites(s); setSite((cur) => cur || s.find((x) => x.canSearch)?.id || ''); }).catch(() => undefined);
  }, [load, token]);

  // Đang quét thì tự làm mới số liệu mỗi 4 giây.
  useEffect(() => {
    if (poll.current) clearInterval(poll.current);
    if (running) poll.current = setInterval(load, 4000);
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [running, load]);

  const SL = (id: string) => sites.find((x) => x.id === id)?.name ?? (id === 'generic' ? 'Trang khác' : id);
  const ss = useSort(rows, {
    label: (r: JobSourceRow) => r.label,
    site: (r: JobSourceRow) => SL(r.site),
    kind: (r: JobSourceRow) => KIND_LABEL[r.kind],
    total: (r: JobSourceRow) => r.siteTotal,
    found: (r: JobSourceRow) => r.totalFound,
    added: (r: JobSourceRow) => r.totalAdded,
    queued: (r: JobSourceRow) => r.queued ?? 0,
    lastScan: (r: JobSourceRow) => (r.lastScanAt ? new Date(r.lastScanAt) : null),
    lastAdded: (r: JobSourceRow) => r.lastAdded,
  });

  async function doPreview(u: string) {
    setMsg(null);
    setPrev(null);
    setBusy(true);
    try {
      setPrev(await adminApi.sourcesPreview(token, u.trim()));
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  }
  async function doAdd(u: string) {
    setMsg(null);
    setBusy(true);
    try {
      const r = await adminApi.sourcesAdd(token, { url: u.trim(), autoPublish: autoPub, maxPages: manual ? 1 : undefined });
      setMsg({ ok: !r.warning, text: r.warning ? `${r.item.label} — ${r.warning}` : `Đã thêm "${r.item.label}". Hệ thống sẽ đọc danh sách và nhập dần vào Hộp nhập tin (bấm "Quét ngay" để bắt đầu liền).` });
      setPrev(null);
      setUrl('');
      setFound(null);
      await load();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  }
  async function doSearch() {
    setMsg(null);
    setFound(null);
    setBusy(true);
    try {
      const r = await adminApi.sourcesSearchCompany(token, site, name.trim());
      setFound(r.items);
      if (r.note) setMsg({ ok: false, text: r.note });
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  }
  async function runNow(id?: string) {
    setMsg(null);
    try {
      const r = await adminApi.sourcesRun(token, id);
      if (!r.started) setMsg({ ok: false, text: r.reason ?? 'Chưa chạy được' });
      else setMsg({ ok: true, text: 'Đang quét nền — số liệu tự cập nhật.' });
      setRunning(r.started || running);
      setTimeout(load, 1500);
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    }
  }
  async function step(r: JobSourceRow, reset = false) {
    setMsg(null);
    setStepping(r.id);
    try {
      const x = await adminApi.sourcesStep(token, r.id, { reset });
      setMsg(
        x.reset
          ? { ok: true, text: `Đã đưa "${r.label}" về trang 1.` }
          : { ok: true, text: `Trang ${x.page}: thấy ${x.found} tin, nhập mới ${x.added}${x.already ? `, đã có sẵn ${x.already}` : ''}. ${x.hasNext ? `Bấm "Quét trang ${x.page + 1}" để đi tiếp.` : 'Đã hết trang — lần bấm sau quay lại trang 1.'}` },
      );
      await load();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setStepping(null);
    }
  }
  async function patch(id: string, b: { enabled?: boolean; autoPublish?: boolean }) {
    try {
      await adminApi.sourcesUpdate(token, id, b);
      await load();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    }
  }
  async function remove(r: JobSourceRow) {
    if (!window.confirm(`Ngừng theo dõi "${r.label}"? Các tin đã nhập vào Hộp nhập tin vẫn giữ nguyên.`)) return;
    try {
      await adminApi.sourcesRemove(token, r.id);
      await load();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    }
  }
  async function siteSwitch(s: string, enabled: boolean) {
    await adminApi.sourcesSiteEnabled(token, s, enabled).catch(() => undefined);
    await load();
  }

  const siteIds = Array.from(new Set((rows ?? []).map((r) => r.site)));
  const inp = 'tvl-input !py-1.5 text-sm';
  const status = (r: JobSourceRow) => {
    if (runningId === r.id) return <span className="font-bold text-info">Đang quét…</span>;
    if (!r.enabled) return <span className="font-bold text-ink-faint">Đã tắt</span>;
    if (r.lastError) return <span className="font-bold text-critical" title={r.lastError}>Lỗi</span>;
    if (r.cursorPage > 0) return <span className="font-bold text-warning">Đang đọc dở trang {r.cursorPage}</span>;
    if ((r.queued ?? 0) > 0) return <span className="font-bold text-warning">Còn {r.queued} tin chờ nhập</span>;
    return <span className="font-bold text-success">Đã cập nhật</span>;
  };

  return (
    <section className="rounded-xl border border-border bg-white p-4 mb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="font-bold text-[15px]">Nguồn theo dõi — tự lấy tin theo công ty / ngành nghề</h2>
          <p className="text-xs text-ink-faint max-w-3xl mt-0.5">
            Dán link trang công ty, ngành nghề hoặc từ khoá của trang tuyển dụng (hoặc gõ tên công ty để tìm). Hệ thống đọc hết các trang, đưa tin vào <b>Hộp nhập tin từ link</b> ở bên dưới để bạn xem lại, rồi quét lại mỗi ngày để lấy tin mới. Mặc định <b>không tự đăng</b>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => runNow()} disabled={running} className="rounded-md bg-primary text-white font-bold text-xs px-3 py-2 disabled:opacity-50">
            {running ? 'Đang quét…' : '▶ Quét tất cả nguồn đến hạn'}
          </button>
          <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-md border border-border-strong bg-white font-bold text-xs px-3 py-2">{open ? 'Thu gọn' : 'Mở ra'}</button>
        </div>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="rounded-lg border border-border p-3 flex flex-col gap-2">
            <div className="inline-flex rounded-lg border border-border-strong overflow-hidden self-start text-xs font-bold">
              {([['link', 'Dán link'], ['name', 'Tìm công ty theo tên']] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={mode === k} onClick={() => { setMode(k); setMsg(null); setPrev(null); setFound(null); }} className={`px-3 py-1.5 ${mode === k ? 'bg-primary text-white' : 'bg-white text-ink-muted'}`}>{l}</button>
              ))}
            </div>
            {mode === 'link' ? (
              <div className="flex gap-2 flex-wrap">
                <input id="src-url" aria-label="Link nguồn" className={`${inp} flex-1 min-w-[16rem]`} placeholder="Dán link công ty, ngành nghề hoặc từ khoá của bất kỳ trang tuyển dụng nào" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && url.trim()) doPreview(url); }} />
                <button type="button" disabled={busy || !url.trim()} onClick={() => doPreview(url)} className="rounded-md bg-info-tint text-info font-bold text-xs px-3 py-2 disabled:opacity-50">{busy ? 'Đang đọc…' : 'Đọc thử'}</button>
                <button type="button" disabled={busy || !url.trim()} onClick={() => doAdd(url)} className="rounded-md bg-success-tint text-success font-bold text-xs px-3 py-2 disabled:opacity-50">Thêm luôn</button>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <select id="src-site" aria-label="Trang tuyển dụng" className={`${inp} !w-auto`} value={site} onChange={(e) => setSite(e.target.value)}>
                  {sites.filter((s) => s.canSearch).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
                <input id="src-name" aria-label="Tên công ty" className={`${inp} flex-1 min-w-[14rem]`} placeholder="Tên công ty cần tìm" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim().length > 1) doSearch(); }} />
                <button type="button" disabled={busy || name.trim().length < 2 || !site} onClick={doSearch} className="rounded-md bg-info-tint text-info font-bold text-xs px-3 py-2 disabled:opacity-50">{busy ? 'Đang tìm…' : '🔎 Tìm'}</button>
              </div>
            )}
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink-muted">
              <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> Tôi quét từng trang bằng tay: tự động chỉ đọc trang đầu, các trang sau bấm &ldquo;Quét trang tiếp&rdquo; ở bảng bên dưới
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink-muted">
              <input type="checkbox" checked={autoPub} onChange={(e) => setAutoPub(e.target.checked)} /> Cho phép tự đăng (theo chế độ &ldquo;tự đăng 15/30 phút&rdquo; của Hộp nhập tin) — mặc định để Chờ xem
            </label>

            {found && found.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {found.map((f) => (
                  <li key={f.url} className="flex items-center gap-2 flex-wrap rounded-md border border-border px-2.5 py-1.5 text-sm">
                    <span className="font-bold min-w-0 flex-1 break-words">{f.name}</span>
                    <SourceLink url={f.url} className="text-xs" />
                    <button type="button" disabled={busy} onClick={() => doAdd(f.url)} className="rounded-md bg-primary text-white font-bold text-xs px-3 py-1.5 disabled:opacity-50">Theo dõi công ty này</button>
                  </li>
                ))}
              </ul>
            )}

            {prev && (
              <div className="rounded-lg border border-border bg-surface-alt p-3 text-sm flex flex-col gap-1.5">
                <div className="font-bold">{prev.label}</div>
                <div className="text-xs text-ink-muted">
                  {prev.siteName} · {KIND_LABEL[prev.kind]} · đọc được <b>{prev.found}</b> tin ở trang đầu{prev.total ? <> · nguồn ghi tổng <b>{formatNumber(prev.total)}</b> tin</> : null}{prev.lastPage ? <> · {prev.lastPage}+ trang</> : null}
                </div>
                {!prev.trusted && <div className="text-xs text-warning font-semibold">Trang này dùng bộ đọc chung (chưa kiểm chứng riêng) — hãy xem kỹ vài tin đầu sau khi quét.</div>}
                {prev.warning && <div className="text-xs text-critical font-semibold">{prev.warning}</div>}
                <ul className="text-xs list-disc pl-5 break-all text-ink-muted">{prev.sample.map((s) => (<li key={s}>{s}</li>))}</ul>
                <div><button type="button" disabled={busy} onClick={() => doAdd(url)} className="rounded-md bg-primary text-white font-bold text-xs px-3 py-2 disabled:opacity-50">Thêm vào theo dõi</button></div>
              </div>
            )}
            {msg && <div role="status" className={`text-xs font-bold ${msg.ok ? 'text-success' : 'text-critical'}`}>{msg.text}</div>}
          </div>

          {rows && rows.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-ink-faint bg-surface-alt whitespace-nowrap">
                      <SortTh s={ss} k="label" className="py-2.5 px-3 font-semibold">Nguồn</SortTh>
                      <SortTh s={ss} k="site" className="py-2.5 px-3 font-semibold">Trang</SortTh>
                      <SortTh s={ss} k="kind" className="py-2.5 px-3 font-semibold">Loại</SortTh>
                      <SortTh s={ss} k="total" align="right" className="py-2.5 px-3 font-semibold">Tổng ở nguồn</SortTh>
                      <SortTh s={ss} k="found" align="right" className="py-2.5 px-3 font-semibold">Đã thấy mới</SortTh>
                      <SortTh s={ss} k="added" align="right" className="py-2.5 px-3 font-semibold">Đã nhập</SortTh>
                      <SortTh s={ss} k="queued" align="right" className="py-2.5 px-3 font-semibold">Chờ nhập</SortTh>
                      <SortTh s={ss} k="lastScan" className="py-2.5 px-3 font-semibold">Quét gần nhất</SortTh>
                      <SortTh s={ss} k="lastAdded" align="right" className="py-2.5 px-3 font-semibold">Lần đó +</SortTh>
                      <th className="py-2.5 px-3 font-semibold">Trạng thái</th>
                      <th className="py-2.5 px-3 font-semibold">Bật</th>
                      <th className="py-2.5 px-3 font-semibold">Tự đăng</th>
                      <th className="py-2.5 px-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {ss.rows.map((r) => (
                      <tr key={r.id} className="border-t border-border align-top">
                        <td className="py-2.5 px-3 min-w-[200px]">
                          <div className="font-bold break-words">{r.label}</div>
                          <SourceLink url={r.originalUrl || r.url} />
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">{SL(r.site)}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">{KIND_LABEL[r.kind]}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{r.siteTotal != null ? formatNumber(r.siteTotal) : '—'}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatNumber(r.totalFound)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold">{formatNumber(r.totalAdded)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatNumber(r.queued ?? 0)}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap tabular-nums text-ink-muted">{r.lastScanAt ? formatTimeDate(r.lastScanAt) : '—'}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{r.lastScanAt ? r.lastAdded : '—'}</td>
                        <td className="py-2.5 px-3 min-w-[120px]">{status(r)}{r.lastError && <div className="text-critical mt-0.5 break-words max-w-[200px]">{r.lastError}</div>}</td>
                        <td className="py-2.5 px-3"><input type="checkbox" aria-label={`Bật theo dõi ${r.label}`} checked={r.enabled} onChange={(e) => patch(r.id, { enabled: e.target.checked })} /></td>
                        <td className="py-2.5 px-3"><input type="checkbox" aria-label={`Cho tự đăng ${r.label}`} checked={r.autoPublish} onChange={(e) => patch(r.id, { autoPublish: e.target.checked })} /></td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-right">
                          <button type="button" disabled={running || stepping === r.id} onClick={() => step(r)} className="mr-1.5 rounded-md bg-success-tint text-success font-bold px-2.5 py-1.5 disabled:opacity-50">{stepping === r.id ? 'Đang quét…' : `Quét trang ${r.manualPage ?? 1} ▶`}</button>
                          {(r.manualPage ?? 1) > 1 && <button type="button" disabled={running} onClick={() => step(r, true)} title="Đưa về trang 1" className="mr-1.5 rounded-md border border-border-strong bg-white font-bold px-2 py-1.5">↺ Trang 1</button>}
                          <button type="button" disabled={running} onClick={() => runNow(r.id)} className="mr-1.5 rounded-md bg-primary-tint text-primary font-bold px-2.5 py-1.5 disabled:opacity-50">Quét ngay</button>
                          <button type="button" onClick={() => remove(r)} className="rounded-md bg-critical-tint text-critical font-bold px-2.5 py-1.5">Xoá</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {siteIds.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-t border-border text-xs bg-surface-alt">
                  <span className="text-ink-faint font-semibold">Bật/tắt cả trang:</span>
                  {siteIds.map((s) => (
                    <span key={s} className="inline-flex gap-1">
                      <button type="button" onClick={() => siteSwitch(s, true)} className="rounded-md border border-border-strong bg-white font-bold px-2 py-1">Bật {SL(s)}</button>
                      <button type="button" onClick={() => siteSwitch(s, false)} className="rounded-md border border-border-strong bg-white font-bold px-2 py-1 text-critical">Tắt {SL(s)}</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            rows && <div className="text-center text-ink-faint text-sm py-4">Chưa theo dõi nguồn nào.</div>
          )}

          <p className="text-xs text-ink-faint">
            Quét tự động mỗi ngày khi có dịch vụ gọi định kỳ (cron-job.org) tới địa chỉ quét Gmail đã cài: <code>/public/mail-scan/run?key=…</code> — cùng lần gọi đó cũng quét các nguồn ở đây.{!cronKeySet && <b className="text-warning"> Chưa đặt khoá MAIL_CRON_KEY trên Render nên chưa gọi định kỳ được.</b>} Luôn tôn trọng điều khoản của trang nguồn: hệ thống đọc từng lô nhỏ, giãn nhịp, và luôn giữ nút &ldquo;Nguồn tại đây&rdquo;.
          </p>
        </div>
      )}
    </section>
  );
}
