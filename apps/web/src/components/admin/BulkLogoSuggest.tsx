'use client';

import { useRef, useState } from 'react';
import { adminApi } from '@/lib/api-admin';
import type { Company } from '@/lib/api';

type Row = { id: string; name: string; options: { url: string; source: string }[]; pick: string | null; use: boolean; state: 'wait' | 'run' | 'done' | 'none' | 'err' };

// Đợt 146 — gợi ý logo HÀNG LOẠT: chọn nhiều công ty → web tự tìm logo (từ website / tên miền đoán) cho từng công ty,
// hiện xem trước để Admin đổi ảnh khác hoặc bỏ tick, rồi bấm một lần "Lưu các logo đã chọn". Không tự lưu khi chưa được xác nhận.
export function BulkLogoSuggest({ token, companies, onSave }: { token: string; companies: Company[]; onSave: (id: string, url: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<'idle' | 'search' | 'review' | 'saving' | 'saved'>('idle');
  const [done, setDone] = useState(0);
  const [msg, setMsg] = useState('');
  const cancel = useRef(false);

  async function start() {
    cancel.current = false;
    const init: Row[] = companies.map((c) => ({ id: c.id, name: c.name, options: [], pick: null, use: false, state: 'wait' }));
    setRows(init);
    setDone(0);
    setMsg('');
    setOpen(true);
    setPhase('search');
    let next = 0;
    let finished = 0;
    const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
    async function worker() {
      while (!cancel.current) {
        const i = next++;
        if (i >= companies.length) return;
        patch(i, { state: 'run' });
        try {
          const r = await adminApi.logoSuggestions(token, companies[i].id);
          const o = r.items ?? [];
          patch(i, { options: o, pick: o[0]?.url ?? null, use: !!o[0], state: o.length ? 'done' : 'none' });
        } catch {
          patch(i, { state: 'err' });
        }
        finished++;
        setDone(finished);
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    setPhase('review');
  }

  async function saveAll() {
    const todo = rows.filter((r) => r.use && r.pick);
    if (!todo.length) return;
    setPhase('saving');
    let ok = 0;
    for (const r of todo) {
      try { await onSave(r.id, r.pick!); ok++; } catch { /* bỏ qua, báo cuối */ }
    }
    setMsg(`Đã lưu logo cho ${ok}/${todo.length} công ty.`);
    setPhase('saved');
  }

  const upd = (id: string, p: Partial<Row>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const nUse = rows.filter((r) => r.use && r.pick).length;

  return (
    <>
      <button type="button" onClick={start} disabled={!companies.length} className="font-bold rounded-md bg-info-tint text-info px-2.5 py-1.5 disabled:opacity-50">
        ✨ Gợi ý logo cho {companies.length} công ty đã chọn
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" role="dialog" aria-modal="true" aria-label="Gợi ý logo hàng loạt">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-xl text-ink">
            <div className="p-4 border-b border-border flex items-center justify-between gap-2">
              <div>
                <div className="font-extrabold text-[15px]">Gợi ý logo hàng loạt</div>
                <div className="text-xs text-ink-muted">
                  {phase === 'search' ? `Đang tìm… ${done}/${rows.length}` : phase === 'review' ? `Đã tìm xong ${rows.length} công ty — kiểm tra rồi lưu` : msg || ''}
                </div>
              </div>
              <button type="button" onClick={() => { cancel.current = true; setOpen(false); setPhase('idle'); }} className="text-lg px-2" aria-label="Đóng">✕</button>
            </div>
            {phase === 'search' && (
              <div className="px-4 pt-3">
                <div className="h-2 rounded-full bg-surface-alt overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${rows.length ? (done / rows.length) * 100 : 0}%` }} /></div>
              </div>
            )}
            <div className="p-3 overflow-y-auto flex flex-col gap-2">
              {rows.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-2.5 flex flex-col gap-1.5">
                  <label className="flex items-center gap-2 text-[13px] font-bold">
                    <input type="checkbox" checked={r.use} disabled={!r.pick || phase === 'saving' || phase === 'saved'} onChange={(e) => upd(r.id, { use: e.target.checked })} />
                    <span className="min-w-0 truncate">{r.name}</span>
                    <span className="ml-auto text-[11px] font-semibold text-ink-faint whitespace-nowrap">
                      {r.state === 'wait' ? 'chờ…' : r.state === 'run' ? 'đang tìm…' : r.state === 'none' ? 'không thấy ảnh' : r.state === 'err' ? 'lỗi' : `${r.options.length} gợi ý`}
                    </span>
                  </label>
                  {r.options.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-6">
                      {r.options.map((o) => (
                        <button
                          key={o.url}
                          type="button"
                          title={o.source}
                          disabled={phase === 'saving' || phase === 'saved'}
                          onClick={() => upd(r.id, { pick: o.url, use: true })}
                          className={`h-12 w-12 rounded-md border bg-white p-0.5 ${r.pick === o.url ? 'border-primary ring-2 ring-primary/40' : 'border-border-strong'}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={o.url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
                        </button>
                      ))}
                    </div>
                  )}
                  {r.state === 'none' && <div className="pl-6 text-[11.5px] text-ink-muted">Công ty này chưa có website để dò — dùng “Tìm ảnh” ở dòng công ty rồi dán link.</div>}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-border flex items-center justify-end gap-2">
              {phase === 'saved' ? (
                <button type="button" onClick={() => { setOpen(false); setPhase('idle'); }} className="rounded-md bg-primary text-white font-bold text-sm px-4 py-2">Xong</button>
              ) : (
                <>
                  <button type="button" onClick={() => { cancel.current = true; setOpen(false); setPhase('idle'); }} className="rounded-md border border-border-strong bg-white font-bold text-sm px-3 py-2">Huỷ</button>
                  <button type="button" onClick={saveAll} disabled={phase !== 'review' || nUse === 0} className="rounded-md bg-primary text-white font-bold text-sm px-4 py-2 disabled:opacity-50">
                    {phase === 'saving' ? 'Đang lưu…' : `Lưu các logo đã chọn (${nUse})`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
