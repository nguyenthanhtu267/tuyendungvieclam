'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { adminApi } from '@/lib/api-admin';
import { ArtScene } from '@/components/bg/ArtScene';
import {
  BG_GROUPS,
  BG_THEMES,
  DEFAULT_BG_SETTING,
  IMG_PREFIX,
  currentBgTheme,
  nextBgChange,
  resolveBgTheme,
  type BgImage,
  type BgSetting,
} from '@/lib/bg-themes';

// Đợt 29/30b — Admin "🎨 Nền giao diện": 44 mẫu vector (11 nhóm × 4 màu) + ảnh do Admin tải lên (mọi kích thước/đuôi ảnh
// trình duyệt đọc được — tự thu nhỏ ≤ 2560px và đổi sang WEBP trước khi gửi). 3 chế độ: cố định · tự động đổi · TẮT nền.
// Mọi thay đổi chỉ áp dụng khi bấm "Lưu"; nút "Huỷ thay đổi" trả về cấu hình đã lưu.
const MAX_SIDE = 2560;
const RAW_LIMIT = 40 * 1024 * 1024;
const SEND_LIMIT = 3.8 * 1024 * 1024;

async function prepareImage(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  if (file.size > RAW_LIMIT) throw new Error('Ảnh gốc quá 40MB');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode().catch(() => {
      throw new Error('Trình duyệt không đọc được định dạng này (HEIC/TIFF…) — hãy đổi sang JPG/PNG/WEBP rồi tải lại');
    });
    let w = img.naturalWidth || 1920;
    let h = img.naturalHeight || 1080;
    if (w < 2 || h < 2) throw new Error('Ảnh không hợp lệ');
    const k = Math.min(1, MAX_SIDE / Math.max(w, h));
    w = Math.max(1, Math.round(w * k));
    h = Math.max(1, Math.round(h * k));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    for (const q of [0.88, 0.76, 0.62, 0.5]) {
      let blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', q));
      if (!blob || blob.type !== 'image/webp') blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
      if (blob && blob.size <= SEND_LIMIT) return { blob, w, h };
    }
    throw new Error('Ảnh quá nặng ngay cả sau khi nén — hãy chọn ảnh khác');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const same = (a: BgSetting, b: BgSetting) =>
  a.mode === b.mode &&
  a.theme === b.theme &&
  a.hours === b.hours &&
  JSON.stringify([...a.autoThemes].sort()) === JSON.stringify([...b.autoThemes].sort()) &&
  a.images.every((im) => b.images.find((x) => x.id === im.id)?.overlay === im.overlay);

export function BackgroundPanel({ token }: { token: string }) {
  const [s, setS] = useState<BgSetting>(DEFAULT_BG_SETTING);
  const [saved, setSaved] = useState<BgSetting>(DEFAULT_BG_SETTING);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    adminApi
      .getBackground(token)
      .then((r) => {
        setS(r);
        setSaved(r);
        setLoaded(true);
      })
      .catch((e) => setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'Không tải được cấu hình' }));
  }, [token]);

  const cur = useMemo(() => currentBgTheme(s), [s]);
  const dirty = loaded && !same(s, saved);
  const vectorIds = useMemo(() => BG_THEMES.map((t) => t.id), []);
  const inRotation = (id: string) => (s.autoThemes.length === 0 ? !id.startsWith(IMG_PREFIX) : s.autoThemes.includes(id));

  function toggleAuto(id: string) {
    const base = s.autoThemes.length === 0 ? vectorIds : s.autoThemes;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    if (next.length === 0) return;
    const isAllVectors = next.length === vectorIds.length && vectorIds.every((v) => next.includes(v));
    setS({ ...s, autoThemes: isAllVectors ? [] : next });
  }

  const pickTheme = (id: string) => (s.mode === 'auto' ? toggleAuto(id) : setS({ ...s, mode: 'fixed', theme: id }));

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setMsg(null);
    const notes: string[] = [];
    let okCount = 0;
    for (const f of Array.from(files)) {
      setUploading(f.name);
      try {
        const { blob, w, h } = await prepareImage(f);
        const name = f.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Ảnh nền';
        const im = await adminApi.uploadBgImage(token, blob, { name, overlay: 78, width: w, height: h });
        setS((p) => ({ ...p, images: [...p.images, im] }));
        setSaved((p) => ({ ...p, images: [...p.images, im] }));
        okCount++;
        if (w < 1280) notes.push(`"${f.name}" khá nhỏ (${w}px) — có thể bị mờ khi phóng to trên màn hình lớn`);
      } catch (e) {
        notes.push(`"${f.name}": ${e instanceof Error ? e.message : 'không tải lên được'}`);
      }
    }
    setUploading(null);
    if (fileRef.current) fileRef.current.value = '';
    setMsg({
      ok: okCount > 0,
      text: `${okCount ? `Đã tải lên ${okCount} ảnh — bấm vào ảnh để chọn làm nền rồi "Lưu". ` : ''}${notes.join(' · ')}`,
    });
  }

  async function removeImage(im: BgImage) {
    if (!window.confirm(`Xoá ảnh "${im.name}"? Nếu đang dùng làm nền, website sẽ chuyển về mẫu mặc định.`)) return;
    setBusy(true);
    try {
      const r = await adminApi.deleteBgImage(token, im.id);
      const tid = IMG_PREFIX + im.id;
      setS((p) => ({
        ...p,
        images: r.images,
        theme: p.theme === tid ? r.theme : p.theme,
        autoThemes: p.autoThemes.filter((x) => x !== tid),
      }));
      setSaved(r);
      setMsg({ ok: true, text: 'Đã xoá ảnh.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'Xoá không thành công' });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      for (const im of s.images) {
        const old = saved.images.find((x) => x.id === im.id);
        if (old && old.overlay !== im.overlay) await adminApi.updateBgImage(token, im.id, { overlay: im.overlay });
      }
      const r = await adminApi.setBackground(token, { mode: s.mode, theme: s.theme, autoThemes: s.autoThemes, hours: s.hours });
      setS(r);
      setSaved(r);
      setMsg({ ok: true, text: 'Đã lưu. Người dùng sẽ thấy nền mới ngay khi tải lại trang (tối đa sau ~10 phút với trang đang mở).' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'Lưu không thành công' });
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setS(saved);
    setMsg({ ok: true, text: 'Đã huỷ các thay đổi chưa lưu — trở về cấu hình đang áp dụng.' });
  }

  const next = new Date(nextBgChange(s));
  const totalRot = s.autoThemes.length || vectorIds.length;
  return (
    <div className="max-w-5xl" data-testid="background-panel">
      <h1 className="font-bold text-base mb-1">Nền giao diện website</h1>
      <p className="text-sm text-ink-muted mb-3">
        {BG_THEMES.length} mẫu nền vector (11 nhóm × 4 màu) và ảnh do bạn tải lên. Nền toàn trang hiển thị bản sáng nhạt (không làm khó đọc chữ);
        khung &quot;Bảng thị trường&quot; ở trang chủ hiển thị bản đậm của cùng mẫu. Mọi thay đổi chỉ có hiệu lực sau khi bấm &quot;Lưu&quot;.
      </p>

      <div className="rounded-xl bg-white border border-border p-3 flex flex-wrap items-center gap-x-6 gap-y-2 mb-3 text-sm">
        <div className="flex flex-wrap items-center gap-4">
          {(
            [
              ['fixed', 'Cố định 1 mẫu / 1 ảnh'],
              ['auto', 'Tự động đổi nền'],
              ['none', 'Không dùng nền (nền trơn)'],
            ] as const
          ).map(([m, label]) => (
            <label key={m} className="flex items-center gap-1.5 font-bold" htmlFor={`bg-mode-${m}`}>
              <input id={`bg-mode-${m}`} type="radio" name="bg-mode" checked={s.mode === m} onChange={() => setS({ ...s, mode: m })} />
              {label}
            </label>
          ))}
        </div>
        {s.mode === 'auto' && (
          <label className="flex items-center gap-1.5 font-semibold" htmlFor="bg-hours">
            Đổi mỗi
            <select id="bg-hours" className="tvl-input !w-auto !py-1" value={s.hours} onChange={(e) => setS({ ...s, hours: Number(e.target.value) })}>
              {[1, 2, 3, 4, 6, 12, 24].map((h) => (
                <option key={h} value={h}>
                  {h} giờ
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="text-ink-muted font-semibold">
          {s.mode === 'none' ? (
            <>Đang hiển thị: <b className="text-ink">nền trơn (không có hình nền)</b></>
          ) : (
            <>
              Đang hiển thị: <b className="text-ink">{cur.groupLabel} · {cur.name}</b>
              {s.mode === 'auto' && <> — đổi tiếp lúc <b className="text-ink">{next.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</b></>}
            </>
          )}
        </div>
      </div>

      {s.mode === 'auto' && (
        <p className="text-[13px] text-ink-muted mb-2">
          Tích chọn các mẫu/ảnh muốn đưa vào vòng xoay (bấm lại để bỏ). Đang có <b className="text-ink">{totalRot}</b> mục
          {s.autoThemes.length === 0 && ' (mặc định: toàn bộ mẫu vector, chưa gồm ảnh của bạn)'}.{' '}
          <button type="button" className="text-primary font-bold underline" onClick={() => setS({ ...s, autoThemes: [] })}>
            Chọn tất cả mẫu vector
          </button>
        </p>
      )}

      {/* ---------- Ảnh của bạn ---------- */}
      <section className="mb-4" data-testid="bg-images">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-extrabold text-sm">
            Ảnh của bạn <span className="font-semibold text-ink-muted">— tải ảnh bất kỳ (JPG, PNG, WEBP, GIF, AVIF, BMP, SVG…)</span>
          </h2>
          <input
            ref={fileRef}
            id="bg-file"
            type="file"
            multiple
            accept="image/*,.avif,.bmp,.svg,.gif,.webp"
            className="hidden"
            onChange={(e) => void onFiles(e.target.files)}
            data-testid="bg-file"
          />
          <button type="button" className="tvl-btn-ghost !w-auto px-4 !py-1.5" disabled={!!uploading || busy} onClick={() => fileRef.current?.click()}>
            {uploading ? `Đang xử lý “${uploading.slice(0, 24)}”…` : '＋ Tải ảnh lên'}
          </button>
        </div>
        <p className="text-[12.5px] text-ink-muted mt-1">
          Mọi kích thước đều dùng được: ảnh được tự thu nhỏ (cạnh dài ≤ {MAX_SIDE}px) và nén sang WEBP; hiển thị phủ kín màn hình, cắt giữa, không bị méo.
          Ảnh GIF động sẽ lấy khung hình đầu. Nên dùng ảnh ngang từ 1600px trở lên để không bị mờ.
        </p>
        {s.images.length === 0 ? (
          <div className="mt-2 rounded-xl border-2 border-dashed border-border bg-white p-4 text-sm text-ink-muted">
            Chưa có ảnh nào. Bấm &quot;＋ Tải ảnh lên&quot; để chọn một hoặc nhiều ảnh.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            {s.images.map((im) => {
              const id = IMG_PREFIX + im.id;
              const th = resolveBgTheme(id, s.images)!;
              const selected = s.mode === 'auto' ? inRotation(id) : s.mode === 'fixed' && s.theme === id;
              return (
                <div key={im.id} className={`rounded-xl overflow-hidden border-2 bg-white ${selected ? 'border-primary shadow-md' : 'border-border'}`}>
                  <button
                    type="button"
                    data-testid={`bg-${id}`}
                    aria-pressed={selected}
                    onClick={() => pickTheme(id)}
                    className="relative block w-full h-24 sm:h-28 text-left"
                  >
                    <ArtScene theme={th} mode="page" />
                    {selected && <span className="absolute left-2 top-2 rounded bg-primary text-white text-[11px] font-extrabold px-1.5 py-0.5">{s.mode === 'auto' ? 'Trong vòng xoay' : 'Đang chọn'}</span>}
                  </button>
                  <div className="px-2.5 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[13.5px] truncate" title={im.name}>{im.name}</span>
                      <button type="button" className="text-critical text-[12.5px] font-bold hover:underline shrink-0" disabled={busy} onClick={() => void removeImage(im)}>
                        Xoá ảnh
                      </button>
                    </div>
                    <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-muted mt-1" htmlFor={`ov-${im.id}`}>
                      Làm mờ (chữ dễ đọc)
                      <input
                        id={`ov-${im.id}`}
                        type="range"
                        min={0}
                        max={90}
                        step={2}
                        value={im.overlay}
                        onChange={(e) => setS((p) => ({ ...p, images: p.images.map((x) => (x.id === im.id ? { ...x, overlay: Number(e.target.value) } : x)) }))}
                        className="flex-1"
                      />
                      <b className="text-ink w-9 text-right">{im.overlay}%</b>
                    </label>
                    <div className="text-[11.5px] text-ink-faint">{im.width && im.height ? `${im.width}×${im.height}px` : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-4">
        {BG_GROUPS.map((g) => (
          <section key={g.id}>
            <h2 className="font-extrabold text-sm">
              {g.label} <span className="font-semibold text-ink-muted">— {g.hint}</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
              {BG_THEMES.filter((t) => t.group === g.id).map((t) => {
                const selected = s.mode === 'auto' ? inRotation(t.id) : s.mode === 'fixed' && s.theme === t.id;
                const isCur = s.mode !== 'none' && cur.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    data-testid={`bg-${t.id}`}
                    aria-pressed={selected}
                    onClick={() => pickTheme(t.id)}
                    className={`relative text-left rounded-xl overflow-hidden border-2 transition-shadow ${selected ? 'border-primary shadow-md' : 'border-border opacity-80 hover:opacity-100'}`}
                  >
                    <div className="relative h-20 sm:h-24">
                      <ArtScene theme={t} mode="panel" />
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-white px-2 py-1.5">
                      <span className="font-bold text-[13px]">{t.name}</span>
                      <span className="text-[11.5px] font-bold text-primary">{isCur ? 'Đang dùng' : selected ? (s.mode === 'auto' ? '✓ Xoay vòng' : 'Đã chọn') : ''}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 sticky bottom-0 bg-bg py-2">
        <button type="button" className="tvl-btn-primary !w-auto px-6" onClick={save} disabled={busy || !loaded || !dirty}>
          {busy ? 'Đang lưu…' : 'Lưu nền giao diện'}
        </button>
        <button type="button" className="tvl-btn-ghost !w-auto px-5" onClick={cancel} disabled={busy || !dirty} data-testid="bg-cancel">
          Huỷ thay đổi
        </button>
        {dirty && <span className="text-sm font-bold text-[#B45309]">Có thay đổi chưa lưu</span>}
        {msg && <span className={`text-sm font-semibold ${msg.ok ? 'text-success' : 'text-critical'}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
