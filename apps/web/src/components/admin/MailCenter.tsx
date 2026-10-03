'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, type MailCampaign, type MailContact, type MailMsgFull, type MailMsgRow, type MailStatus, type MailTemplate } from '@/lib/api';
import { adminApi } from '@/lib/api-admin';
import { formatNumber, formatTimeDate } from '@/lib/format';

// Đợt 150 — "Hộp thư": nơi Admin xử lý mọi thư (thư hỗ trợ, mẫu email gửi đi, danh sách email, chiến dịch giới thiệu).
// Mọi mẫu đều sửa được; chiến dịch phải qua bước Duyệt → Gửi thử → Gửi theo lô.
type Sub = 'inbox' | 'templates' | 'contacts' | 'campaigns';
const SUBS: { id: Sub; label: string }[] = [
  { id: 'inbox', label: 'Thư hỗ trợ' },
  { id: 'templates', label: 'Mẫu email' },
  { id: 'contacts', label: 'Danh sách email' },
  { id: 'campaigns', label: 'Chiến dịch' },
];
const KIND: Record<string, string> = { reply: 'Trả lời', system: 'Hệ thống', promo: 'Giới thiệu' };
const SRC: Record<string, string> = {
  manual: 'Nhập tay', employers: 'Nhà tuyển dụng', job_contacts: 'Liên hệ trong tin', imports: 'Từ tin nhập', candidates_optin: 'Ứng viên đồng ý nhận tin',
};
const STATUS_LABEL: Record<string, string> = { new: 'Mới', replied: 'Đã trả lời', closed: 'Đã đóng' };

function errText(e: unknown) {
  return e instanceof ApiError ? e.message : (e as Error)?.message || 'Có lỗi xảy ra';
}
const btn = 'rounded-md border border-border-strong bg-white font-bold text-xs px-3 min-h-[36px] disabled:opacity-50';
const btnP = 'rounded-md bg-primary text-white font-bold text-xs px-3 min-h-[36px] disabled:opacity-50';
const inp = 'tvl-input !text-sm';

function Note({ m }: { m: { ok: boolean; text: string } | null }) {
  return m ? <div role="status" className={`text-xs font-bold ${m.ok ? 'text-success' : 'text-critical'}`}>{m.text}</div> : null;
}

export function MailCenter({ token }: { token: string }) {
  const [sub, setSub] = useState<Sub>('inbox');
  const [st, setSt] = useState<MailStatus | null>(null);
  useEffect(() => {
    adminApi.mailStatus(token).then(setSt).catch(() => undefined);
  }, [token, sub]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-bold text-base">Hộp thư</h1>
        <div className="text-xs text-ink-muted">
          {st?.address ? <>Hộp thư: <b>{st.address}</b> · đọc thư {st.imapReady ? 'bật' : 'chưa cấu hình'} · gửi thư {st.smtpReady ? 'bật' : 'chưa cấu hình'}</> : 'Chưa cấu hình hộp thư trên Render.'}
        </div>
      </div>
      {st && (!st.imapReady || !st.smtpReady) && (
        <div className="rounded-lg border border-border bg-surface-alt p-3 text-xs text-ink-muted leading-relaxed">
          Để đọc và gửi thư, thêm vào <b>Render → dịch vụ API → Environment</b> các biến: <code>SUPPORT_MAIL_USER</code> (địa chỉ hộp thư), <code>SUPPORT_MAIL_PASS</code> (mật khẩu hộp thư), <code>SUPPORT_IMAP_HOST</code>, <code>SUPPORT_SMTP_HOST</code> (tên máy chủ thư xem trong hướng dẫn của nhà cung cấp email), tuỳ chọn <code>SUPPORT_IMAP_PORT</code> (993), <code>SUPPORT_SMTP_PORT</code> (465), <code>SUPPORT_MAIL_NAME</code>. Mật khẩu chỉ nhập trên Render, không gửi cho ai và không hiện trên web. Các mẫu, danh sách và chiến dịch vẫn soạn được khi chưa cấu hình.
        </div>
      )}
      <div className="flex gap-1.5 flex-wrap">
        {SUBS.map((s) => (
          <button key={s.id} type="button" onClick={() => setSub(s.id)} className={`rounded-full px-4 min-h-[38px] text-sm font-bold border ${sub === s.id ? 'bg-primary text-white border-primary' : 'bg-white border-border-strong text-ink'}`}>
            {s.label}{s.id === 'inbox' && st && st.fresh > 0 ? ` (${st.fresh})` : ''}
          </button>
        ))}
      </div>
      {sub === 'inbox' && <Inbox token={token} ready={!!st?.imapReady} />}
      {sub === 'templates' && <Templates token={token} />}
      {sub === 'contacts' && <Contacts token={token} />}
      {sub === 'campaigns' && <Campaigns token={token} />}
    </section>
  );
}

