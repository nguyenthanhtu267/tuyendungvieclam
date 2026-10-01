'use client';
import { useCallback, useEffect, useState } from 'react';

// Đợt 81 — tin đã lưu (nằm trong trình duyệt của người xem, không cần tài khoản).
const KEY = 'tvl_saved_labor_jobs';
const EVT = 'tvl-saved-labor';
const read = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 30) : [];
  } catch {
    return [];
  }
};
export function useSavedJobs() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    setIds(read());
    const on = () => setIds(read());
    window.addEventListener(EVT, on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener(EVT, on);
      window.removeEventListener('storage', on);
    };
  }, []);
  const toggle = useCallback((id: string) => {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur].slice(0, 30);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* bỏ qua */
    }
    window.dispatchEvent(new Event(EVT));
  }, []);
  return { ids, has: (id: string) => ids.includes(id), toggle };
}
