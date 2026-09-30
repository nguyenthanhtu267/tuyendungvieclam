'use client';

import { useEffect, useState } from 'react';

// Đợt 46 — Khoảng cách đi làm (ước tính theo toạ độ trung tâm tỉnh/thành — thủ phủ tỉnh).
// Không gọi dịch vụ bản đồ ngoài; vị trí người xem chỉ lưu trên trình duyệt của họ.
export const PROVINCE_COORDS: Record<string, [number, number]> = {
  'Hà Nội': [21.03, 105.85], 'Hồ Chí Minh': [10.78, 106.7],
  'An Giang': [10.38, 105.44], 'Bạc Liêu': [9.29, 105.72], 'Bến Tre': [10.24, 106.38], 'Cà Mau': [9.18, 105.15],
  'Cần Thơ': [10.03, 105.78], 'Đồng Tháp': [10.46, 105.63], 'Hậu Giang': [9.78, 105.47], 'Kiên Giang': [10.01, 105.08],
  'Long An': [10.54, 106.41], 'Sóc Trăng': [9.6, 105.97], 'Tiền Giang': [10.36, 106.36], 'Trà Vinh': [9.93, 106.34],
  'Vĩnh Long': [10.25, 105.97],
  'Bắc Ninh': [21.19, 106.08], 'Hà Nam': [20.54, 105.91], 'Hải Dương': [20.94, 106.33], 'Hải Phòng': [20.86, 106.68],
  'Hưng Yên': [20.65, 106.05], 'Nam Định': [20.43, 106.18], 'Ninh Bình': [20.25, 105.97], 'Thái Bình': [20.45, 106.34],
  'Vĩnh Phúc': [21.31, 105.6],
  'Hà Tĩnh': [18.34, 105.91], 'Nghệ An': [18.68, 105.68], 'Quảng Bình': [17.47, 106.6], 'Quảng Trị': [16.82, 107.1],
  'Thanh Hóa': [19.81, 105.78], 'Thừa Thiên Huế': [16.46, 107.59],
  'Bắc Giang': [21.27, 106.19], 'Bắc Kạn': [22.15, 105.83], 'Cao Bằng': [22.67, 106.26], 'Hà Giang': [22.82, 104.98],
  'Lạng Sơn': [21.85, 106.76], 'Phú Thọ': [21.32, 105.4], 'Quảng Ninh': [20.95, 107.08], 'Thái Nguyên': [21.59, 105.85],
  'Tuyên Quang': [21.82, 105.21],
  'Bà Rịa - Vũng Tàu': [10.5, 107.17], 'Bình Dương': [10.98, 106.65], 'Bình Phước': [11.54, 106.9], 'Đồng Nai': [10.95, 106.82],
  'Tây Ninh': [11.31, 106.1], 'Bến Cầu (KCN)': [11.1, 106.15],
  'Bình Định': [13.78, 109.22], 'Bình Thuận': [10.93, 108.1], 'Đà Nẵng': [16.05, 108.2], 'Khánh Hòa': [12.24, 109.19],
  'Ninh Thuận': [11.56, 108.99], 'Phú Yên': [13.09, 109.3], 'Quảng Nam': [15.57, 108.47], 'Quảng Ngãi': [15.12, 108.8],
  'Điện Biên': [21.39, 103.02], 'Hòa Bình': [20.82, 105.34], 'Lai Châu': [22.4, 103.46], 'Lào Cai': [22.48, 103.97],
  'Sơn La': [21.33, 103.91], 'Yên Bái': [21.72, 104.9],
  'Đắk Lắk': [12.67, 108.04], 'Đắk Nông': [12.0, 107.69], 'Gia Lai': [13.98, 108.0], 'Kon Tum': [14.35, 108.0],
  'Lâm Đồng': [11.94, 108.44],
};

export interface HomePlace {
  province?: string; // chọn tỉnh
  lat?: number; // hoặc toạ độ từ "Dùng vị trí của tôi"
  lon?: number;
}

const KEY = 'tvl_home_place';
export function readHome(): HomePlace | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return v && (v.province || (typeof v.lat === 'number' && typeof v.lon === 'number')) ? v : null;
  } catch {
    return null;
  }
}
export function saveHome(h: HomePlace | null) {
  try {
    if (h) localStorage.setItem(KEY, JSON.stringify(h));
    else localStorage.removeItem(KEY);
  } catch {
    /* bỏ qua */
  }
  window.dispatchEvent(new Event('tvl-home'));
}
export function useHomePlace() {
  const [h, setH] = useState<HomePlace | null>(null);
  useEffect(() => {
    const f = () => setH(readHome());
    f();
    window.addEventListener('tvl-home', f);
    return () => window.removeEventListener('tvl-home', f);
  }, []);
  return h;
}

function haversine(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function homePoint(h: HomePlace): [number, number] | null {
  if (typeof h.lat === 'number' && typeof h.lon === 'number') return [h.lat, h.lon];
  return h.province ? PROVINCE_COORDS[h.province] ?? null : null;
}

// Khoảng cách đường bộ ước tính (km) tới tỉnh gần nhất trong danh sách; null nếu không tính được.
export function distanceKm(h: HomePlace, provinces: string[]): number | null {
  const p = homePoint(h);
  if (!p) return null;
  let best: number | null = null;
  for (const name of provinces) {
    if (h.province && name === h.province) return 0;
    const c = PROVINCE_COORDS[name];
    if (!c) continue;
    const d = haversine(p, c) * 1.25; // hệ số đường bộ
    if (best == null || d < best) best = d;
  }
  return best;
}

export function distanceLabel(h: HomePlace, provinces: string[]): string | null {
  if (provinces.some((p) => /remote|từ xa/i.test(p))) return 'Làm từ xa';
  const d = distanceKm(h, provinces);
  if (d == null) return null;
  if (d < 12) return h.province ? 'Cùng tỉnh' : '< 15 km';
  const km = Math.round(d / 5) * 5;
  if (d > 300) return `~${km} km`;
  const hours = d / 45;
  return `~${km} km · ${hours < 1 ? `${Math.max(15, Math.round((hours * 60) / 5) * 5)} phút` : `${(Math.round(hours * 2) / 2).toLocaleString('vi-VN')} giờ`}`;
}

// Các tỉnh trong bán kính `radiusKm` quanh nơi ở — dùng cho nút "Gần tôi".
export function provincesNear(h: HomePlace, radiusKm = 60): string[] {
  return Object.keys(PROVINCE_COORDS).filter((p) => {
    const d = distanceKm(h, [p]);
    return d != null && d <= radiusKm;
  });
}

// Tỉnh gần nhất với toạ độ (hiển thị "Gần Hà Nội").
export function nearestProvince(lat: number, lon: number): string {
  let best = 'Hà Nội';
  let bd = Infinity;
  for (const [name, c] of Object.entries(PROVINCE_COORDS)) {
    const d = haversine([lat, lon], c);
    if (d < bd) {
      bd = d;
      best = name;
    }
  }
  return best;
}
