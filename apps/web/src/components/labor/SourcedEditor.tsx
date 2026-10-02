'use client';

import { useEffect, useState } from 'react';
import { ApiError, workersApi, type ParsedWorker, type SourcedPreviewRow, type SourcedSaveResult, type SourcedTablePreview, type SourcingApi, type WorkerKind } from '@/lib/api';
import { EXPERIENCE_LABEL, GENDER_LABEL, KIND_LABEL, LABOR_GROUPS, SHIFTS_BY_KIND } from '@/lib/labor';
import { PROVINCES } from '@/lib/catalogs';
import { Combobox } from '@/components/ui/Combobox';

// Đợt 136 — ô thu thập hồ sơ lao động DÙNG CHUNG cho Admin và NTD:
//  • "Dán bài": dán bài tìm việc Zalo/Facebook → tự tách tên, SĐT, năm sinh, tỉnh/quận, việc, ca → xem lại → lưu
//  • "Dán bảng": dán nhiều dòng từ Excel/CSV → xem trước (hợp lệ / trùng / thiếu) → lưu hàng loạt
// Hồ sơ lưu ở đây KHÔNG phải do người lao động tự điền nên mang nhãn "Nguồn tổng hợp"; số điện thoại được che với NTD khác.
const SOURCES = ['Zalo', 'Facebook', 'Excel / Google Sheet', 'Gọi điện / trực tiếp', 'Hội chợ việc làm'];

type Mode = 'post' | 'table';
const emptyParsed = (): ParsedWorker => ({ fullName: '', phone: '', birthYear: null, birthDate: null, gender: null, province: null, oldDistrict: null, kind: 'worker', desiredJobs: [], shifts: [], experience: null, needsHousing: false, needsShuttle: false, note: null, missing: [] });

export function SourcedEditor({ api, withLabel, onSaved, intro }: { api: SourcingApi; withLabel?: boolean; onSaved?: (r: SourcedSaveResult) => void; intro?: string }) {
  const [mode, setMode] = useState<Mode>('post');
  const [label, setLabel] = useState('');
  return (
    <div className="flex flex-col gap-3">
      {intro && <p className="text-xs text-ink-faint max-w-3xl">{intro}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex gap-1.5 text-xs">
          {([['post', '📋 Dán bài tìm việc (1 người)'], ['table', '📊 Dán bảng nhiều dòng (Excel)']] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`rounded-full border px-3 py-1.5 font-bold ${mode === k ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white text-ink'}`}>
              {l}
            </button>
          ))}
        </div>
        {withLabel && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-xs min-w-0 w-full sm:w-auto">
            <label htmlFor="src-label" className="font-bold shrink-0">Nguồn (chỉ Admin thấy)</label>
            <Combobox id="src-label" className="w-full sm:w-60 min-w-0" inputClassName="text-sm" value={label} options={SOURCES} placeholder="Gõ hoặc chọn nguồn…" onChange={setLabel} />
          </div>
        )}
      </div>
      {mode === 'post' ? <PostMode api={api} label={label} onSaved={onSaved} /> : <TableMode api={api} label={label} onSaved={onSaved} />}
    </div>
  );
}

function errText(e: unknown) {
  return e instanceof ApiError ? e.message : 'Có lỗi xảy ra, vui lòng thử lại.';
}

