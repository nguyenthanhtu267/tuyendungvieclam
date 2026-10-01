'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_URL, ApiError, type JobImportRow, type JobImportData, type MailScanStatus } from '@/lib/api';
import { adminApi } from '@/lib/api-admin';
import { INDUSTRIES } from '@/lib/catalogs';
import { formatDate, formatDateTime } from '@/lib/format';

// Đợt 119 — "Hộp nhập tin từ link": dán nhiều link tin tuyển dụng → web đọc sẵn tin + công ty → Admin xem lại rồi bấm Đăng.
// Công ty mới: tự tạo hồ sơ + tài khoản nháp. Công ty đã có (nguồn ngoài): thêm vào công ty đó. Công ty đã có chủ thật: báo họ nhận.
type Tab = 'pending' | 'owner_review' | 'owner_notified' | 'published' | 'failed' | 'skipped';
const TABS: [Tab, string][] = [
  ['pending', 'Chờ xem'],
  ['owner_review', 'Công ty có chủ'],
  ['owner_notified', 'Đã báo công ty'],
  ['published', 'Đã đăng'],
  ['failed', 'Không đọc được'],
  ['skipped', 'Bỏ qua'],
];

function host(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
}

// Đợt 120 — khung "Tự động từ email": trạng thái, công tắc, nút quét ngay, hướng dẫn cài từng bước khi chưa cấu hình.
function MailAutoPanel({ token, onNewItems }: { token: string; onNewItems: () => void }) {
  const [st, setSt] = useState<MailScanStatus | null>(null);
  const [msg, setMsg] = useState('');
  const [showGuide, setShowGuide] = useState<boolean | null>(null);
  const [days, setDays] = useState(0); // 0 = từ lần quét trước
  const [pick, setPick] = useState<{ path: string; selected: boolean }[] | null>(null);
  const [pickOpen, setPickOpen] = useState<number | null>(null);
  const [pickBusy, setPickBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await adminApi.mailScanStatus(token);
      setSt(s);
      return s;
    } catch {
      return null;
    }
  }, [token]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function scanNow() {
    setMsg('');
    try {
      const r = await adminApi.mailScanNow(token, days || undefined);
      if (!r.started) return setMsg(r.reason ?? 'Không bắt đầu được.');
      setMsg('Đang quét hộp thư… (tự cập nhật khi xong)');
      for (let i = 0; i < 40; i++) {
        await new Promise((res) => setTimeout(res, 3000));
        const s = await refresh();
        if (s && !s.running) break;
      }
      setMsg('');
      onNewItems();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Có lỗi, thử lại.');
    }
  }
  async function openPick(idx: number) {
    setPickOpen(idx);
    setPick(null);
    try {
      setPick(await adminApi.mailScanLabels(token, idx));
    } catch {
      setPick([]);
    }
  }
  async function savePick() {
    if (!pick) return;
    setPickBusy(true);
    try {
      setSt(await adminApi.mailScanSetLabels(token, pick.filter((p) => p.selected).map((p) => p.path), pickOpen ?? 1));
      setPickOpen(null);
    } catch {
      setMsg('Không lưu được nhãn.');
    } finally {
      setPickBusy(false);
    }
  }
  async function toggle(v: boolean) {
    try {
      setSt(await adminApi.mailScanEnabled(token, v));
    } catch {
      setMsg('Không đổi được công tắc.');
    }
  }

  if (!st) return null;
  const last = st.last;
  return (
    <div className="rounded-xl bg-white border border-border p-4 mb-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="font-bold text-sm">📧 Tự động từ email thông báo việc làm</div>
        {st.configured ? (
          <>
            {st.accounts.map((a) => (
              <span key={a.idx} className="text-[11px] font-bold rounded-full bg-success-tint text-success px-2 py-0.5">Đã kết nối {a.user}</span>
            ))}
            <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer ml-auto">
              <input type="checkbox" checked={st.enabled} onChange={(e) => toggle(e.target.checked)} />
              Tự quét mỗi 30 phút
            </label>
            <select id="mail-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="tvl-input !w-auto text-xs" aria-label="Phạm vi quét">
              <option value={0}>Thư mới từ lần trước</option>
              <option value={3}>Quét lùi 3 ngày</option>
              <option value={7}>Quét lùi 7 ngày</option>
              <option value={30}>Quét lùi 30 ngày</option>
            </select>
            <button type="button" disabled={st.running} onClick={scanNow} className="tvl-btn-primary !w-auto px-4 disabled:opacity-50">{st.running ? 'Đang quét…' : 'Quét email ngay'}</button>
          </>
        ) : (
          <>
            <span className="text-[11px] font-bold rounded-full bg-warning-tint text-[#7A4A00] px-2 py-0.5">Chưa kết nối hộp thư</span>
            <button type="button" onClick={() => setShowGuide(!(showGuide ?? true))} className="ml-auto text-xs font-bold text-primary underline">{(showGuide ?? true) ? 'Ẩn hướng dẫn' : 'Xem hướng dẫn cài đặt'}</button>
          </>
        )}
      </div>
      {msg && <div className="text-xs font-semibold text-ink-muted mt-2">{msg}</div>}
      {st.configured && (
        <div className="text-xs text-ink-faint mt-2">
          {st.accounts.map((a) => (
            <div key={a.idx}>
              {a.user}: nhãn đang đọc <b>{a.labels.join(', ')}</b>{' '}
              <button type="button" onClick={() => openPick(a.idx)} className="font-bold text-primary underline">Chọn nhãn</button>
            </div>
          ))}
          {st.senders.length ? <> · chỉ đọc thư từ: <b>{st.senders.join(', ')}</b></> : ' · đọc mọi thư trong các nhãn đã chọn (nếu có INBOX là cả hộp thư đến — nên bỏ tick INBOX và chỉ chọn nhãn tuyển dụng)'}
          {last ? (
            <>
              {' · '}Lần quét gần nhất {formatDateTime(last.at)}:{' '}
              {last.error ? <span className="text-critical font-semibold">lỗi — {last.error}</span> : <>{last.mails} thư, {last.links} link, <b>{last.added} tin mới</b>, {last.duplicates} trùng, {last.skipped} bỏ qua</>}
            </>
          ) : ' · chưa quét lần nào'}
          . Tin tìm được vào tab &ldquo;Chờ xem&rdquo; bên dưới — web không tự đăng.
        </div>
      )}
      {st.configured && pickOpen !== null && (
        <div className="mt-3 rounded-lg border border-border p-3">
          <div className="text-xs font-bold mb-2">Tick các nhãn Gmail chứa thư thông báo việc làm{st.accounts.length > 1 ? ` (${st.accounts.find((a) => a.idx === pickOpen)?.user ?? ''})` : ''}</div>
          {!pick ? (
            <div className="text-xs text-ink-faint">Đang tải danh sách nhãn…</div>
          ) : pick.length === 0 ? (
            <div className="text-xs text-critical">Không lấy được danh sách nhãn (kiểm tra lại mật khẩu ứng dụng trên Render).</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 max-h-56 overflow-y-auto">
              {pick.map((p, i) => (
                <label key={p.path} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={p.selected} onChange={(e) => setPick((arr) => (arr ? arr.map((x, j) => (j === i ? { ...x, selected: e.target.checked } : x)) : arr))} />
                  {p.path}
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <button type="button" disabled={pickBusy || !pick?.length} onClick={savePick} className="tvl-btn-primary !w-auto px-4 disabled:opacity-50">Lưu nhãn</button>
            <button type="button" onClick={() => setPickOpen(null)} className="tvl-btn-ghost !w-auto px-4">Đóng</button>
          </div>
        </div>
      )}
      {!st.configured && (showGuide ?? true) && (
        <ol className="mt-3 text-xs text-ink-muted list-decimal pl-5 flex flex-col gap-1.5 max-w-3xl">
          <li>Mở <b>myaccount.google.com/security</b> bằng Gmail nhận thông báo việc làm → bật <b>Xác minh 2 bước</b> (nếu chưa bật).</li>
          <li>IMAP của Gmail hiện luôn bật (nếu trang <b>Cài đặt → Chuyển tiếp và POP/IMAP</b> không còn nút bật/tắt IMAP thì bỏ qua bước này). Nên chọn &ldquo;Tắt Tự động xóa&rdquo; ở mục IMAP cho an toàn.</li>
          <li>Mở <b>myaccount.google.com/apppasswords</b> → đặt tên &ldquo;Web tuyển dụng&rdquo; → <b>Tạo</b> → chép dãy 16 ký tự (chỉ hiện 1 lần). Đây là &ldquo;mật khẩu ứng dụng&rdquo;, KHÁC mật khẩu Gmail; thu hồi được bất cứ lúc nào. Đừng gửi cho ai, kể cả tôi.</li>
          <li>Nếu Gmail của bạn đã có nhãn riêng cho từng trang tuyển dụng (vd. Việc làm/CareerViet) thì dùng luôn — sau khi kết nối sẽ tick chọn nhãn ngay trên web. Chưa có thì tạo nhãn + bộ lọc để thư tuyển dụng tự gắn nhãn, web sẽ không đọc thư cá nhân.</li>
          <li>Vào <b>Render → dịch vụ API → Environment → Add</b>, thêm các biến: <code>MAIL_IMAP_USER</code> = địa chỉ Gmail · <code>MAIL_IMAP_PASS</code> = 16 ký tự ở bước 3 · <code>MAIL_SENDERS</code> = tên người gửi cách nhau dấu phẩy, ví dụ careerviet,topcv (không bắt buộc) · <code>MAIL_CRON_KEY</code> = một chuỗi bí mật tự đặt (dùng ở bước 7).</li>
          <li>Muốn thêm Gmail thứ 2 (tối đa 5): lặp lại bước 1–3 cho Gmail đó, rồi thêm <code>MAIL_IMAP_USER_2</code> và <code>MAIL_IMAP_PASS_2</code> (Gmail thứ 3: <code>_3</code>…). Mỗi Gmail chọn nhãn riêng.</li>
          <li>Bấm <b>Save</b> rồi chờ Render khởi động lại. Quay lại đây tải lại trang: thấy &ldquo;Đã kết nối&rdquo; → bấm <b>Quét email ngay</b> để thử, rồi tick <b>Tự quét mỗi 30 phút</b>.</li>
          <li>(Để tự quét ổn định dù Render miễn phí ngủ) Tạo tài khoản miễn phí ở <b>cron-job.org</b> → Create cronjob → URL: <code className="break-all">{API_URL}/public/mail-scan/run?key=KHÓA_Ở_BƯỚC_5</code> → chạy mỗi 30 phút. Cách này vừa đánh thức Render vừa quét email.</li>
        </ol>
      )}
    </div>
  );
}

export function ImportInbox({ token }: { token: string }) {
  const [text, setText] = useState('');
  const [tab, setTab] = useState<Tab>('pending');
  const [data, setData] = useState<{ items: JobImportRow[]; counts: Record<string, number> } | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<JobImportData>({});
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await adminApi.listImports(token, tab));
    } catch {
      /* giữ danh sách cũ */
    }
  }, [token, tab]);
  useEffect(() => {
    load();
  }, [load]);

  async function readLinks() {
    const urls = text.split(/\s+/).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s));
    if (!urls.length) return setMsg('Hãy dán link bắt đầu bằng http:// hoặc https://');
    setBusy(true);
    setMsg('');
    try {
      const r = await adminApi.addImportLinks(token, urls);
      const n = r.results.filter((x) => x.result === 'new').length;
      const dup = r.results.filter((x) => x.result === 'duplicate').length;
      const bad = r.results.filter((x) => x.result === 'failed').length;
      setMsg(`Đã đọc ${r.results.length} link: ${n} tin mới${dup ? `, ${dup} trùng (bỏ qua)` : ''}${bad ? `, ${bad} không đọc được` : ''}.`);
      setText('');
      await load();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Không đọc được, thử lại sau.');
    } finally {
      setBusy(false);
    }
  }

  function toggle(r: JobImportRow) {
    setRowMsg('');
    if (open === r.id) return setOpen(null);
    setOpen(r.id);
    setEdit({ ...r.data });
  }

  async function act(r: JobImportRow, kind: 'publish' | 'notify' | 'skip') {
    setRowBusy(r.id);
    setRowMsg('');
    try {
      if (kind === 'publish') await adminApi.publishImport(token, r.id, edit as Record<string, unknown>);
      else if (kind === 'notify') await adminApi.notifyImportOwner(token, r.id);
      else await adminApi.skipImport(token, r.id);
      setOpen(null);
      await load();
    } catch (e) {
      setRowMsg(e instanceof ApiError ? e.message : 'Có lỗi, thử lại.');
    } finally {
      setRowBusy(null);
    }
  }

  const counts = data?.counts ?? {};
  const set = (k: keyof JobImportData, v: string) => setEdit((p) => ({ ...p, [k]: v }));

  return (
    <>
    <MailAutoPanel token={token} onNewItems={load} />
    <div className="rounded-xl bg-white border border-border p-4 mb-5">
      <div className="font-bold text-sm mb-1">📥 Nhập tin từ link</div>
      <div className="text-xs text-ink-faint mb-2 max-w-2xl">
        Dán link tin tuyển dụng (từ email thông báo việc làm…), mỗi dòng 1 link, tối đa 20. Web tự đọc tin và công ty, bỏ qua link trùng. Bạn xem lại rồi mới bấm Đăng.
      </div>
      <textarea id="imp-links" value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="https://…" className="tvl-input w-full text-xs" />
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <button type="button" onClick={async () => { const r = await adminApi.mergeImportDuplicates(token); setMsg(r.merged ? `Đã gộp ${r.merged} tin trùng.` : 'Không có tin trùng.'); load(); }} className="tvl-btn-ghost !w-auto px-4">Gộp tin trùng</button>
        <button type="button" disabled={busy || !text.trim()} onClick={readLinks} className="tvl-btn-primary !w-auto px-5 disabled:opacity-50">
          {busy ? 'Đang đọc… (có thể mất vài giây)' : 'Đọc tin'}
        </button>
        {msg && <span className="text-xs font-semibold text-ink-muted">{msg}</span>}
      </div>

      <div className="flex gap-1 mt-4 mb-3 border-b border-border text-[13px] font-bold overflow-x-auto" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setOpen(null); }} className={`px-3 py-2 border-b-2 -mb-px whitespace-nowrap ${tab === k ? 'text-primary border-primary' : 'text-ink-faint border-transparent'}`}>
            {l} ({counts[k] ?? 0})
          </button>
        ))}
      </div>

      {!data ? (
        <div className="text-xs text-ink-faint py-4">Đang tải…</div>
      ) : data.items.length === 0 ? (
        <div className="text-xs text-ink-faint py-4">Chưa có mục nào ở tab này.</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.items.map((r) => {
            const d = r.data ?? {};
            const mc = r.matchedCompany;
            const badge = r.status === 'failed' ? null : mc?.name
              ? r.companyHasOwner
                ? { t: `Công ty đã có chủ: ${mc.name}`, c: 'bg-critical-tint text-critical' }
                : { t: `Thêm vào công ty có sẵn: ${mc.name}`, c: 'bg-success-tint text-success' }
              : { t: 'Công ty mới — sẽ tạo hồ sơ + tài khoản nháp', c: 'bg-primary-tint text-primary' };
            const canPublish = r.status === 'pending' || r.status === 'failed';
            return (
              <li key={r.id} className="rounded-lg border border-border">
                <button type="button" onClick={() => toggle(r)} className="w-full text-left px-3 py-2.5 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[13px] truncate">{d.title || '(chưa đọc được chức danh)'}</div>
                    <div className="text-[11.5px] text-ink-faint truncate">
                      {d.companyName || '—'}
                      {d.location ? ` · ${d.location}` : ''}
                      {d.salaryMin != null || d.salaryMax != null ? ` · ${d.salaryMin ?? '?'}–${d.salaryMax ?? '?'} triệu` : ''}
                      {` · ${host(r.sourceUrl)} · ${formatDate(r.createdAt)}`}
                    </div>
                    {badge && <span className={`inline-block mt-1 text-[10.5px] font-bold rounded-full px-2 py-0.5 ${badge.c}`}>{badge.t}</span>}
                    {r.status === 'failed' && r.note && <div className="text-[11px] text-critical mt-1">{r.note}</div>}
                  </div>
                  <span className="text-ink-faint text-xs">{open === r.id ? '▲' : '▼'}</span>
                </button>
                {open === r.id && (
                  <div className="border-t border-border p-3 flex flex-col gap-2 text-xs">
                    <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline break-all">↗ Mở link gốc để đối chiếu</a>
                    {canPublish ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1">Chức danh<input className="tvl-input" value={edit.title ?? ''} onChange={(e) => set('title', e.target.value)} /></label>
                        <label className="flex flex-col gap-1">Tên công ty<input className="tvl-input" value={edit.companyName ?? ''} onChange={(e) => set('companyName', e.target.value)} /></label>
                        <label className="flex flex-col gap-1">Ngành nghề
                          <select className="tvl-input" value={edit.industry ?? ''} onChange={(e) => set('industry', e.target.value)}>
                            <option value="">— Chọn ngành —</option>
                            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">Địa điểm<input className="tvl-input" value={edit.location ?? ''} onChange={(e) => set('location', e.target.value)} /></label>
                        <label className="flex flex-col gap-1">Lương từ (triệu)<input className="tvl-input" inputMode="numeric" value={edit.salaryMin ?? ''} onChange={(e) => setEdit((p) => ({ ...p, salaryMin: e.target.value ? Number(e.target.value) : undefined }))} /></label>
                        <label className="flex flex-col gap-1">Lương đến (triệu)<input className="tvl-input" inputMode="numeric" value={edit.salaryMax ?? ''} onChange={(e) => setEdit((p) => ({ ...p, salaryMax: e.target.value ? Number(e.target.value) : undefined }))} /></label>
                        <label className="flex flex-col gap-1">Hạn nộp<input className="tvl-input" type="date" value={edit.deadline ?? ''} onChange={(e) => set('deadline', e.target.value)} /></label>
                        <label className="flex flex-col gap-1">Website công ty<input className="tvl-input" value={edit.companyWebsite ?? ''} onChange={(e) => set('companyWebsite', e.target.value)} /></label>
                        <label className="flex flex-col gap-1 sm:col-span-2">Mô tả (HTML)<textarea className="tvl-input" rows={5} value={edit.description ?? ''} onChange={(e) => set('description', e.target.value)} /></label>
                      </div>
                    ) : (
                      <div className="text-ink-muted">
                        {r.status === 'owner_review' && 'Công ty này đã có chủ thật nên không đăng hộ. Bấm "Báo công ty nhận tin" để họ nhận tin đã điền sẵn trong mục Tin đăng.'}
                        {r.status === 'owner_notified' && 'Đã báo công ty, đang chờ họ nhận hoặc bỏ qua.'}
                        {r.status === 'published' && 'Tin đã được đăng.'}
                        {r.status === 'skipped' && 'Mục này đã bị bỏ qua.'}
                      </div>
                    )}
                    {rowMsg && <div className="text-critical font-semibold">{rowMsg}</div>}
                    <div className="flex gap-2 flex-wrap">
                      {canPublish && <button type="button" disabled={rowBusy === r.id} onClick={() => act(r, 'publish')} className="tvl-btn-primary !w-auto px-4 disabled:opacity-50">{rowBusy === r.id ? 'Đang đăng…' : 'Đăng tin'}</button>}
                      {r.status === 'owner_review' && <button type="button" disabled={rowBusy === r.id} onClick={() => act(r, 'notify')} className="tvl-btn-primary !w-auto px-4 disabled:opacity-50">Báo công ty nhận tin</button>}
                      {['pending', 'failed', 'owner_review'].includes(r.status) && <button type="button" disabled={rowBusy === r.id} onClick={() => act(r, 'skip')} className="tvl-btn-ghost !w-auto px-4">Bỏ qua</button>}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
    </>
  );
}
