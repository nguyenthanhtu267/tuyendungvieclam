'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminApi, ApiError } from '@/lib/api';
import { ArtScene } from '@/components/bg/ArtScene';
import { BG_GROUPS, BG_THEMES, DEFAULT_BG_SETTING, currentBgTheme, nextBgChange, type BgSetting } from '@/lib/bg-themes';

// Đợt 29 (30/09/2026) — Admin "🎨 Nền giao diện": 15 mẫu nền vector (5 nhóm × 3) cho TOÀN website; chọn 1 mẫu cố định,
// hoặc bật "Tự động" để website tự đổi nền mỗi N giờ (mặc định 2 giờ) trong các mẫu đã tích — cho cảm giác luôn tươi mới.
export function BackgroundPanel({ token }: { token: string }) {
  const [s, setS] = useState<BgSetting>(DEFAULT_BG_SETTING);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    adminApi
      .getBackground(token)
      .then((r) => {
        setS(r);
        setLoaded(true);
      })
      .catch((e) => setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'Không tải được cấu hình' }));
  }, [token]);

  const cur = useMemo(() => currentBgTheme(s), [s]);
  const inRotation = (id: string) => s.autoThemes.length === 0 || s.autoThemes.includes(id);

  function toggleAuto(id: string) {
    const all = BG_THEMES.map((t) => t.id);
    const base = s.autoThemes.length === 0 ? all : s.autoThemes;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    if (next.length === 0) return; // luôn còn ít nhất 1 mẫu
    setS({ ...s, autoThemes: next.length === all.length ? [] : next });
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminApi.setBackground(token, s);
      setS(r);
      setMsg({ ok: true, text: 'Đã lưu. Người dùng sẽ thấy nền mới ngay khi tải lại trang (tối đa sau ~10 phút với trang đang mở).' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'Lưu không thành công' });
    } finally {
      setBusy(false);
    }
  }

  const next = new Date(nextBgChange(s));
  return (
    <div className="max-w-5xl" data-testid="background-panel">
      <h1 className="font-bold text-base mb-1">Nền giao diện website</h1>
      <p className="text-sm text-ink-muted mb-3">
        15 mẫu nền vector phong cách sáng tạo · đổi mới · công nghệ AI. Nền toàn trang hiển thị bản sáng nhạt (không làm khó đọc chữ);
        khung &quot;Bảng thị trường&quot; ở trang chủ hiển thị bản đậm của cùng mẫu.
      </p>

      <div className="rounded-xl bg-white border border-border p-3 flex flex-wrap items-center gap-x-6 gap-y-2 mb-3 text-sm">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 font-bold" htmlFor="bg-mode-fixed">
            <input id="bg-mode-fixed" type="radio" name="bg-mode" checked={s.mode === 'fixed'} onChange={() => setS({ ...s, mode: 'fixed' })} />
            Cố định 1 mẫu
          </label>
          <label className="flex items-center gap-1.5 font-bold" htmlFor="bg-mode-auto">
            <input id="bg-mode-auto" type="radio" name="bg-mode" checked={s.mode === 'auto'} onChange={() => setS({ ...s, mode: 'auto' })} />
            Tự động đổi nền
          </label>
        </div>
        {s.mode === 'auto' && (
          <label className="flex items-center gap-1.5 font-semibold" htmlFor="bg-hours">
            Đổi mỗi
            <select
              id="bg-hours"
              className="tvl-input !w-auto !py-1"
              value={s.hours}
              onChange={(e) => setS({ ...s, hours: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 6, 12, 24].map((h) => (
                <option key={h} value={h}>
                  {h} giờ
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="text-ink-muted font-semibold">
          Đang hiển thị: <b className="text-ink">{cur.groupLabel} · {cur.name}</b>
          {s.mode === 'auto' && <> — đổi tiếp lúc <b className="text-ink">{next.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</b></>}
        </div>
      </div>

      {s.mode === 'auto' && (
        <p className="text-[13px] text-ink-muted mb-2">
          Tích chọn các mẫu muốn đưa vào vòng xoay (bỏ tích để loại). Đang có <b className="text-ink">{s.autoThemes.length || 15}/15</b> mẫu.{' '}
          <button type="button" className="text-primary font-bold underline" onClick={() => setS({ ...s, autoThemes: [] })}>
            Chọn tất cả
          </button>
        </p>
      )}

      <div className="flex flex-col gap-4">
        {BG_GROUPS.map((g) => (
          <section key={g.id}>
            <h2 className="font-extrabold text-sm">
              {g.label} <span className="font-semibold text-ink-muted">— {g.hint}</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1.5">
              {BG_THEMES.filter((t) => t.group === g.id).map((t) => {
                const selected = s.mode === 'fixed' ? s.theme === t.id : inRotation(t.id);
                const isCur = cur.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    data-testid={`bg-${t.id}`}
                    aria-pressed={selected}
                    onClick={() => (s.mode === 'fixed' ? setS({ ...s, theme: t.id }) : toggleAuto(t.id))}
                    className={`relative text-left rounded-xl overflow-hidden border-2 transition-shadow ${selected ? 'border-primary shadow-md' : 'border-border opacity-80 hover:opacity-100'}`}
                  >
                    <div className="relative h-24 sm:h-28">
                      <ArtScene theme={t} mode="panel" />
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5">
                      <span className="font-bold text-[13.5px]">{t.name}</span>
                      <span className="text-[12px] font-bold text-primary">
                        {isCur ? 'Đang dùng' : selected ? (s.mode === 'fixed' ? 'Đã chọn' : 'Trong vòng xoay') : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4 sticky bottom-0 bg-bg py-2">
        <button type="button" className="tvl-btn-primary !w-auto px-6" onClick={save} disabled={busy || !loaded}>
          {busy ? 'Đang lưu…' : 'Lưu nền giao diện'}
        </button>
        {msg && <span className={`text-sm font-semibold ${msg.ok ? 'text-success' : 'text-critical'}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