// ---------------------------------------------------------------- dán bài
function PostMode({ api, label, onSaved }: { api: SourcingApi; label: string; onSaved?: (r: SourcedSaveResult) => void }) {
  const [text, setText] = useState('');
  const [p, setP] = useState<ParsedWorker | null>(null);
  const [existing, setExisting] = useState<{ id: string; isSourced: boolean; fullName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function parse() {
    setMsg(null);
    setBusy(true);
    try {
      const r = await api.previewPost(text);
      setP(r.parsed);
      setExisting(r.existing);
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!p) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.save([p], label || undefined);
      if (r.created) {
        setMsg({ ok: true, text: `Đã lưu hồ sơ ${p.fullName}. Dán bài tiếp theo bên trên.` });
        setP(null);
        setText('');
        setExisting(null);
        onSaved?.(r);
      } else setMsg({ ok: false, text: r.skipped[0]?.reason ?? 'Không lưu được hồ sơ.' });
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="src-post" className="text-xs font-bold">Nội dung bài đăng tìm việc</label>
      <textarea id="src-post" rows={5} value={text} onChange={(e) => setText(e.target.value)} className="tvl-input text-sm" placeholder={'Ví dụ: Em tên Nguyễn Thị Lan, sinh năm 1999, nữ, ở Thủ Đức TP.HCM. Em muốn tìm việc công nhân may, ca hành chính, cần ký túc xá. SĐT/Zalo: 0903 456 789'} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || text.trim().length < 10} onClick={parse} className="tvl-btn-primary !w-auto text-sm !px-4 !py-2 disabled:opacity-50">{busy && !p ? 'Đang tách…' : 'Tách thông tin'}</button>
        {p && <button type="button" onClick={() => { setP(null); setMsg(null); }} className="text-xs font-bold text-ink-muted underline">Bỏ kết quả</button>}
      </div>
      {msg && <div role="status" className={`text-sm rounded-lg px-3 py-2 ${msg.ok ? 'bg-success-tint text-success' : 'bg-critical-tint text-critical'}`}>{msg.text}</div>}
      {p && (
        <div className="rounded-xl border border-border bg-white p-3 flex flex-col gap-3">
          {existing && (
            <div className="text-sm rounded-lg bg-warning-tint border border-warning px-3 py-2">
              Số điện thoại này đã có hồ sơ {existing.isSourced ? '(nguồn tổng hợp)' : '(người lao động tự điền)'} — {existing.fullName}. Không thể tạo bản sao.
            </div>
          )}
          {p.missing.length > 0 && <div className="text-sm rounded-lg bg-warning-tint border border-warning px-3 py-2">Chưa tách được: <b>{p.missing.join(', ')}</b> — hãy điền bổ sung bên dưới.</div>}
          <ParsedForm p={p} onChange={setP} />
          <div className="flex gap-2 flex-wrap">
            <button type="button" disabled={busy || !!existing || !p.fullName || !p.phone || !p.province} onClick={save} className="tvl-btn-accent !w-auto text-sm !px-4 !py-2 disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ParsedForm({ p, onChange }: { p: ParsedWorker; onChange: (v: ParsedWorker) => void }) {
  const set = (patch: Partial<ParsedWorker>) => onChange({ ...p, ...patch });
  const [districts, setDistricts] = useState<string[]>([]);
  useEffect(() => {
    if (!p.province) {
      setDistricts([]);
      return;
    }
    let live = true;
    workersApi.districts(p.province).then((r) => live && setDistricts(r.items)).catch(() => live && setDistricts([]));
    return () => {
      live = false;
    };
  }, [p.province]);
  const groups = LABOR_GROUPS[p.kind];
  const shifts = SHIFTS_BY_KIND[p.kind];
  const toggle = (arr: string[], v: string, max = 99) => (arr.includes(v) ? arr.filter((x) => x !== v) : arr.length >= max ? arr : [...arr, v]);
  const lab = 'text-xs font-bold text-ink-muted';
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
      <div className="min-w-0 flex flex-col gap-1">
        <label className={lab} htmlFor="pf-name">Họ tên *</label>
        <input id="pf-name" className="tvl-input text-sm" value={p.fullName ?? ''} onChange={(e) => set({ fullName: e.target.value })} />
      </div>
      <div className="min-w-0 flex flex-col gap-1">
        <label className={lab} htmlFor="pf-phone">Số điện thoại *</label>
        <input id="pf-phone" inputMode="tel" className="tvl-input text-sm" value={p.phone ?? ''} onChange={(e) => set({ phone: e.target.value.replace(/[^\d]/g, '').slice(0, 10) })} />
      </div>
      <div className="min-w-0 flex flex-col gap-1">
        <label className={lab} htmlFor="pf-by">Năm sinh</label>
        <input id="pf-by" inputMode="numeric" className="tvl-input text-sm" placeholder="vd 1999" value={p.birthYear ?? ''} onChange={(e) => set({ birthYear: Number(e.target.value.replace(/\D/g, '').slice(0, 4)) || null, birthDate: null })} />
      </div>
      <div className="min-w-0 flex flex-col gap-1">
        <span className={lab}>Giới tính</span>
        <Combobox ariaLabel="Giới tính" inputClassName="text-sm" value={p.gender ?? ''} options={Object.entries(GENDER_LABEL).map(([value, label]) => ({ value, label }))} allLabel="Chưa rõ" onChange={(v) => set({ gender: (v || null) as ParsedWorker['gender'] })} />
      </div>
      <div className="min-w-0 flex flex-col gap-1">
        <span className={lab}>Nhóm *</span>
        <Combobox ariaLabel="Nhóm" clearable={false} inputClassName="text-sm" value={p.kind} options={(Object.keys(KIND_LABEL) as WorkerKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} onChange={(v) => v && set({ kind: v as WorkerKind, desiredJobs: [], shifts: [] })} />
      </div>
      <div className="min-w-0 flex flex-col gap-1">
        <span className={lab}>Tỉnh/thành *</span>
        <Combobox ariaLabel="Tỉnh/thành" inputClassName="text-sm" value={p.province ?? ''} options={PROVINCES} placeholder="Gõ để tìm tỉnh…" onChange={(v) => set({ province: v || null, oldDistrict: null })} />
      </div>
      <div className="min-w-0 flex flex-col gap-1">
        <span className={lab}>Quận/huyện</span>
        <Combobox ariaLabel="Quận/huyện" inputClassName="text-sm" value={p.oldDistrict ?? ''} options={districts} allLabel="Chưa rõ" disabled={!p.province} onChange={(v) => set({ oldDistrict: v || null })} />
      </div>
      <div className="min-w-0 flex flex-col gap-1">
        <span className={lab}>Kinh nghiệm</span>
        <Combobox ariaLabel="Kinh nghiệm" inputClassName="text-sm" value={p.experience ?? ''} options={Object.entries(EXPERIENCE_LABEL).map(([value, label]) => ({ value, label }))} allLabel="Chưa rõ" onChange={(v) => set({ experience: (v || null) as ParsedWorker['experience'] })} />
      </div>
      <div className="min-w-0 flex flex-col gap-1 col-span-full">
        <span className={lab}>Việc muốn làm (tối đa 3)</span>
        <div className="flex flex-wrap gap-1.5">
          {groups.map((g) => (
            <button key={g} type="button" aria-pressed={p.desiredJobs.includes(g)} onClick={() => set({ desiredJobs: toggle(p.desiredJobs, g, 3) })} className={`rounded-full border px-2.5 py-1 text-xs font-bold ${p.desiredJobs.includes(g) ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white text-ink'}`}>
              {g}
            </button>
          ))}
        </div>
      </div>
      {shifts.length > 0 && (
        <div className="min-w-0 flex flex-col gap-1 col-span-full">
          <span className={lab}>Ca làm</span>
          <div className="flex flex-wrap gap-1.5">
            {shifts.map((g) => (
              <button key={g} type="button" aria-pressed={p.shifts.includes(g)} onClick={() => set({ shifts: toggle(p.shifts, g) })} className={`rounded-full border px-2.5 py-1 text-xs font-bold ${p.shifts.includes(g) ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white text-ink'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-4 col-span-full text-sm">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={p.needsHousing} onChange={(e) => set({ needsHousing: e.target.checked })} />Cần chỗ ở / KTX</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={p.needsShuttle} onChange={(e) => set({ needsShuttle: e.target.checked })} />Cần xe đưa đón</label>
      </div>
      <div className="min-w-0 flex flex-col gap-1 col-span-full">
        <label className={lab} htmlFor="pf-note">Ghi chú nội bộ</label>
        <input id="pf-note" className="tvl-input text-sm" value={p.note ?? ''} onChange={(e) => set({ note: e.target.value || null })} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- dán bảng
const STATUS_LABEL: Record<SourcedPreviewRow['status'], { t: string; c: string }> = {
  ok: { t: 'Hợp lệ', c: 'bg-success-tint text-success' },
  missing: { t: 'Thiếu thông tin', c: 'bg-critical-tint text-critical' },
  duplicate: { t: 'Đã có hồ sơ', c: 'bg-warning-tint text-ink' },
  repeat: { t: 'Trùng trong bảng', c: 'bg-warning-tint text-ink' },
};

function TableMode({ api, label, onSaved }: { api: SourcingApi; label: string; onSaved?: (r: SourcedSaveResult) => void }) {
  const [text, setText] = useState('');
  const [pv, setPv] = useState<SourcedTablePreview | null>(null);
  const [off, setOff] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function preview() {
    setMsg(null);
    setBusy(true);
    try {
      const r = await api.previewTable(text);
      setPv(r);
      setOff(new Set());
    } catch (e) {
      setPv(null);
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  }
  const chosen = pv ? pv.rows.filter((r) => r.status === 'ok' && !off.has(r.row)) : [];
  async function save() {
    if (!chosen.length) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.save(chosen, label || undefined);
      setMsg({ ok: true, text: `Đã lưu ${r.created} hồ sơ${r.skipped.length ? `, bỏ qua ${r.skipped.length} (${r.skipped.slice(0, 3).map((s) => s.reason).join('; ')})` : ''}.` });
      setPv(null);
      setText('');
      onSaved?.(r);
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="src-table" className="text-xs font-bold">Dán các dòng từ Excel / Google Sheet / CSV (tối đa 500 dòng)</label>
      <textarea id="src-table" rows={6} value={text} onChange={(e) => setText(e.target.value)} className="tvl-input text-sm font-mono" placeholder={'Họ tên\tSĐT\tNăm sinh\tGiới tính\tTỉnh\tQuận/Huyện\tViệc\tCa\nTrần Văn A\t0912345678\t1995\tNam\tBình Dương\tDĩ An\tKho vận bốc xếp\tXoay ca'} />
      <p className="text-xs text-ink-faint">Có dòng tiêu đề thì tự nhận cột theo tên; không có thì tự đoán từng ô (số điện thoại, năm sinh, tỉnh, việc…). Số điện thoại mất số 0 đầu do Excel vẫn được nhận.</p>
      <div className="flex gap-2">
        <button type="button" disabled={busy || text.trim().length < 10} onClick={preview} className="tvl-btn-primary !w-auto text-sm !px-4 !py-2 disabled:opacity-50">{busy && !pv ? 'Đang đọc…' : 'Xem trước'}</button>
      </div>
      {msg && <div role="status" className={`text-sm rounded-lg px-3 py-2 ${msg.ok ? 'bg-success-tint text-success' : 'bg-critical-tint text-critical'}`}>{msg.text}</div>}
      {pv && (
        <div className="flex flex-col gap-2">
          <div className="text-sm flex flex-wrap gap-x-4 gap-y-1">
            <span><b>{pv.summary.total}</b> dòng</span>
            <span className="text-success"><b>{pv.summary.ok}</b> hợp lệ</span>
            {pv.summary.duplicate > 0 && <span><b>{pv.summary.duplicate}</b> đã có hồ sơ (bỏ qua)</span>}
            {pv.summary.repeat > 0 && <span><b>{pv.summary.repeat}</b> trùng trong bảng (bỏ qua)</span>}
            {pv.summary.missing > 0 && <span className="text-critical"><b>{pv.summary.missing}</b> thiếu họ tên / SĐT / tỉnh (bỏ qua)</span>}
            <span className="text-ink-faint">{pv.headerDetected ? 'Đã nhận dòng tiêu đề' : 'Không có dòng tiêu đề — tự đoán cột'}</span>
          </div>
          <div className="rounded-xl bg-white border border-border overflow-hidden">
            <div className="overflow-x-auto max-h-[26rem]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-alt">
                  <tr className="text-left text-ink-faint">
                    <th className="py-2 px-3 w-8" />
                    <th className="py-2 px-2 font-semibold">Dòng</th>
                    <th className="py-2 px-2 font-semibold">Họ tên · SĐT</th>
                    <th className="py-2 px-2 font-semibold">Nơi ở</th>
                    <th className="py-2 px-2 font-semibold">Việc · ca</th>
                    <th className="py-2 px-2 font-semibold">Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {pv.rows.map((r) => (
                    <tr key={r.row} className="border-t border-border align-top">
                      <td className="py-2 px-3">
                        {r.status === 'ok' && <input type="checkbox" aria-label={`Chọn dòng ${r.row}`} checked={!off.has(r.row)} onChange={() => setOff((s) => { const n = new Set(s); if (n.has(r.row)) n.delete(r.row); else n.add(r.row); return n; })} />}
                      </td>
                      <td className="py-2 px-2 text-ink-faint tabular-nums">{r.row}</td>
                      <td className="py-2 px-2 min-w-[11rem]">
                        <div className="font-bold">{r.fullName || <span className="text-critical">—</span>} <span className="font-normal text-ink-faint">· {KIND_LABEL[r.kind]}</span></div>
                        <div className="text-ink-faint">{r.phone || <span className="text-critical">thiếu SĐT</span>}{r.birthYear ? ` · ${r.birthYear}` : ''}{r.gender ? ` · ${GENDER_LABEL[r.gender]}` : ''}</div>
                      </td>
                      <td className="py-2 px-2 min-w-[8rem]">{r.province ? [r.oldDistrict, r.province].filter(Boolean).join(', ') : <span className="text-critical">thiếu tỉnh</span>}</td>
                      <td className="py-2 px-2 min-w-[9rem]">{r.desiredJobs.join(', ') || '—'}{r.shifts.length > 0 && <div className="text-ink-faint">🕒 {r.shifts.join(', ')}</div>}</td>
                      <td className="py-2 px-2 whitespace-nowrap"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_LABEL[r.status].c}`}>{STATUS_LABEL[r.status].t}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <button type="button" disabled={busy || !chosen.length} onClick={save} className="tvl-btn-accent !w-auto text-sm !px-4 !py-2 disabled:opacity-50">{busy ? 'Đang lưu…' : `Lưu ${chosen.length} hồ sơ`}</button>
            <button type="button" onClick={() => setPv(null)} className="text-xs font-bold text-ink-muted underline">Bỏ kết quả</button>
          </div>
        </div>
      )}
    </div>
  );
}
