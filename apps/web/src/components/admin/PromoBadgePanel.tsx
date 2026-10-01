'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { adminApi } from '@/lib/api-admin';

// Đợt 23 (29/09/2026) — Admin "📣 Nhãn logo": bật/tắt, sửa chữ và link của nhãn nhấp nháy cạnh logo header.
export function PromoBadgePanel({ token }: { token: string }) {
  const [enabled, setEnabled] = useState(false);
  const [text, setText] = useState('Phần mềm Nhân sự Toàn diện');
  const [url, setUrl] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    adminApi
      .getPromoBadge(token)
      .then((b) => {
        setEnabled(b.enabled);
        setText(b.text);
        setUrl(b.url ?? '');
        setLoaded(true);
      })
      .catch((e) => setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'Không tải được cấu hình' }));
  }, [token]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminApi.setPromoBadge(token, { enabled, text, url: url.trim() });
      setEnabled(r.enabled);
      setText(r.text);
      setUrl(r.url ?? '');
      setMsg({ ok: true, text: 'Đã lưu. Trang web sẽ hiện nhãn mới sau khi người dùng tải lại trang.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'Lưu không thành công' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl" data-testid="promo-badge-panel">
      <h1 className="font-bold text-base mb-1">Nhãn quảng bá cạnh logo</h1>
      <p className="text-xs text-ink-faint mb-4">
        Dòng chữ nhỏ đổi màu, thỉnh thoảng nảy lên nhấp nháy ở góc trên chữ &quot;MIỄN PHÍ&quot; của logo. Bấm vào sẽ mở
        <b> tab trình duyệt mới</b> tới link bên dưới. Chỉ hiện khi đã bật và có link.
      </p>
      <div className="rounded-xl bg-white border border-border p-4 flex flex-col gap-3 text-xs">
        <label className="flex items-center gap-2 font-bold" htmlFor="promo-enabled">
          <input
            id="promo-enabled"
            type="checkbox"
            checked={enabled}
            disabled={!loaded}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Hiển thị nhãn trên web
        </label>
        <label className="flex flex-col gap-1 font-semibold" htmlFor="promo-text">
          Chữ hiển thị (2–60 ký tự)
          <input
            id="promo-text"
            value={text}
            maxLength={60}
            onChange={(e) => setText(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 font-semibold" htmlFor="promo-url">
          Link khi bấm vào (bắt đầu bằng https://)
          <input
            id="promo-url"
            value={url}
            placeholder="https://..."
            onChange={(e) => setUrl(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 font-normal"
          />
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            id="promo-save"
            disabled={busy || !loaded}
            onClick={save}
            className="rounded-lg bg-primary text-white font-bold px-4 py-2 disabled:opacity-50"
          >
            {busy ? 'Đang lưu…' : 'Lưu'}
          </button>
          {url.trim() && (
            <a href={url.trim()} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold">
              Thử mở link ↗
            </a>
          )}
        </div>
        {msg && <div className={msg.ok ? 'text-success font-semibold' : 'text-critical font-semibold'}>{msg.text}</div>}
      </div>
      <div className="mt-4 text-[11px] text-ink-faint">Xem trước:</div>
      <div className="mt-6 relative inline-block ml-9">
        <span
          className="promo-badge absolute left-0 -top-[15px] whitespace-nowrap rounded-full px-2 py-[1px] text-[9.5px] leading-[14px] font-extrabold text-white"
        >
          {text || '…'}
        </span>
        <span className="font-extrabold text-[13px] tracking-tight whitespace-nowrap">
          ĐĂNG TUYỂN <span className="text-accent">MIỄN PHÍ</span>
        </span>
      </div>
    </div>
  );
}
