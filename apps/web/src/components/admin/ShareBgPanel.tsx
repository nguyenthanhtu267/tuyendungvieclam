'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, jobsApi } from '@/lib/api';
import { adminApi, type ShareBgAdmin, type ShareElKey, type SharePeople, type ShareStyle, type ShareFormat, type ShareTexts } from '@/lib/api-admin';
import { SHARE_PRESETS, presetById, svgDataUri } from '@/lib/share-presets';

// Đợt 153 — Admin chọn nền cho ảnh xem trước khi dán link tin tuyển dụng lên Facebook/Zalo.
// Nền đổi theo ngày (xoay vòng các nền đã tick) hoặc cố định một nền; có thể tải ảnh nền tự thiết kế (1200×630).
const MAX_BYTES = 650_000;
const btn = 'rounded-md border border-border-strong bg-white font-bold text-xs px-3 min-h-[36px] disabled:opacity-50';
const btnP = 'rounded-md bg-primary text-white font-bold text-xs px-3 min-h-[36px] disabled:opacity-50';

const msg = (e: unknown) => (e instanceof ApiError ? e.message : (e as Error)?.message || 'Có lỗi xảy ra');

function readFile(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('Không đọc được tệp'));
    r.readAsDataURL(f);
  });
}

export function ShareBgPanel({ token }: { token: string }) {
  const [cfg, setCfg] = useState<ShareBgAdmin | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [prev, setPrev] = useState('p1');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [name, setName] = useState('');
  const [stamp, setStamp] = useState(0);
  const [tx, setTx] = useState<ShareTexts | null>(null);
  const [st, setSt] = useState<ShareStyle | null>(null);
  const [pp, setPp] = useState<SharePeople>('none');
  const [fm, setFm] = useState<ShareFormat>('wide');
  const [pf, setPf] = useState<'wide' | 'square'>('wide');
  useEffect(() => { if (cfg && !st) { setSt(cfg.style); setPp(cfg.people); setFm(cfg.format); } }, [cfg, st]);
  useEffect(() => { if (cfg && !tx) setTx(cfg.texts); }, [cfg, tx]);

  useEffect(() => {
    adminApi.shareBgGet(token).then(setCfg).catch((e) => setNote({ ok: false, text: msg(e) }));
    jobsApi
      .list({ limit: 1 } as never)
      .then((r) => setJobId(r.items?.[0]?.id ?? null))
      .catch(() => undefined);
  }, [token]);

  const run = useCallback(
    async (fn: () => Promise<ShareBgAdmin>, ok: string) => {
      setBusy(true);
      setNote(null);
      try {
        setCfg(await fn());
        setNote({ ok: true, text: ok });
      } catch (e) {
        setNote({ ok: false, text: msg(e) });
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  if (!cfg) return <div className="text-sm text-ink-muted">{note ? note.text : 'Đang tải…'}</div>;

  const all = [
    ...SHARE_PRESETS.map((p) => ({ id: p.id, name: p.name, src: svgDataUri(p.svg(1200, 630)), custom: false })),
    ...cfg.custom.map((c) => ({ id: c.id, name: c.name, src: c.dataUrl, custom: true })),
  ];
  const inRotation = (id: string) => (cfg.presets.includes(id) || cfg.custom.some((c) => c.id === id)) && true;
  const toggle = (id: string, isCustom: boolean) => {
    if (isCustom) return; // ảnh tự tải luôn nằm trong vòng đổi theo ngày; muốn bỏ thì xoá
    const next = cfg.presets.includes(id) ? cfg.presets.filter((x) => x !== id) : [...cfg.presets, id];
    run(() => adminApi.shareBgSet(token, { presets: next }), 'Đã lưu vòng đổi nền theo ngày.');
  };
  const shareLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${jobId ?? '<mã tin>'}`;
  const pv = encodeURIComponent(JSON.stringify({ style: st ?? undefined, people: pp, format: fm }));
  const previewSrc = jobId && prev ? `/chia-se/${jobId}?bg=${prev}&fmt=${pf}&pv=${pv}&t=${stamp}` : '';
  const ELS: [ShareElKey, string][] = [['brand', 'Tên web'], ['tagline', 'Dòng giới thiệu'], ['badge', 'Nhãn tin gấp'], ['title', 'Tiêu đề tin'], ['company', 'Tên công ty'], ['salary', 'Mức lương'], ['meta', 'Địa điểm / hạn nộp'], ['contact', 'Liên hệ']];
  const setEl = (k: ShareElKey, patch: Partial<ShareStyle['els'][ShareElKey]>) => st && setSt({ ...st, els: { ...st.els, [k]: { ...st.els[k], ...patch } } });

  const onFile = async (f?: File | null) => {
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) return setNote({ ok: false, text: 'Chỉ nhận ảnh PNG hoặc JPG.' });
    if (f.size > MAX_BYTES) return setNote({ ok: false, text: `Ảnh nặng ${Math.round(f.size / 1000)}KB — tối đa khoảng 650KB. Hãy xuất ảnh 1200×630 rồi nén lại.` });
    const dataUrl = await readFile(f);
    await run(() => adminApi.shareBgAdd(token, { name: name.trim() || f.name.replace(/\.[^.]+$/, ''), dataUrl }), 'Đã thêm ảnh nền.');
    setName('');
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold">Ảnh chia sẻ tin tuyển dụng</h2>
        <p className="text-sm text-ink-muted">
          Khi dán link tin lên Facebook/Zalo, hệ thống tự vẽ một ảnh gồm tên web, tiêu đề tin, công ty, lương, địa điểm, số điện thoại/email/địa chỉ (nếu có) trên nền bạn chọn ở đây.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-white p-3 space-y-2">
        <div className="font-bold text-sm">Cách đổi nền</div>
        <label className="flex items-center gap-2 text-sm min-h-[36px]">
          <input type="radio" name="sbmode" checked={cfg.mode === 'daily'} disabled={busy} onChange={() => run(() => adminApi.shareBgSet(token, { mode: 'daily' }), 'Đã chọn đổi nền theo ngày.')} />
          Tự đổi mỗi ngày (xoay vòng các nền được tick bên dưới)
        </label>
        <label className="flex items-center gap-2 text-sm min-h-[36px]">
          <input type="radio" name="sbmode" checked={cfg.mode === 'fixed'} disabled={busy} onChange={() => run(() => adminApi.shareBgSet(token, { mode: 'fixed' }), 'Đã chọn nền cố định.')} />
          Dùng một nền cố định
        </label>
        {cfg.mode === 'fixed' && (
          <div className="text-xs text-ink-muted">Bấm “Dùng làm nền cố định” dưới nền muốn chọn. Nền đang cố định: <b>{all.find((a) => a.id === cfg.fixedId)?.name ?? presetById(cfg.fixedId).name}</b></div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-3 space-y-2">
        <div className="font-bold text-sm">Link chia sẻ qua hệ thống</div>
        <p className="text-xs text-ink-muted">
          Mọi nút Chia sẻ / Sao chép link / Facebook trên web đều tạo link dạng <b>/s/&lt;mã tin&gt;</b>. Dán link này vào Facebook/Zalo, bên dưới bài đăng sẽ hiện ảnh nền + chữ theo tin; người bấm vào được chuyển thẳng sang trang tin. Dán link trang tin (/viec-lam/…) cũng có ảnh, nhưng nên dùng link chia sẻ.
        </p>
        <input id="sb-link" readOnly className="tvl-input !text-sm" value={shareLink} onFocus={(e) => e.currentTarget.select()} />
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={!jobId} onClick={() => { navigator.clipboard?.writeText(shareLink).then(() => setNote({ ok: true, text: 'Đã sao chép link chia sẻ mẫu.' })).catch(() => undefined); }}>Sao chép link</button>
          <a className={`${btn} inline-flex items-center`} target="_blank" rel="noopener noreferrer" href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(shareLink)}`}>Làm mới trên Facebook (Sharing Debugger)</a>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white p-3 space-y-2">
        <div className="font-bold text-sm">Chữ cố định trên ảnh</div>
        <p className="text-xs text-ink-muted">Chỉ gồm chữ không đổi giữa các tin. Tiêu đề, công ty, lương, địa điểm, số điện thoại, email, địa chỉ luôn tự lấy từ từng tin tuyển dụng.</p>
        {tx && (
          <div className="grid gap-2 sm:grid-cols-2">
            {([['brand', 'Tên web (góc trên)'], ['tagline', 'Dòng giới thiệu dưới tên web'], ['urgent', 'Nhãn tin gấp'], ['fallback', 'Câu hiện khi tin không có thông tin liên hệ']] as [keyof ShareTexts, string][]).map(([k, l]) => (
              <label key={k} className="text-xs font-bold space-y-1 block">
                {l}
                <input id={`sbt-${k}`} className="tvl-input !text-sm" value={tx[k]} maxLength={k === 'brand' ? 24 : 70} onChange={(e) => setTx({ ...tx, [k]: e.target.value })} />
              </label>
            ))}
          </div>
        )}
        <button className={btnP} disabled={busy || !tx} onClick={() => tx && run(() => adminApi.shareBgSet(token, { texts: tx }), 'Đã lưu chữ cố định.').then(() => setStamp(Date.now()))}>Lưu chữ cố định</button>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((a) => (
          <div key={a.id} className={`rounded-lg border bg-white p-2 space-y-2 ${prev === a.id ? 'border-primary' : 'border-border'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.src} alt={a.name} className="w-full aspect-[1200/630] object-cover rounded-md border border-border" loading="lazy" />
            <div className="text-xs font-bold truncate">{a.name}{a.custom ? ' (ảnh của bạn)' : ''}{cfg.mode === 'fixed' && cfg.fixedId === a.id ? ' · đang cố định' : ''}</div>
            <div className="flex flex-wrap gap-2 items-center">
              <label className="flex items-center gap-1.5 text-xs min-h-[36px]">
                <input type="checkbox" checked={inRotation(a.id)} disabled={busy || a.custom} onChange={() => toggle(a.id, a.custom)} />
                Trong vòng theo ngày
              </label>
              <button className={btn} disabled={!jobId} onClick={() => { setPrev(a.id); setStamp(Date.now()); }}>Xem thử</button>
              <button className={btn} disabled={busy} onClick={() => run(() => adminApi.shareBgSet(token, { mode: 'fixed', fixedId: a.id }), 'Đã dùng làm nền cố định.')}>Dùng làm nền cố định</button>
              {a.custom && <button className={`${btn} !text-critical`} disabled={busy} onClick={() => run(() => adminApi.shareBgRemove(token, a.id), 'Đã xoá ảnh nền.')}>Xoá</button>}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-white p-3 space-y-2">
        <div className="font-bold text-sm">Tải nền do bạn thiết kế</div>
        <p className="text-xs text-ink-muted">Ảnh PNG/JPG kích thước 1200×630, dưới khoảng 650KB, tối đa 8 ảnh. Chữ sẽ được đặt đè lên, nên chọn nền ít chi tiết ở giữa; hệ thống tự phủ lớp tối nhẹ cho dễ đọc.</p>
        <div className="flex flex-wrap gap-2 items-center">
          <input id="sb-name" className="tvl-input !text-sm !w-48" placeholder="Tên nền (tuỳ chọn)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <label className={`${btnP} inline-flex items-center cursor-pointer`}>
            Chọn ảnh…
            <input id="sb-file" type="file" accept="image/png,image/jpeg" className="sr-only" disabled={busy} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
      </div>

      {st && (
        <div className="rounded-lg border border-border bg-white p-3 space-y-3">
          <div className="font-bold text-sm">Kích thước ảnh & nhân vật</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-bold space-y-1 block">
              Khổ ảnh
              <select id="sb-format" className="tvl-input !text-sm" value={fm} onChange={(e) => setFm(e.target.value as ShareFormat)}>
                <option value="wide">Ngang 1200×630 (khuyên dùng, Facebook/Zalo hiện đầy đủ)</option>
                <option value="square">Vuông 1080×1080 (hợp điện thoại, Facebook có thể thu nhỏ)</option>
                <option value="auto">Tự chọn theo thiết bị người bấm chia sẻ</option>
              </select>
            </label>
            <div className="text-xs font-bold space-y-1">
              Nhân vật làm việc văn phòng
              <div className="flex flex-wrap gap-2">
                {([['none', 'Không hiện'], ['male', 'Nam'], ['female', 'Nữ'], ['both', 'Nam + Nữ']] as [SharePeople, string][]).map(([v, l]) => (
                  <label key={v} className="flex items-center gap-1.5 text-xs font-normal min-h-[36px]">
                    <input type="radio" name="sbpeople" checked={pp === v} onChange={() => setPp(v)} /> {l}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-ink-muted">“Tự chọn” dựa vào thiết bị của người bấm chia sẻ (máy tính → ngang, điện thoại → vuông); Facebook/Zalo không cho web biết người xem dùng thiết bị gì.</p>

          <div className="font-bold text-sm">Chữ trên ảnh: màu, cỡ, đậm, nghiêng</div>
          <div className="space-y-2">
            {ELS.map(([k, l]) => {
              const e = st.els[k];
              return (
                <div key={k} className="grid grid-cols-[1fr_auto] sm:grid-cols-[150px_auto_1fr_auto_auto] gap-2 items-center border-b border-border pb-2">
                  <span className="text-xs font-bold">{l}</span>
                  <span className="flex items-center gap-1">
                    <input id={`sbc-${k}`} type="color" aria-label={`Màu ${l}`} className="h-9 w-10 p-0 border border-border-strong rounded" value={e.color || '#12284f'} onChange={(ev) => setEl(k, { color: ev.target.value })} />
                    <button type="button" className={btn} onClick={() => setEl(k, { color: '' })} disabled={!e.color}>Tự động</button>
                  </span>
                  <label className="flex items-center gap-2 text-xs col-span-2 sm:col-span-1">
                    Cỡ {e.scale}%
                    <input id={`sbs-${k}`} type="range" min={60} max={170} step={5} value={e.scale} onChange={(ev) => setEl(k, { scale: Number(ev.target.value) })} className="flex-1" />
                  </label>
                  <label className="flex items-center gap-1 text-xs min-h-[36px]"><input type="checkbox" checked={e.bold} onChange={(ev) => setEl(k, { bold: ev.target.checked })} /> Đậm</label>
                  <label className="flex items-center gap-1 text-xs min-h-[36px]"><input type="checkbox" checked={e.italic} onChange={(ev) => setEl(k, { italic: ev.target.checked })} /> Nghiêng</label>
                </div>
              );
            })}
          </div>

          <div className="font-bold text-sm">Thông tin hiển thị</div>
          <div className="flex flex-wrap gap-x-4">
            {([['salary', 'Lương'], ['location', 'Địa điểm'], ['deadline', 'Hạn nộp'], ['contact', 'Liên hệ']] as [keyof ShareStyle['show'], string][]).map(([k, l]) => (
              <label key={k} className="flex items-center gap-1.5 text-xs min-h-[36px]">
                <input type="checkbox" checked={st.show[k]} onChange={(ev) => setSt({ ...st, show: { ...st.show, [k]: ev.target.checked } })} /> {l}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs">
            Độ tối phủ lên ảnh tự tải {st.scrim}%
            <input id="sb-scrim" type="range" min={0} max={85} step={5} value={st.scrim} onChange={(ev) => setSt({ ...st, scrim: Number(ev.target.value) })} className="flex-1 max-w-xs" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className={btnP} disabled={busy} onClick={() => run(() => adminApi.shareBgSet(token, { style: st, people: pp, format: fm }), 'Đã lưu kiểu chữ, nhân vật và khổ ảnh.').then(() => setStamp(Date.now()))}>Lưu thiết kế</button>
            <button className={btn} disabled={busy} onClick={() => { setSt(null); run(() => adminApi.shareBgSet(token, { style: { els: {}, show: {}, scrim: 40 } as never, people: 'none', format: 'wide' }), 'Đã đặt lại mặc định.').then(() => setStamp(Date.now())); }}>Đặt lại mặc định</button>
          </div>
        </div>
      )}

      {previewSrc && (
        <div className="rounded-lg border border-border bg-white p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-bold text-sm mr-auto">Xem thử với tin mới nhất (chưa cần lưu)</div>
            <button className={pf === 'wide' ? btnP : btn} onClick={() => setPf('wide')}>Máy tính (ngang)</button>
            <button className={pf === 'square' ? btnP : btn} onClick={() => setPf('square')}>Điện thoại (vuông)</button>
            <button className={btn} onClick={() => setStamp(Date.now())}>Vẽ lại</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewSrc} alt="Xem thử ảnh chia sẻ" className={`w-full rounded-md border border-border bg-surface-muted ${pf === 'wide' ? 'max-w-[600px] aspect-[1200/630]' : 'max-w-[420px] aspect-square'}`} />
        </div>
      )}
      {note && <div role="status" className={`text-xs font-bold ${note.ok ? 'text-success' : 'text-critical'}`}>{note.text}</div>}
      <p className="text-xs text-ink-muted">Lưu ý: Facebook/Zalo ghi nhớ ảnh của link đã từng dán. Với link đã dán rồi, vào Facebook Sharing Debugger bấm “Scrape Again” để làm mới.</p>
    </div>
  );
}
