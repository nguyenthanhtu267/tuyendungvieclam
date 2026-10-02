'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, workersApi, type PhoneViewRow, type ShareQueueRow } from '@/lib/api';
import { formatNumber, formatTimeDate } from '@/lib/format';
import { KIND_LABEL } from '@/lib/labor';
import { SourcedEditor } from '@/components/labor/SourcedEditor';
import { Pager } from './CvSourcingPanel';
import { SortTh, useSort } from '@/components/ui/SortTh';

// Đợt 136 — Admin "Công nhân · SV · TTS → Thu thập hồ sơ":
//  1) Thu thập: dán bài Zalo/Facebook hoặc dán bảng Excel → hồ sơ "Nguồn tổng hợp"
//  2) Chờ chia sẻ: hồ sơ do NTD tự nhập (chỉ công ty đó thấy) — duyệt tay hoặc tự động sau 15 phút (chỉ hồ sơ tạo sau lúc bật)
//  3) Nhật ký xem số: NTD nào đã bấm "Xem số" hồ sơ nguồn tổng hợp (giới hạn 30 lượt/24 giờ/công ty)
type Tab = 'collect' | 'queue' | 'views';

export function WorkerSourcingPanel({ token, onSaved }: { token: string; onSaved?: () => void }) {
  const [tab, setTab] = useState<Tab>('collect');
  const [pending, setPending] = useState<number | null>(null);
  const api = useMemo(() => workersApi.adminSourcing(token), [token]);
  useEffect(() => {
    workersApi.adminQueue(token, { status: 'pending' }).then((r) => setPending(r.counts.pending)).catch(() => undefined);
  }, [token, tab]);
  return (
    <section className="rounded-xl bg-white border border-border p-3 sm:p-4 flex flex-col gap-3" aria-label="Thu thập hồ sơ lao động">
      <div role="tablist" className="flex gap-1 border-b border-border text-sm font-bold overflow-x-auto">
        {([['collect', 'Thu thập hồ sơ'], ['queue', `Chờ chia sẻ${pending ? ` (${pending})` : ''}`], ['views', 'Nhật ký xem số']] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-3 py-2 border-b-2 -mb-px whitespace-nowrap ${tab === k ? 'text-primary border-primary' : 'text-ink-faint border-transparent'}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'collect' && (
        <SourcedEditor
          api={api}
          withLabel
          onSaved={() => onSaved?.()}
          intro="Hồ sơ lưu ở đây mang nhãn “Nguồn tổng hợp”: NTD chỉ thấy số điện thoại đã che (090****567) và phải bấm “Xem số” (ghi nhật ký, tối đa 30 lượt/ngày/công ty). Người lao động điền lại cùng số điện thoại sẽ tự nhận lại hồ sơ, hoặc gỡ ở trang Yêu cầu gỡ/nhận lại hồ sơ."
        />
      )}
      {tab === 'queue' && <QueueTab token={token} onChanged={() => { onSaved?.(); }} />}
      {tab === 'views' && <ViewsTab token={token} />}
    </section>
  );
}

function QueueTab({ token, onChanged }: { token: string; onChanged: () => void }) {
  const [status, setStatus] = useState<'pending' | 'shared' | 'dismissed'>('pending');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof workersApi.adminQueue>> | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const r = await workersApi.adminQueue(token, { status, page: String(page) });
    setData(r);
  }, [token, status, page]);
  useEffect(() => {
    load().catch(() => undefined);
    setSel(new Set());
  }, [load]);

  async function act(ids: string[], action: 'share' | 'dismiss' | 'requeue') {
    if (!ids.length) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await workersApi.adminQueueAct(token, ids, action);
      setMsg(`Đã xử lý ${r.changed} hồ sơ.`);
      await load();
      setSel(new Set());
      onChanged();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Có lỗi xảy ra');
    } finally {
      setBusy(false);
    }
  }
  async function toggleAuto(on: boolean) {
    setBusy(true);
    try {
      await workersApi.adminQueueAuto(token, on);
      await load();
    } finally {
      setBusy(false);
    }
  }
  const items = data?.items ?? [];
  const allOn = items.length > 0 && items.every((x) => sel.has(x.id));
  const qs = useSort(items, {
    name: (r: ShareQueueRow) => r.fullName,
    jobs: (r: ShareQueueRow) => r.desiredJobs.join(', '),
    company: (r: ShareQueueRow) => r.company,
    createdAt: (r: ShareQueueRow) => new Date(r.createdAt),
  });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-faint max-w-3xl">
        Hồ sơ do nhà tuyển dụng tự nhập trong “Kho người lao động của tôi” — chỉ công ty đó thấy. Khi bạn <b>chia sẻ</b>, hồ sơ hiện cho mọi NTD với nhãn “Nguồn tổng hợp” và số điện thoại được che. Đơn ứng tuyển của người lao động tự điền vốn đã hiện cho mọi NTD nên không cần duyệt.
      </p>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2.5 text-sm">
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" checked={!!data?.auto.enabled} disabled={busy || !data} onChange={(e) => toggleAuto(e.target.checked)} />
          Tự động chia sẻ sau {data?.auto.minutes ?? 15} phút
        </label>
        <span className="text-xs text-ink-faint">{data?.auto.enabled ? `Đang bật${data.auto.enabledAt ? ` từ ${formatTimeDate(data.auto.enabledAt)}` : ''} — chỉ áp dụng hồ sơ tạo SAU lúc bật.` : 'Đang tắt — bạn duyệt tay.'}</span>
      </div>
      <div role="tablist" className="flex gap-1.5 flex-wrap text-xs">
        {([['pending', 'Chờ duyệt'], ['shared', 'Đã chia sẻ'], ['dismissed', 'Bỏ qua']] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={status === k} onClick={() => { setStatus(k); setPage(1); }} className={`rounded-full border px-3 py-1.5 font-bold ${status === k ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white text-ink'}`}>
            {l}{data ? ` (${formatNumber(data.counts[k])})` : ''}
          </button>
        ))}
      </div>
      {msg && <div role="status" className="text-sm rounded-lg bg-info-tint text-info px-3 py-2">{msg}</div>}
      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primary-tint px-3 py-2 text-sm">
          <b>{sel.size} đã chọn</b>
          {status !== 'shared' && <button type="button" disabled={busy} onClick={() => act(Array.from(sel), 'share')} className="tvl-btn-accent !w-auto text-xs !px-3 !py-1.5">Chia sẻ</button>}
          {status === 'pending' && <button type="button" disabled={busy} onClick={() => act(Array.from(sel), 'dismiss')} className="tvl-btn-ghost !w-auto text-xs !px-3 !py-1.5">Bỏ qua</button>}
          {status !== 'pending' && <button type="button" disabled={busy} onClick={() => act(Array.from(sel), 'requeue')} className="tvl-btn-ghost !w-auto text-xs !px-3 !py-1.5">Đưa về chờ duyệt</button>}
        </div>
      )}
      <div className="rounded-xl bg-white border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-ink-faint bg-surface-alt">
                <th className="py-2.5 px-3 w-8"><input type="checkbox" aria-label="Chọn tất cả" checked={allOn} onChange={(e) => setSel(e.target.checked ? new Set(items.map((x) => x.id)) : new Set())} /></th>
                <SortTh s={qs} k="name" className="py-2.5 px-2 font-semibold">Người lao động</SortTh>
                <SortTh s={qs} k="jobs" className="py-2.5 px-2 font-semibold">Việc muốn làm</SortTh>
                <SortTh s={qs} k="company" className="py-2.5 px-2 font-semibold">NTD nhập</SortTh>
                <SortTh s={qs} k="createdAt" className="py-2.5 px-2 font-semibold">Ngày nhập</SortTh>
                <th className="py-2.5 px-3" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (<tr><td colSpan={6} className="text-center text-ink-faint py-8">Không có hồ sơ nào.</td></tr>)}
              {qs.rows.map((r: ShareQueueRow) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="py-2.5 px-3"><input type="checkbox" aria-label={`Chọn ${r.fullName}`} checked={sel.has(r.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} /></td>
                  <td className="py-2.5 px-2 min-w-[10rem]">
                    <div className="font-bold">{r.fullName} <span className="font-normal text-ink-faint">· {KIND_LABEL[r.kind]}</span></div>
                    <div className="text-ink-faint">{r.phone} · {[r.oldDistrict, r.province].filter(Boolean).join(', ')}</div>
                  </td>
                  <td className="py-2.5 px-2 max-w-[14rem]">{r.desiredJobs.join(', ') || '—'}</td>
                  <td className="py-2.5 px-2 min-w-[8rem]">{r.company ?? '—'}</td>
                  <td className="py-2.5 px-2 whitespace-nowrap text-ink-faint">{formatTimeDate(r.createdAt)}</td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    {status === 'pending' && (
                      <>
                        <button type="button" disabled={busy} onClick={() => act([r.id], 'share')} className="text-[11px] font-bold rounded-md bg-primary text-white px-2.5 py-1 mr-1">Chia sẻ</button>
                        <button type="button" disabled={busy} onClick={() => act([r.id], 'dismiss')} className="text-[11px] font-bold rounded-md border border-border-strong px-2.5 py-1">Bỏ qua</button>
                      </>
                    )}
                    {status !== 'pending' && <button type="button" disabled={busy} onClick={() => act([r.id], 'requeue')} className="text-[11px] font-bold rounded-md border border-border-strong px-2.5 py-1">Về chờ duyệt</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {data && data.totalPages > 1 && <Pager page={page} totalPages={data.totalPages} onPage={setPage} />}
    </div>
  );
}

function ViewsTab({ token }: { token: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof workersApi.adminPhoneViews>> | null>(null);
  const vs = useSort(data?.items, {
    viewedAt: (v: PhoneViewRow) => new Date(v.viewedAt),
    company: (v: PhoneViewRow) => v.company,
    name: (v: PhoneViewRow) => v.fullName,
    source: (v: PhoneViewRow) => v.sourceLabel,
  });
  useEffect(() => {
    workersApi.adminPhoneViews(token, { page: String(page) }).then(setData).catch(() => undefined);
  }, [token, page]);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-faint max-w-3xl">
        Mỗi lần NTD bấm “Xem số” trên hồ sơ nguồn tổng hợp được ghi lại ở đây. Mỗi công ty xem tối đa {data?.limit ?? 30} số trong 24 giờ (xem lại cùng một người không tính thêm).
      </p>
      {data && data.last24h.length > 0 && (
        <div className="text-xs flex flex-wrap gap-x-4 gap-y-1">
          <b>24 giờ qua:</b>
          {data.last24h.map((x) => (<span key={x.companyId ?? x.company}>{x.company ?? '—'}: <b>{x.n}</b></span>))}
        </div>
      )}
      <div className="rounded-xl bg-white border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-ink-faint bg-surface-alt">
                <SortTh s={vs} k="viewedAt" className="py-2.5 px-3 font-semibold">Thời gian</SortTh>
                <SortTh s={vs} k="company" className="py-2.5 px-2 font-semibold">Công ty · tài khoản</SortTh>
                <SortTh s={vs} k="name" className="py-2.5 px-2 font-semibold">Hồ sơ đã xem số</SortTh>
                <SortTh s={vs} k="source" className="py-2.5 px-3 font-semibold">Nguồn</SortTh>
              </tr>
            </thead>
            <tbody>
              {data?.items.length === 0 && (<tr><td colSpan={4} className="text-center text-ink-faint py-8">Chưa có lượt xem số nào.</td></tr>)}
              {vs.rows.map((v: PhoneViewRow) => (
                <tr key={v.id} className="border-t border-border align-top">
                  <td className="py-2.5 px-3 whitespace-nowrap">{formatTimeDate(v.viewedAt)}</td>
                  <td className="py-2.5 px-2 min-w-[10rem]"><div className="font-bold">{v.company ?? '—'}</div><div className="text-ink-faint break-all">{v.userEmail ?? ''}</div></td>
                  <td className="py-2.5 px-2 min-w-[10rem]">{v.fullName ?? '(đã gỡ)'} <span className="text-ink-faint">· {v.phone ?? ''}</span></td>
                  <td className="py-2.5 px-3 text-ink-faint">{v.sourceLabel ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {data && data.totalPages > 1 && <Pager page={page} totalPages={data.totalPages} onPage={setPage} />}
    </div>
  );
}
