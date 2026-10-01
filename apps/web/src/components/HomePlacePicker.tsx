'use client';

import { useState } from 'react';
import { PROVINCE_COORDS, nearestProvince, saveHome, useHomePlace, provincesNear } from '@/lib/geo';

// Đợt 46 — "Nơi ở của tôi" + nút "Gần tôi" ở trang tìm việc.
export default function HomePlacePicker({ onNearMe }: { onNearMe: (provinces: string[]) => void }) {
  const home = useHomePlace();
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState('');
  const [radius, setRadius] = useState(10);
  const label = home ? (home.province ?? (home.lat != null ? `Gần ${nearestProvince(home.lat, home.lon!)}` : '')) : '';

  function useGps() {
    if (!navigator.geolocation) return setMsg('Trình duyệt không hỗ trợ định vị');
    setMsg('Đang lấy vị trí…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        saveHome({ lat: Math.round(pos.coords.latitude * 100) / 100, lon: Math.round(pos.coords.longitude * 100) / 100 });
        setMsg('');
        setEditing(false);
      },
      () => setMsg('Không lấy được vị trí — hãy chọn tỉnh'),
      { timeout: 8000 },
    );
  }

  if (!home || editing)
    return (
      <div className="flex items-center gap-2 flex-wrap text-[13.5px]">
        <span className="font-semibold text-ink">📍 Nơi ở của bạn:</span>
        <select
          aria-label="Chọn tỉnh nơi ở"
          className="tvl-input !w-auto !py-1"
          value={home?.province ?? ''}
          onChange={(e) => {
            if (e.target.value) {
              saveHome({ province: e.target.value });
              setEditing(false);
            }
          }}
        >
          <option value="">Chọn tỉnh/thành</option>
          {Object.keys(PROVINCE_COORDS).map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <button onClick={useGps} className="text-primary font-semibold underline">Dùng vị trí của tôi</button>
        {msg && <span className="text-ink-faint">{msg}</span>}
      </div>
    );
  return (
    <div className="flex items-center gap-2 flex-wrap text-[13.5px]">
      <span className="text-ink">
        📍 Nơi ở: <b>{label}</b>
      </span>
      <button onClick={() => setEditing(true)} className="text-ink-faint underline">Đổi</button>
      <select
        aria-label="Bán kính tìm việc gần nhà"
        className="tvl-input !w-auto !py-0.5"
        value={radius}
        onChange={(e) => setRadius(Number(e.target.value))}
      >
        {[5, 10, 20, 30].map((r) => (
          <option key={r} value={r}>
            ≤ {r} km
          </option>
        ))}
      </select>
      <button onClick={() => onNearMe(provincesNear(home, radius))} className="rounded-lg border border-primary text-primary font-semibold px-2.5 py-0.5 hover:bg-primary-tint">
        Việc gần tôi
      </button>
      <span className="text-ink-faint text-[12px]">Khoảng cách ước tính theo tỉnh/thành.</span>
    </div>
  );
}
