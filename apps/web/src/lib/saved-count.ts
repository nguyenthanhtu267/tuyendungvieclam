'use client';
import { useEffect, useState } from 'react';

// Đợt 91 — số việc đã lưu (hiện ở thanh điều hướng dưới trên điện thoại). Lưu cục bộ để KHÔNG phải gọi API thêm:
// được cập nhật khi người dùng bấm ♡ ở thẻ việc hoặc mở trang Hồ sơ. Đồng bộ nhiều tab qua sự kiện `storage`.
const KEY = 'tvl_saved_n';
const EVT = 'tvl-saved-n';

function read(): number | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function setSavedCount(n: number) {
  try {
    localStorage.setItem(KEY, String(Math.max(0, Math.round(n))));
  } catch {
    /* bỏ qua */
  }
  window.dispatchEvent(new Event(EVT));
}

export function bumpSavedCount(delta: number) {
  const cur = read();
  if (cur == null) return; // chưa biết số gốc → không đoán
  setSavedCount(cur + delta);
}

export function clearSavedCount() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* bỏ qua */
  }
  window.dispatchEvent(new Event(EVT));
}

export function useSavedCount(): number | null {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    const f = () => setN(read());
    f();
    window.addEventListener(EVT, f);
    window.addEventListener('storage', f);
    return () => {
      window.removeEventListener(EVT, f);
      window.removeEventListener('storage', f);
    };
  }, []);
  return n;
}