// ---------- Thư hỗ trợ ----------
function Inbox({ token, ready }: { token: string; ready: boolean }) {
  const [rows, setRows] = useState<MailMsgRow[] | null>(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<MailMsgFull | null>(null);
  const [tpls, setTpls] = useState<MailTemplate[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setRows((await adminApi.mailInbox(token, status, q)).items);
    } catch {
      setRows([]);
    }
  }, [token, status, q]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    adminApi.mailTemplates(token).then((r) => setTpls(r.items.filter((t) => t.kind !== 'promo'))).catch(() => undefined);
  }, [token]);

  async function sync() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminApi.mailSync(token);
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: r.fetched ? `Đã lấy ${r.fetched} thư mới.` : 'Không có thư mới.' });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  }
  async function view(id: string) {
    try {
      const m = await adminApi.mailMessage(token, id);
      setOpen(m);
      setSubject(`Re: ${m.subject}`);
      setBody('');
      setMsg(null);
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    }
  }
  function applyTpl(id: string) {
    const t = tpls.find((x) => x.id === id);
    if (!t || !open) return;
    const v: Record<string, string> = { ten: open.fromName || open.fromEmail.split('@')[0], tieu_de: open.subject.replace(/^(re|fw|fwd):\s*/i, ''), cong_ty: '', web: 'https://www.vieclamngay.vn' };
    const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] ?? '');
    setSubject(fill(t.subject));
    setBody(fill(t.body));
  }
  async function send() {
    if (!open) return;
    setBusy(true);
    setMsg(null);
    try {
      await adminApi.mailReply(token, open.id, { subject, body });
      setMsg({ ok: true, text: 'Đã gửi trả lời.' });
      await view(open.id);
      await load();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  }
  async function setSt(id: string, s: string) {
    await adminApi.mailSetStatus(token, id, s).catch(() => undefined);
    await load();
    if (open?.id === id) setOpen({ ...open, status: s });
  }
  async function del(id: string) {
    if (!confirm('Xoá thư này khỏi Hộp thư (không xoá trong hộp thư gốc)?')) return;
    await adminApi.mailRemove(token, id).catch(() => undefined);
    setOpen(null);
    await load();
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-3 items-start">
      <div className="rounded-lg border border-border bg-white p-3 flex flex-col gap-2 min-w-0">
        <div className="flex gap-2 flex-wrap">
          <input aria-label="Tìm thư" className={`${inp} flex-1 min-w-[10rem]`} placeholder="Tìm người gửi, tiêu đề, nội dung" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Lọc trạng thái" className={inp} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="new">Mới</option>
            <option value="replied">Đã trả lời</option>
            <option value="closed">Đã đóng</option>
          </select>
          <button type="button" className={btnP} disabled={busy || !ready} onClick={sync} title={ready ? '' : 'Chưa cấu hình đọc thư'}>{busy ? 'Đang lấy…' : 'Lấy thư mới'}</button>
        </div>
        <Note m={msg} />
        <ul className="flex flex-col divide-y divide-border max-h-[60vh] overflow-y-auto">
          {rows?.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => view(r.id)} className={`w-full text-left py-2 px-1.5 rounded ${open?.id === r.id ? 'bg-primary-tint' : ''}`}>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`font-bold truncate flex-1 ${r.status === 'new' ? 'text-ink' : 'text-ink-muted'}`}>{r.fromName || r.fromEmail}</span>
                  <span className="text-[11px] text-ink-faint whitespace-nowrap">{formatTimeDate(r.receivedAt)}</span>
                </div>
                <div className="text-[13px] truncate">{r.subject}</div>
                <div className="text-[12px] text-ink-faint truncate">{r.preview}</div>
                <span className={`inline-block mt-0.5 text-[11px] font-bold rounded px-1.5 ${r.status === 'new' ? 'bg-accent/10 text-accent' : r.status === 'replied' ? 'bg-success-tint text-success' : 'bg-surface-alt text-ink-muted'}`}>{STATUS_LABEL[r.status]}</span>
              </button>
            </li>
          ))}
          {rows && rows.length === 0 && <li className="text-center text-ink-faint text-sm py-6">{ready ? 'Chưa có thư. Bấm "Lấy thư mới".' : 'Chưa có thư (chưa cấu hình đọc thư).'}</li>}
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-white p-3 min-w-0">
        {!open ? (
          <div className="text-center text-ink-faint text-sm py-10">Chọn một thư để xem và trả lời.</div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <div className="font-bold break-words">{open.subject}</div>
              <div className="text-xs text-ink-muted">Từ <b>{open.fromName ? `${open.fromName} <${open.fromEmail}>` : open.fromEmail}</b> · {formatTimeDate(open.receivedAt)}</div>
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm rounded-md bg-surface-alt p-3 max-h-[40vh] overflow-y-auto">{open.body}</pre>
            {open.replies.map((r) => (
              <div key={r.id} className="rounded-md border border-success/40 bg-success-tint p-2.5 text-sm">
                <div className="text-xs text-success font-bold mb-1">Đã trả lời · {formatTimeDate(r.at)}</div>
                <pre className="whitespace-pre-wrap break-words font-sans">{r.body}</pre>
              </div>
            ))}
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <div className="flex gap-2 flex-wrap items-center">
                <label htmlFor="mc-tpl" className="text-xs font-bold">Dùng mẫu</label>
                <select id="mc-tpl" className={inp} defaultValue="" onChange={(e) => { applyTpl(e.target.value); e.target.value = ''; }}>
                  <option value="">— chọn mẫu để điền —</option>
                  {tpls.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
              </div>
              <input aria-label="Tiêu đề trả lời" className={inp} value={subject} onChange={(e) => setSubject(e.target.value)} />
              <textarea aria-label="Nội dung trả lời" className={`${inp} min-h-[160px]`} placeholder="Nội dung trả lời…" value={body} onChange={(e) => setBody(e.target.value)} />
              <div className="flex gap-2 flex-wrap">
                <button type="button" className={btnP} disabled={busy || !body.trim()} onClick={send}>Gửi trả lời</button>
                {open.status !== 'closed' ? <button type="button" className={btn} onClick={() => setSt(open.id, 'closed')}>Đóng thư</button> : <button type="button" className={btn} onClick={() => setSt(open.id, 'new')}>Mở lại</button>}
                <button type="button" className={`${btn} text-critical`} onClick={() => del(open.id)}>Xoá</button>
              </div>
              <Note m={msg} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Mẫu email ----------
function Templates({ token }: { token: string }) {
  const [rows, setRows] = useState<MailTemplate[]>([]);
  const [edit, setEdit] = useState<{ id: string | null; kind: string; name: string; subject: string; body: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => adminApi.mailTemplates(token).then((r) => setRows(r.items)).catch(() => undefined), [token]);
  useEffect(() => {
    load();
  }, [load]);
  async function save() {
    if (!edit) return;
    try {
      await adminApi.mailTemplateSave(token, edit.id, edit);
      setMsg({ ok: true, text: 'Đã lưu mẫu.' });
      setEdit(null);
      load();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" className={btnP} onClick={() => setEdit({ id: null, kind: 'reply', name: '', subject: '', body: '' })}>+ Thêm mẫu</button>
        <span className="text-xs text-ink-muted">Biến dùng được: <code>{'{{ten}}'}</code> <code>{'{{cong_ty}}'}</code> <code>{'{{tieu_de}}'}</code> <code>{'{{web}}'}</code>. Văn phong nên ngắn gọn, hành chính.</span>
        <Note m={msg} />
      </div>
      {edit && (
        <div className="rounded-lg border border-primary bg-white p-3 flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <input aria-label="Tên mẫu" className={`${inp} flex-1 min-w-[12rem]`} placeholder="Tên mẫu" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <select aria-label="Loại mẫu" className={inp} value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
              {Object.entries(KIND).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
          </div>
          <input aria-label="Tiêu đề email" className={inp} placeholder="Tiêu đề email" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} />
          <textarea aria-label="Nội dung email" className={`${inp} min-h-[200px]`} placeholder="Nội dung" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" className={btnP} onClick={save}>Lưu mẫu</button>
            <button type="button" className={btn} onClick={() => setEdit(null)}>Huỷ</button>
          </div>
        </div>
      )}
      <ul className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-2 gap-2">
        {rows.map((t) => (
          <li key={t.id} className="rounded-lg border border-border bg-white p-3 flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <b className="text-sm flex-1 min-w-0 break-words">{t.name}</b>
              <span className="text-[11px] rounded bg-surface-alt px-1.5 py-0.5 font-bold">{KIND[t.kind]}</span>
            </div>
            <div className="text-xs text-ink-muted break-words">Tiêu đề: {t.subject}</div>
            <pre className="whitespace-pre-wrap break-words font-sans text-xs text-ink-muted line-clamp-4">{t.body}</pre>
            <div className="flex gap-2 flex-wrap mt-auto">
              <button type="button" className={btn} onClick={() => setEdit({ id: t.id, kind: t.kind, name: t.name, subject: t.subject, body: t.body })}>Sửa</button>
              <button type="button" className={btn} onClick={async () => { await adminApi.mailTemplateReset(token, t.id).then(() => load()).catch((e) => setMsg({ ok: false, text: errText(e) })); }}>Khôi phục gốc</button>
              <button type="button" className={`${btn} text-critical`} onClick={async () => { if (confirm(`Xoá mẫu "${t.name}"?`)) { await adminApi.mailTemplateRemove(token, t.id).catch(() => undefined); load(); } }}>Xoá</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Danh sách email ----------
function Contacts({ token }: { token: string }) {
  const [rows, setRows] = useState<MailContact[]>([]);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await adminApi.mailContacts(token, q, status, source);
      setRows(r.items);
      setTotal(r.total);
      setActive(r.active);
    } catch {
      setRows([]);
    }
  }, [token, q, status, source]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  async function add() {
    setBusy(true);
    try {
      const r = await adminApi.mailContactsAdd(token, paste);
      setMsg({ ok: true, text: `Đã thêm ${r.added} email, bỏ qua ${r.skipped} (trùng hoặc không hợp lệ).` });
      setPaste('');
      load();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  }
  async function harvest(kind: string) {
    setBusy(true);
    try {
      const r = await adminApi.mailContactsHarvest(token, kind);
      setMsg({ ok: true, text: `Đã quét ${formatNumber(r.scanned)} địa chỉ, thêm ${formatNumber(r.added)} email mới.` });
      load();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border bg-white p-3 flex flex-col gap-2">
        <div className="text-xs text-ink-muted">Tổng <b>{formatNumber(total)}</b> email · đang nhận <b>{formatNumber(active)}</b>. Địa chỉ đã hủy nhận không bao giờ được gửi lại. Chỉ nên gửi giới thiệu tới địa chỉ liên hệ công khai của doanh nghiệp hoặc người đã đồng ý nhận tin.</div>
        <textarea aria-label="Dán danh sách email" className={`${inp} min-h-[90px]`} placeholder={'Mỗi dòng một email: email, tên, công ty'} value={paste} onChange={(e) => setPaste(e.target.value)} />
        <div className="flex gap-2 flex-wrap items-center">
          <button type="button" className={btnP} disabled={busy || !paste.trim()} onClick={add}>Thêm vào danh sách</button>
          <span className="text-xs text-ink-faint">Hoặc gom từ hệ thống:</span>
          <button type="button" className={btn} disabled={busy} onClick={() => harvest('employers')}>Nhà tuyển dụng</button>
          <button type="button" className={btn} disabled={busy} onClick={() => harvest('job_contacts')}>Liên hệ trong tin</button>
          <button type="button" className={btn} disabled={busy} onClick={() => harvest('imports')}>Email trong tin nhập</button>
          <button type="button" className={btn} disabled={busy} onClick={() => harvest('candidates_optin')}>Ứng viên đồng ý nhận tin</button>
        </div>
        <Note m={msg} />
      </div>
      <div className="flex gap-2 flex-wrap">
        <input aria-label="Tìm email" className={`${inp} flex-1 min-w-[10rem]`} placeholder="Tìm email, tên, công ty" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Lọc trạng thái" className={inp} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Mọi trạng thái</option>
          <option value="active">Đang nhận</option>
          <option value="unsubscribed">Đã hủy nhận</option>
        </select>
        <select aria-label="Lọc nguồn" className={inp} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Mọi nguồn</option>
          {Object.entries(SRC).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>
      <div className="rounded-lg border border-border bg-white overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-ink-faint bg-surface-alt whitespace-nowrap">
              <th className="py-2.5 px-3 font-semibold">Email</th>
              <th className="py-2.5 px-3 font-semibold">Tên</th>
              <th className="py-2.5 px-3 font-semibold">Công ty</th>
              <th className="py-2.5 px-3 font-semibold">Nguồn</th>
              <th className="py-2.5 px-3 font-semibold">Ngày thêm</th>
              <th className="py-2.5 px-3 font-semibold">Trạng thái</th>
              <th className="py-2.5 px-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="py-2 px-3 whitespace-nowrap">{c.email}</td>
                <td className="py-2 px-3">{c.name || '—'}</td>
                <td className="py-2 px-3">{c.company || '—'}</td>
                <td className="py-2 px-3 whitespace-nowrap">{SRC[c.source] ?? c.source}</td>
                <td className="py-2 px-3 whitespace-nowrap tabular-nums text-ink-muted">{formatTimeDate(c.createdAt)}</td>
                <td className="py-2 px-3 whitespace-nowrap">{c.status === 'active' ? <span className="text-success font-bold">Đang nhận</span> : <span className="text-critical font-bold">Đã hủy nhận</span>}</td>
                <td className="py-2 px-3 whitespace-nowrap text-right">
                  <button type="button" className={`${btn} mr-1.5`} onClick={async () => { await adminApi.mailContactStatus(token, c.id, c.status === 'active' ? 'unsubscribed' : 'active').catch(() => undefined); load(); }}>{c.status === 'active' ? 'Ngừng gửi' : 'Cho nhận lại'}</button>
                  <button type="button" className={`${btn} text-critical`} onClick={async () => { await adminApi.mailContactRemove(token, c.id).catch(() => undefined); load(); }}>Xoá</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="text-center text-ink-faint py-6">Chưa có email nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Chiến dịch ----------
function Campaigns({ token }: { token: string }) {
  const [rows, setRows] = useState<MailCampaign[]>([]);
  const [tpls, setTpls] = useState<MailTemplate[]>([]);
  const [edit, setEdit] = useState<{ id: string | null; name: string; subject: string; body: string; sourceFilter: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => adminApi.mailCampaigns(token).then((r) => setRows(r.items)).catch(() => undefined), [token]);
  useEffect(() => {
    load();
    adminApi.mailTemplates(token).then((r) => setTpls(r.items)).catch(() => undefined);
  }, [load, token]);

  async function run<T>(fn: () => Promise<T>, ok: (r: T) => string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      setMsg({ ok: true, text: ok(r) });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!edit) return;
    await run(() => adminApi.mailCampaignSave(token, edit.id, { name: edit.name, subject: edit.subject, body: edit.body, sourceFilter: edit.sourceFilter || null }), () => 'Đã lưu chiến dịch (ở trạng thái Nháp, cần Duyệt trước khi gửi).');
    setEdit(null);
  }
  const label = (s: string) => (s === 'draft' ? 'Nháp' : s === 'approved' ? 'Đã duyệt' : 'Đã gửi xong');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" className={btnP} onClick={() => setEdit({ id: null, name: '', subject: '', body: '', sourceFilter: '' })}>+ Chiến dịch mới</button>
        <span className="text-xs text-ink-muted">Quy trình: Soạn → Duyệt → Gửi thử cho chính mình → Gửi từng lô (tối đa 40 thư mỗi lần bấm). Thư luôn kèm liên kết Hủy nhận.</span>
      </div>
      <Note m={msg} />
      {edit && (
        <div className="rounded-lg border border-primary bg-white p-3 flex flex-col gap-2">
          <input aria-label="Tên chiến dịch" className={inp} placeholder="Tên chiến dịch (chỉ để quản lý)" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <div className="flex gap-2 flex-wrap items-center">
            <label htmlFor="cp-tpl" className="text-xs font-bold">Lấy từ mẫu</label>
            <select id="cp-tpl" className={inp} defaultValue="" onChange={(e) => { const t = tpls.find((x) => x.id === e.target.value); if (t) setEdit({ ...edit, subject: t.subject, body: t.body, name: edit.name || t.name }); e.target.value = ''; }}>
              <option value="">— chọn mẫu —</option>
              {tpls.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
            <label htmlFor="cp-src" className="text-xs font-bold">Gửi tới</label>
            <select id="cp-src" className={inp} value={edit.sourceFilter} onChange={(e) => setEdit({ ...edit, sourceFilter: e.target.value })}>
              <option value="">Toàn bộ danh sách đang nhận</option>
              {Object.entries(SRC).map(([k, v]) => (<option key={k} value={k}>Chỉ nguồn: {v}</option>))}
            </select>
          </div>
          <input aria-label="Tiêu đề email" className={inp} placeholder="Tiêu đề email" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} />
          <textarea aria-label="Nội dung email" className={`${inp} min-h-[200px]`} placeholder="Nội dung" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" className={btnP} disabled={busy} onClick={save}>Lưu</button>
            <button type="button" className={btn} onClick={() => setEdit(null)}>Huỷ</button>
          </div>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {rows.map((c) => (
          <li key={c.id} className="rounded-lg border border-border bg-white p-3 flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <b className="text-sm flex-1 min-w-0 break-words">{c.name}</b>
              <span className={`text-[11px] font-bold rounded px-2 py-0.5 ${c.status === 'approved' ? 'bg-success-tint text-success' : c.status === 'sent' ? 'bg-surface-alt text-ink-muted' : 'bg-accent/10 text-accent'}`}>{label(c.status)}</span>
            </div>
            <div className="text-xs text-ink-muted break-words">Tiêu đề: {c.subject}</div>
            <div className="text-xs text-ink-muted">Đã gửi <b>{formatNumber(c.sentCount)}</b> · còn <b>{formatNumber(c.remaining)}</b> người chưa nhận{c.sourceFilter ? ` · nguồn: ${SRC[c.sourceFilter] ?? c.sourceFilter}` : ''}{c.lastSentAt ? ` · gửi lần cuối ${formatTimeDate(c.lastSentAt)}` : ''}</div>
            <div className="flex gap-2 flex-wrap">
              <button type="button" className={btn} disabled={busy} onClick={() => setEdit({ id: c.id, name: c.name, subject: c.subject, body: c.body, sourceFilter: c.sourceFilter || '' })}>Sửa</button>
              {c.status === 'draft' && <button type="button" className={btnP} disabled={busy} onClick={() => run(() => adminApi.mailCampaignApprove(token, c.id, true), () => 'Đã duyệt.')}>Duyệt</button>}
              {c.status === 'approved' && <button type="button" className={btn} disabled={busy} onClick={() => run(() => adminApi.mailCampaignApprove(token, c.id, false), () => 'Đã chuyển về Nháp.')}>Bỏ duyệt</button>}
              <button type="button" className={btn} disabled={busy} onClick={() => run(() => adminApi.mailCampaignTest(token, c.id), (r) => `Đã gửi thử tới ${r.to}.`)}>Gửi thử cho tôi</button>
              {c.status === 'approved' && (
                <button type="button" className={btnP} disabled={busy || c.remaining === 0} onClick={() => { if (confirm(`Gửi lô tiếp theo (tối đa 40 thư) cho chiến dịch "${c.name}"?`)) run(() => adminApi.mailCampaignSend(token, c.id), (r) => `Đã gửi ${r.sent} thư${r.failed ? `, lỗi ${r.failed}` : ''}; còn ${r.remaining}.`); }}>{busy ? 'Đang gửi…' : 'Gửi lô tiếp'}</button>
              )}
              <button type="button" className={`${btn} text-critical`} disabled={busy} onClick={async () => { if (confirm(`Xoá chiến dịch "${c.name}"?`)) { await adminApi.mailCampaignRemove(token, c.id).catch(() => undefined); load(); } }}>Xoá</button>
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="text-center text-ink-faint text-sm py-6">Chưa có chiến dịch nào.</li>}
      </ul>
    </div>
  );
}
