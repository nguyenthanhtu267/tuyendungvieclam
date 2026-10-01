'use client';

import { useState } from 'react';
import { nearestProvince, provincesNear, readHome, saveHome, distanceKm, PROVINCE_COORDS } from '@/lib/geo';

// Đợt 89 — nút "Quanh tôi": một lần bấm lọc các tỉnh trong bán kính đã chọn, gần nhất xếp trước.
// Vị trí chỉ lưu trên trình duyệt của người xem (không gửi lên máy chủ).
export function NearMe({ onPick }: { onPick: (provinces: string[]) => void }) {
  const [r, setR] = useState(10);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function apply(h: { lat?: number; lon?: number; province?: string }) {
    const list = provincesNear(h, r)
      .filter((p) => PROVINCE_COORDS[p])
      .sort((a, b) => (distanceKm(h, [a]) ?? 0) - (distanceKm(h, [b]) ?? 0))
      .slice(0, 5);
    if (!list.length && h.lat != null && h.lon != null) list.push(nearestProvince(h.lat, h.lon));
    if (!list.length) return setMsg('Chưa có tỉnh nào trong bán kính này');
    setMsg('');
    onPick(list);
  }

  function go() {
    const saved = readHome();
    if (saved && (saved.province || saved.lat != null)) return apply(saved);
    if (!navigator.geolocation) return setMsg('Trình duyệt không hỗ trợ định vị — hãy chọn tỉnh thủ công');
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;
        saveHome({ lat, lon });
        setBusy(false);
        apply({ lat, lon });
      },
      () => {
        setBusy(false);
        setMsg('Không lấy được vị trí — hãy cho phép định vị hoặc chọn tỉnh thủ công');
      },
      { timeout: 8000 },
    );
  }

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px]">
      <button type="button" onClick={go} disabled={busy} className="rounded-full border border-primary text-primary font-bold px-3 py-1 hover:bg-primary-tint disabled:opacity-50">
        📍 Quanh tôi
      </button>
      <select id="near-radius" aria-label="Bán kính" value={r} onChange={(e) => setR(Number(e.target.value))} className="rounded-md border border-border-strong px-1.5 py-1 text-[12px]">
        <option value={5}>5 km</option>
        <option value={10}>10 km</option>
        <option value={20}>20 km</option>
        <option value={30}>30 km</option>
      </select>
      {msg && <span className="text-ink-muted">{msg}</span>}
    </div>
  );
}
