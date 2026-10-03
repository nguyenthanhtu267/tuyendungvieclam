'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, jobsApi } from '@/lib/api';
import { adminApi, type ShareBgAdmin } from '@/lib/api-admin';
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
  const [prev, setPrev] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [name, setName] = useState('');
  const [stamp, setStamp] = useState(0);

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
    ...SHARE_PRESETS.map((p) => ({ id: p.id, name: p.name, src: svgDataUri(p.svg), custom: false })),
    ...cfg.custom.map((c) => ({ id: c.id, name: c.name, src: c.dataUrl, custom: true })),
  ];
  const inRotation = (id: string) => (cfg.presets.includes(id) || cfg.custom.some((c) => c.id === id)) && true;
  const toggle = (id: string, isCustom: boolean) => {
    if (isCustom) return; // ảnh tự tải luôn nằm trong vòng đổi theo ngày; muốn bỏ thì xoá
    const next = cfg.presets.includes(id) ? cfg.presets.filter((x) => x !== id) : [...cfg.presets, id];
    run(() => adminApi.shareBgSet(token, { presets: next }), 'Đã lưu vòng đổi nền theo ngày.');
  };
  const previewSrc = jobId && prev ? `/chia-se/${jobId}?bg=${prev}&t=${stamp}` : '';

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

      {previewSrc && (
        <div className="rounded-lg border border-border bg-white p-3 space-y-2">
          <div className="font-bold text-sm">Xem thử với tin mới nhất</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewSrc} alt="Xem thử ảnh chia sẻ" className="w-full max-w-[600px] aspect-[1200/630] rounded-md border border-border bg-surface-muted" />
        </div>
      )}
      {note && <div role="status" className={`text-xs font-bold ${note.ok ? 'text-success' : 'text-critical'}`}>{note.text}</div>}
      <p className="text-xs text-ink-muted">Lưu ý: Facebook/Zalo ghi nhớ ảnh của link đã từng dán. Với link đã dán rồi, vào Facebook Sharing Debugger bấm “Scrape Again” để làm mới.</p>
    </div>
  );
}
