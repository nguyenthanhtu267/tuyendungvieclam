'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AddressValue } from './AddressPicker';
import { nearestProvince } from '@/lib/geo';

// Đợt 134 — "Gần tôi" không cần hồ sơ: vị trí máy (GPS) hoặc khu vực người dùng tự chọn.
// Chỉ lưu trên máy này (localStorage), không gửi lên máy chủ ngoài lúc tìm việc.
export type JobOrigin =
  | { mode: 'gps'; lat: number; lon: number; province: string; label: string }
  | { mode: 'area'; area: AddressValue; label: string };

const KEY = 'tvl_labor_origin';

function read(): JobOrigin | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v && (v.mode === 'gps' || v.mode === 'area')) return v as JobOrigin;
  } catch {
    /* trình duyệt chặn bộ nhớ */
  }
  return null;
}

export function areaLabel(a: AddressValue): string {
  const ward = a.addressMode === 'new' ? a.newWardName : a.oldWard;
  return [ward, a.addressMode === 'old' ? a.oldDistrict : '', a.province].filter(Boolean).join(', ');
}

export function originParams(o: JobOrigin | null): Record<string, string | undefined> {
  if (!o) return {};
  if (o.mode === 'gps') return { oLat: String(o.lat), oLon: String(o.lon), oProvince: o.province || undefined, oDistrict: undefined, oWard: undefined };
  const a = o.area;
  return {
    oProvince: a.province,
    oDistrict: a.addressMode === 'old' ? a.oldDistrict || undefined : undefined,
    oWard: a.addressMode === 'new' ? a.newWardCode || undefined : undefined,
    oLat: undefined,
    oLon: undefined,
  };
}

export function useJobOrigin() {
  const [origin, setOriginState] = useState<JobOrigin | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setOriginState(read()), []);
  const setOrigin = useCallback((o: JobOrigin | null) => {
    setOriginState(o);
    try {
      if (o) localStorage.setItem(KEY, JSON.stringify(o));
      else localStorage.removeItem(KEY);
    } catch {
      /* bỏ qua */
    }
  }, []);
  const locate = useCallback(() => {
    setError('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Máy này không hỗ trợ lấy vị trí — hãy chọn khu vực bên dưới.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = Math.round(pos.coords.latitude * 1e4) / 1e4;
        const lon = Math.round(pos.coords.longitude * 1e4) / 1e4;
        const province = nearestProvince(lat, lon);
        setOrigin({ mode: 'gps', lat, lon, province, label: `vị trí của bạn (gần ${province})` });
      },
      (err) => {
        setLocating(false);
        setError(err.code === 1 ? 'Bạn chưa cho phép lấy vị trí — hãy bật quyền vị trí cho trình duyệt hoặc chọn khu vực bên dưới.' : 'Không lấy được vị trí — hãy chọn khu vực bên dưới.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }, [setOrigin]);
  return { origin, setOrigin, locate, locating, error };
}

/** Vị trí đủ chi tiết (tới quận/phường) để lọc theo bán kính km. */
export function isPrecise(o: JobOrigin | null): boolean {
  if (!o) return false;
  if (o.mode === 'area') return !!(o.area.oldDistrict || o.area.newWardCode);
  return false;
}
