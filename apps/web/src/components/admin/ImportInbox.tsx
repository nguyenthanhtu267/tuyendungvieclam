'use client';

import { SourceLink } from '@/components/ui/SourceLink';
import { useCallback, useEffect, useState } from 'react';
import { API_URL, ApiError, type JobImportRow, type JobImportData, type MailScanStatus } from '@/lib/api';
import { adminApi } from '@/lib/api-admin';
import { SearchSelect } from './SearchSelect';
import { ChannelChips, CHANNEL_ICON, CHANNEL_LABEL } from '@/components/ChannelChips';
import { LABOR_GROUPS } from '@/lib/labor';
import { INDUSTRIES, EXPERIENCE_LEVELS, LEVELS, GENDER_OPTIONS } from '@/lib/catalogs';
import { formatTimeDate } from '@/lib/format';
import { SortTh, useSort } from '@/components/ui/SortTh';

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
  const [pickErr, setPickErr] = useState('');
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
    setPickErr('');
    try {
      const r = await adminApi.mailScanLabels(token, idx);
      setPick(r.items);
      setPickErr(r.error ?? '');
    } catch {
      setPick([]);
      setPickErr('Không gọi được máy chủ, thử lại.');
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
  const [apBusy, setApBusy] = useState(false);
  async function setAutoPublish(m: number) {
    setApBusy(true);
    try {
      setSt(await adminApi.mailScanAutoPublish(token, m));
    } catch {
      setMsg('Không đổi được chế độ tự đăng.');
    } finally {
      setApBusy(false);
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
      <div className="flex items-center gap-2 flex-wrap mt-2 text-xs">
        <span className="font-semibold">⏱ Tự đăng tin trong “Chờ xem” sau:</span>
        <div role="radiogroup" aria-label="Tự đăng tin" className="inline-flex rounded-lg border border-border overflow-hidden">
          {([0, 15, 30] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={(st.autoPublishMinutes ?? 0) === m}
              disabled={apBusy}
              onClick={() => setAutoPublish(m)}
              className={`px-3 py-1.5 font-bold ${(st.autoPublishMinutes ?? 0) === m ? 'bg-primary text-white' : 'bg-white text-ink'}`}
            >
              {m === 0 ? 'Tắt' : `${m} phút`}
            </button>
          ))}
        </div>
        <span className="text-ink-faint">{(st.autoPublishMinutes ?? 0) === 0 ? 'Tin mới tìm được chờ bạn xem rồi bấm Đăng.' : `Tin tìm được từ lúc bật, sau ${st.autoPublishMinutes} phút nếu chưa bấm gì sẽ tự đăng. Tin cũ đang chờ không bị đăng tự động.`}</span>
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
          {st.senders.length ? <div>Chỉ đọc thư từ: <b>{st.senders.join(', ')}</b></div> : <div>Đọc mọi thư trong các nhãn đã chọn (INBOX là cả hộp thư đến — nên bỏ tick INBOX).</div>}
          {last ? (
            <>
              {' · '}Lần quét gần nhất {formatTimeDate(last.at)}:{' '}
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
            <div className="text-xs text-critical">{pickErr || 'Không lấy được danh sách nhãn.'}</div>
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

// Đợt 124 — tin đã đăng: Xem như người dùng + Chỉnh sửa nhanh (chức danh, địa chỉ, lương, hạn, mô tả) + Đăng lại nếu gắn nhầm công ty.
function PostedJobTools({ token, row, onChanged }: { token: string; row: JobImportRow; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<{ title: string; address: string; salaryMin: string; salaryMax: string; deadline: string; description: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [m, setM] = useState('');

  async function startEdit() {
    setM('');
    setBusy(true);
    try {
      const j = (await adminApi.getJobForReview(token, row.jobId as string)) as unknown as Record<string, any>;
      setF({
        title: j.title ?? '',
        address: j.address ?? j.location ?? '',
        salaryMin: j.salaryMin != null ? String(j.salaryMin) : '',
        salaryMax: j.salaryMax != null ? String(j.salaryMax) : '',
        deadline: j.deadline ? String(j.deadline).slice(0, 10) : '',
        description: j.description ?? '',
      });
      setEditing(true);
    } catch (e) {
      setM(e instanceof ApiError ? e.message : 'Không mở được tin (có thể đã bị xóa).');
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!f) return;
    setBusy(true);
    setM('');
    try {
      await adminApi.updateJob(token, row.jobId as string, {
        title: f.title.trim(),
        address: f.address,
        salaryMin: f.salaryMin ? Number(f.salaryMin) : null,
        salaryMax: f.salaryMax ? Number(f.salaryMax) : null,
        deadline: f.deadline || undefined,
        description: f.description,
      });
      setEditing(false);
      setM('Đã lưu thay đổi.');
      onChanged();
    } catch (e) {
      setM(e instanceof ApiError ? e.message : 'Lưu không được, thử lại.');
    } finally {
      setBusy(false);
    }
  }
  async function reopen() {
    if (!window.confirm('Xóa tin đã đăng này và đưa về tab "Chờ xem" để đăng lại (ví dụ khi gắn nhầm công ty)?')) return;
    setBusy(true);
    try {
      await adminApi.reopenImport(token, row.id);
      onChanged();
    } catch (e) {
      setM(e instanceof ApiError ? e.message : 'Có lỗi, thử lại.');
      setBusy(false);
    }
  }
  const setK = (k: keyof NonNullable<typeof f>, v: string) => setF((p) => (p ? { ...p, [k]: v } : p));

  return (
    <div className="flex flex-col gap-2">
      <div className="text-ink-muted">Tin đã được đăng{row.matchedCompany?.name ? ` ở công ty ${row.matchedCompany.name}` : ''}.</div>
      <div className="flex gap-2 flex-wrap">
        <a href={`/viec-lam/${row.jobId}`} target="_blank" rel="noopener noreferrer" className="tvl-btn-primary !w-auto px-4 inline-flex items-center">Xem tin tuyển dụng ↗</a>
        <button type="button" disabled={busy} onClick={() => (editing ? setEditing(false) : startEdit())} className="tvl-btn-ghost !w-auto px-4 disabled:opacity-50">{editing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa'}</button>
        <button type="button" disabled={busy} onClick={reopen} className="tvl-btn-ghost !w-auto px-4 disabled:opacity-50">Đăng lại (gắn nhầm công ty)</button>
      </div>
      {m && <div className={m.startsWith('Đã lưu') ? 'text-success font-semibold' : 'text-critical font-semibold'}>{m}</div>}
      {editing && f && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
          <label className="flex flex-col gap-1 sm:col-span-2">Chức danh<input className="tvl-input" value={f.title} onChange={(e) => setK('title', e.target.value)} /></label>
          <label className="flex flex-col gap-1 sm:col-span-2">Địa chỉ làm việc<input className="tvl-input" value={f.address} onChange={(e) => setK('address', e.target.value)} /></label>
          <label className="flex flex-col gap-1">Lương từ (triệu)<input className="tvl-input" inputMode="numeric" value={f.salaryMin} onChange={(e) => setK('salaryMin', e.target.value)} /></label>
          <label className="flex flex-col gap-1">Lương đến (triệu)<input className="tvl-input" inputMode="numeric" value={f.salaryMax} onChange={(e) => setK('salaryMax', e.target.value)} /></label>
          <label className="flex flex-col gap-1">Hạn nộp<input className="tvl-input" type="date" value={f.deadline} onChange={(e) => setK('deadline', e.target.value)} /></label>
          <label className="flex flex-col gap-1 sm:col-span-2">Mô tả (HTML)<textarea className="tvl-input" rows={6} value={f.description} onChange={(e) => setK('description', e.target.value)} /></label>
          <div className="sm:col-span-2"><button type="button" disabled={busy || !f.title.trim()} onClick={save} className="tvl-btn-primary !w-auto px-4 disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
        </div>
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
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [chan, setChan] = useState('');
  const chanOf = (r: JobImportRow) => r.data?.channel || 'office';
  const items = (data?.items ?? []).filter((r) => !chan || chanOf(r) === chan);
  // Đợt 144 — bấm tiêu đề cột để sắp xếp (↕ tăng/giảm/bỏ).
  const ss = useSort(items, {
    title: (r) => r.data?.title,
    company: (r) => r.data?.companyName,
    location: (r) => r.data?.location,
    salary: (r) => r.data?.salaryMax ?? r.data?.salaryMin,
    source: (r) => host(r.sourceUrl),
    createdAt: (r) => new Date(r.createdAt),
    badge: (r) => r.matchedCompany?.name ?? (r.status === 'failed' ? r.note : '~'),
  });
  const chanCounts = (data?.items ?? []).reduce<Record<string, number>>((m, r) => { const c = chanOf(r); m[c] = (m[c] ?? 0) + 1; return m; }, {});
  const [bulkProg, setBulkProg] = useState('');

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
    // Tin nhập từ trước Đợt 126: đọc lại trang gốc để điền sẵn ngành nghề + các khối còn thiếu.
    if (r.status === 'pending' && !r.data?.enriched) {
      setEnriching(r.id);
      adminApi
        .enrichImport(token, r.id)
        .then((nr) => {
          setEdit({ ...(nr.data ?? {}) });
          setData((d) => (d ? { ...d, items: d.items.map((i) => (i.id === r.id ? { ...i, data: nr.data } : i)) } : d));
        })
        .catch(() => undefined)
        .finally(() => setEnriching(null));
    }
  }

  async function act(r: JobImportRow, kind: 'publish' | 'notify' | 'skip' | 'restore') {
    setRowBusy(r.id);
    setRowMsg('');
    try {
      if (kind === 'publish') await adminApi.publishImport(token, r.id, edit as Record<string, unknown>);
      else if (kind === 'notify') await adminApi.notifyImportOwner(token, r.id);
      else if (kind === 'restore') await adminApi.restoreImport(token, r.id);
      else await adminApi.skipImport(token, r.id);
      setOpen(null);
      await load();
    } catch (e) {
      setRowMsg(e instanceof ApiError ? e.message : 'Có lỗi, thử lại.');
    } finally {
      setRowBusy(null);
    }
  }

  async function bulkAct(action: 'skip' | 'restore' | 'notify', label: string) {
    if (!sel.size) return;
    setBulkBusy(true);
    setMsg('');
    try {
      const r = await adminApi.bulkImports(token, Array.from(sel), action);
      setMsg(`${label}: ${r.ok}/${sel.size} tin${r.failed.length ? `. Chưa được ${r.failed.length} tin: ${r.failed.slice(0, 2).map((f) => f.message).join(' · ')}` : '.'}`);
      setSel(new Set());
      await load();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Có lỗi, thử lại.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function publishSelected() {
    if (!sel.size || !window.confirm(`Đăng ${sel.size} tin đã chọn? Mỗi công ty mới sẽ được tạo hồ sơ + tài khoản nháp.`)) return;
    setBulkBusy(true);
    setMsg('');
    const ids = Array.from(sel);
    let ok = 0;
    const failed: { id: string; message: string }[] = [];
    try {
      // Đăng từng nhóm nhỏ (4 tin/lượt) để không bị quá thời gian chờ — chọn bao nhiêu đăng bấy nhiêu, có báo tiến độ.
      for (let i = 0; i < ids.length; i += 4) {
        setBulkProg(`Đang đăng ${Math.min(i + 4, ids.length)}/${ids.length}…`);
        try {
          const r = await adminApi.publishManyImports(token, ids.slice(i, i + 4));
          ok += r.ok;
          failed.push(...r.failed);
        } catch (e) {
          ids.slice(i, i + 4).forEach((id) => failed.push({ id, message: e instanceof ApiError ? e.message : 'Lỗi mạng' }));
        }
      }
      setMsg(`Đã đăng ${ok}/${ids.length} tin${failed.length ? `. ${failed.length} tin chưa đăng được (còn trong "Chờ xem", mở từng tin để xem lý do): ${failed.slice(0, 3).map((f) => f.message).join(' · ')}` : '.'}`);
      setSel(new Set(failed.map((f) => f.id)));
      await load();
    } finally {
      setBulkBusy(false);
      setBulkProg('');
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
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setOpen(null); setSel(new Set()); }} className={`px-3 py-2 border-b-2 -mb-px whitespace-nowrap ${tab === k ? 'text-primary border-primary' : 'text-ink-faint border-transparent'}`}>
            {l} ({counts[k] ?? 0})
          </button>
        ))}
      </div>

      {data && data.items.length > 0 && (
        <div className="mb-2"><ChannelChips value={chan} onChange={(v) => { setChan(v); setSel(new Set()); }} counts={chanCounts} /></div>
      )}
      {tab !== 'published' && data && items.length > 0 && (
        <div className="flex items-center gap-3 mb-2 text-xs flex-wrap">
          <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
            <input type="checkbox" checked={sel.size === items.length} onChange={(e) => setSel(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())} />
            Chọn tất cả ({items.length})
          </label>
          {sel.size > 0 && (
            <>
              {tab === 'pending' && <button type="button" disabled={bulkBusy} onClick={publishSelected} className="tvl-btn-primary !w-auto px-4 disabled:opacity-50">{bulkBusy ? bulkProg || 'Đang đăng…' : `Đăng ${sel.size} tin đã chọn`}</button>}
              {tab === 'owner_review' && <button type="button" disabled={bulkBusy} onClick={() => bulkAct('notify', 'Đã báo công ty')} className="tvl-btn-primary !w-auto px-4 disabled:opacity-50">Báo công ty {sel.size} tin đã chọn</button>}
              {(tab === 'skipped' || tab === 'owner_notified') && <button type="button" disabled={bulkBusy} onClick={() => bulkAct('restore', tab === 'skipped' ? 'Đã đưa về Chờ xem' : 'Đã đưa về Công ty có chủ')} className="tvl-btn-primary !w-auto px-4 disabled:opacity-50">{tab === 'skipped' ? `Đưa ${sel.size} tin về Chờ xem` : `Đưa ${sel.size} tin về Công ty có chủ`}</button>}
              {['pending', 'owner_review', 'failed'].includes(tab) && <button type="button" disabled={bulkBusy} onClick={() => bulkAct('skip', 'Đã bỏ qua')} className="tvl-btn-ghost !w-auto px-4 disabled:opacity-50">Bỏ qua {sel.size} tin</button>}
            </>
          )}
        </div>
      )}
      {!data ? (
        <div className="text-xs text-ink-faint py-4">Đang tải…</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-ink-faint py-4">{data.items.length ? 'Không có mục nào thuộc kênh này.' : 'Chưa có mục nào ở tab này.'}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px] text-[12.5px] border-collapse">
          <thead>
            <tr className="bg-surface-alt text-left text-[11.5px] font-bold text-ink-muted uppercase tracking-wide">
              {tab !== 'published' && <th className="w-9 px-2 py-2" aria-label="Chọn" />}
              <th className="w-10 px-2 py-2 text-right">STT</th>
              <SortTh s={ss} k="title" className="px-2 py-2">Chức danh</SortTh>
              <SortTh s={ss} k="company" className="px-2 py-2">Công ty</SortTh>
              <SortTh s={ss} k="location" className="px-2 py-2">Địa điểm</SortTh>
              <SortTh s={ss} k="salary" className="px-2 py-2">Lương (triệu)</SortTh>
              <SortTh s={ss} k="source" className="px-2 py-2">Nguồn</SortTh>
              <SortTh s={ss} k="createdAt" className="px-2 py-2">Ngày nhập</SortTh>
              <SortTh s={ss} k="badge" className="px-2 py-2">{tab === 'failed' ? 'Lý do' : 'Xử lý công ty'}</SortTh>
              <th className="w-8 px-2 py-2" aria-label="Mở" />
            </tr>
          </thead>
          {ss.rows.map((r) => {
            const d = r.data ?? {};
            const mc = r.matchedCompany;
            const badge = r.status === 'failed' ? null : r.status === 'published'
              ? { t: `Đã đăng: ${mc?.name ?? '—'}`, c: 'bg-success-tint text-success' }
              : mc?.name
              ? r.companyHasOwner
                ? { t: `Đã có chủ: ${mc.name}`, c: 'bg-critical-tint text-critical' }
                : { t: `Thêm vào: ${mc.name}`, c: 'bg-success-tint text-success' }
              : { t: 'Công ty mới (tạo hồ sơ nháp)', c: 'bg-primary-tint text-primary' };
            const canPublish = r.status === 'pending' || r.status === 'failed';
            const cols = (tab !== 'published' ? 1 : 0) + 9;
            const idx = ss.rows.indexOf(r) + 1;
            return (
              <tbody key={r.id} className="border-t border-border">
                <tr className={`cursor-pointer align-top hover:bg-surface-alt ${open === r.id ? 'bg-surface-alt' : ''}`} onClick={() => toggle(r)}>
                  {tab !== 'published' && (
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label="Chọn tin" checked={sel.has(r.id)} onChange={() => setSel((p) => { const n = new Set(p); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} />
                    </td>
                  )}
                  <td className="px-2 py-2 text-right text-ink-faint tabular-nums">{idx}</td>
                  <td className="px-2 py-2 font-bold max-w-[22rem]">
                    {chanOf(r) !== 'office' && <span className="mr-1.5 inline-block rounded bg-warning-tint text-[#7A4A00] text-[10.5px] font-extrabold px-1.5 py-0.5 align-middle">{CHANNEL_ICON[chanOf(r)]} {CHANNEL_LABEL[chanOf(r)]}{d.laborGroup ? ` · ${d.laborGroup}` : ''}</span>}
                    {d.title || '(chưa đọc được chức danh)'}
                  </td>
                  <td className="px-2 py-2 max-w-[16rem]">{d.companyName || '—'}</td>
                  <td className="px-2 py-2 max-w-[11rem]">{d.location || '—'}</td>
                  <td className="px-2 py-2 whitespace-nowrap tabular-nums">{d.salaryMin != null || d.salaryMax != null ? `${d.salaryMin ?? '?'}–${d.salaryMax ?? '?'}` : '—'}</td>
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}><SourceLink url={r.sourceUrl} /></td>
                  <td className="px-2 py-2 whitespace-nowrap tabular-nums text-ink-muted">{formatTimeDate(r.createdAt)}</td>
                  <td className="px-2 py-2 max-w-[16rem]">
                    {badge && <span title={badge.t} className={`inline-block text-[11px] font-bold rounded-md px-2 py-0.5 ${badge.c}`}>{badge.t}</span>}
                    {r.status === 'failed' && <span className="text-[11px] text-critical">{r.note || 'Không đọc được'}</span>}
                  </td>
                  <td className="px-2 py-2 text-ink-faint text-xs">{open === r.id ? '▲' : '▼'}</td>
                </tr>
                {open === r.id && (
                  <tr><td colSpan={cols} className="p-0"><div className="border-t border-border p-3 flex flex-col gap-2 text-xs">
                    <div><SourceLink url={r.sourceUrl} label="Nguồn tại đây — mở trang gốc để đối chiếu" /></div>
                    {canPublish ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1">Chức danh<input className="tvl-input" value={edit.title ?? ''} onChange={(e) => set('title', e.target.value)} /></label>
                        <label className="flex flex-col gap-1">Tên công ty<input className="tvl-input" value={edit.companyName ?? ''} onChange={(e) => set('companyName', e.target.value)} /></label>
                        <label className="flex flex-col gap-1">Kênh tin
                          <select className="tvl-input" value={edit.channel || 'office'} onChange={(e) => setEdit((p) => ({ ...p, channel: e.target.value, laborGroup: e.target.value === 'office' ? undefined : p.laborGroup && LABOR_GROUPS[e.target.value as 'worker']?.includes(p.laborGroup) ? p.laborGroup : undefined }))}>
                            {Object.entries(CHANNEL_LABEL).map(([k, l]) => <option key={k} value={k}>{CHANNEL_ICON[k]} {l}</option>)}
                          </select>
                        </label>
                        {edit.channel && edit.channel !== 'office' ? (
                          <div className="flex flex-col gap-1"><label htmlFor="imp-group">Nhóm việc (gõ để tìm)</label><SearchSelect id="imp-group" value={edit.laborGroup ?? ''} options={LABOR_GROUPS[edit.channel as 'worker'] ?? []} onChange={(v) => set('laborGroup', v)} /></div>
                        ) : <div className="hidden sm:block" />}
                        <div className="flex flex-col gap-1"><label htmlFor="imp-industry">Ngành nghề (gõ để tìm)</label><SearchSelect id="imp-industry" value={edit.industry ?? ''} options={INDUSTRIES} onChange={(v) => set('industry', v)} /></div>
                        <label className="flex flex-col gap-1">Địa điểm<input className="tvl-input" value={edit.location ?? ''} onChange={(e) => set('location', e.target.value)} /></label>
                        <label className="flex flex-col gap-1">Lương từ (triệu)<input className="tvl-input" inputMode="numeric" value={edit.salaryMin ?? ''} onChange={(e) => setEdit((p) => ({ ...p, salaryMin: e.target.value ? Number(e.target.value) : undefined }))} /></label>
                        <label className="flex flex-col gap-1">Lương đến (triệu)<input className="tvl-input" inputMode="numeric" value={edit.salaryMax ?? ''} onChange={(e) => setEdit((p) => ({ ...p, salaryMax: e.target.value ? Number(e.target.value) : undefined }))} /></label>
                        <label className="flex flex-col gap-1">Hạn nộp<input className="tvl-input" type="date" value={edit.deadline ?? ''} onChange={(e) => set('deadline', e.target.value)} /></label>
                        <label className="flex flex-col gap-1">Website công ty<input className="tvl-input" value={edit.companyWebsite ?? ''} onChange={(e) => set('companyWebsite', e.target.value)} /></label>
                        <label className="flex flex-col gap-1">Địa chỉ làm việc<input className="tvl-input" value={edit.address ?? ''} onChange={(e) => set('address', e.target.value)} /></label>
                        <label className="flex flex-col gap-1">Thời gian làm việc<input className="tvl-input" value={edit.workSchedule ?? ''} onChange={(e) => set('workSchedule', e.target.value)} /></label>
                        <label className="flex flex-col gap-1">Kinh nghiệm
                          <select className="tvl-input" value={edit.experienceLevel ?? ''} onChange={(e) => set('experienceLevel', e.target.value)}>
                            <option value="">— Không rõ —</option>
                            {EXPERIENCE_LEVELS.map((i) => <option key={i} value={i}>{i}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">Cấp bậc
                          <select className="tvl-input" value={edit.level ?? ''} onChange={(e) => set('level', e.target.value)}>
                            <option value="">— Không rõ —</option>
                            {LEVELS.map((i) => <option key={i} value={i}>{i}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">Số lượng tuyển<input className="tvl-input" inputMode="numeric" value={edit.headcount ?? ''} onChange={(e) => setEdit((p) => ({ ...p, headcount: e.target.value ? Number(e.target.value) : undefined }))} /></label>
                        <label className="flex flex-col gap-1">Giới tính
                          <select className="tvl-input" value={edit.gender ?? ''} onChange={(e) => set('gender', e.target.value)}>
                            <option value="">— Không rõ —</option>
                            {GENDER_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">Độ tuổi<input className="tvl-input" value={edit.ageRange ?? ''} onChange={(e) => set('ageRange', e.target.value)} /></label>
                        {enriching === r.id && <div className="sm:col-span-2 text-ink-faint">Đang đọc kỹ trang gốc để điền ngành nghề và các mục còn thiếu…</div>}
                        <label className="flex flex-col gap-1 sm:col-span-2">Mô tả công việc (HTML)<textarea className="tvl-input" rows={5} value={edit.description ?? ''} onChange={(e) => set('description', e.target.value)} /></label>
                        <label className="flex flex-col gap-1 sm:col-span-2">Yêu cầu ứng viên (HTML)<textarea className="tvl-input" rows={4} value={edit.requirements ?? ''} onChange={(e) => set('requirements', e.target.value)} /></label>
                        <label className="flex flex-col gap-1 sm:col-span-2">Quyền lợi (HTML)<textarea className="tvl-input" rows={4} value={edit.benefits ?? ''} onChange={(e) => set('benefits', e.target.value)} /></label>
                      </div>
                    ) : (
                      <div className="text-ink-muted">
                        {r.status === 'owner_review' && 'Công ty này đã có chủ thật nên không đăng hộ. Bấm "Báo công ty nhận tin" để họ nhận tin đã điền sẵn trong mục Tin đăng.'}
                        {r.status === 'owner_notified' && 'Đã báo công ty, đang chờ họ nhận hoặc bỏ qua. Nếu muốn báo lại, đưa về "Công ty có chủ".'}
                        {r.status === 'published' && (r.jobId ? <PostedJobTools token={token} row={r} onChanged={load} /> : 'Tin đã được đăng.')}
                        {r.status === 'skipped' && 'Mục này đã bị bỏ qua.'}
                      </div>
                    )}
                    {rowMsg && <div className="text-critical font-semibold">{rowMsg}</div>}
                    <div className="flex gap-2 flex-wrap">
                      {canPublish && <button type="button" disabled={rowBusy === r.id} onClick={() => act(r, 'publish')} className="tvl-btn-primary !w-auto px-4 disabled:opacity-50">{rowBusy === r.id ? 'Đang đăng…' : 'Đăng tin'}</button>}
                      {r.status === 'owner_review' && <button type="button" disabled={rowBusy === r.id} onClick={() => act(r, 'notify')} className="tvl-btn-primary !w-auto px-4 disabled:opacity-50">Báo công ty nhận tin</button>}
                      {r.status === 'skipped' && <button type="button" disabled={rowBusy === r.id} onClick={() => act(r, 'restore')} className="tvl-btn-primary !w-auto px-4 disabled:opacity-50">↩ Đưa về Chờ xem</button>}
                      {r.status === 'owner_notified' && <button type="button" disabled={rowBusy === r.id} onClick={() => act(r, 'restore')} className="tvl-btn-ghost !w-auto px-4 disabled:opacity-50">↩ Đưa về Công ty có chủ</button>}
                      {['pending', 'failed', 'owner_review'].includes(r.status) && <button type="button" disabled={rowBusy === r.id} onClick={() => act(r, 'skip')} className="tvl-btn-ghost !w-auto px-4">Bỏ qua</button>}
                    </div>
                  </div>
                  </td></tr>
                )}
              </tbody>
            );
          })}
        </table>
        </div>
      )}
    </div>
    </>
  );
}
