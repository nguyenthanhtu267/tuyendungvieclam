'use client';

import { useEffect, useState } from 'react';

// Đợt 46 — danh sách tin đang chọn để so sánh (tối đa 3), lưu trên trình duyệt người xem.
const KEY = 'tvl_compare';
export const COMPARE_MAX = 3;
export interface CompareItem {
  id: string;
  title: string;
}

function read(): CompareItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}
function write(items: CompareItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* bỏ qua */
  }
  window.dispatchEvent(new Event('tvl-compare'));
}

export function useCompare() {
  const [items, setItems] = useState<CompareItem[]>([]);
  useEffect(() => {
    const f = () => setItems(read());
    f();
    window.addEventListener('tvl-compare', f);
    window.addEventListener('storage', f);
    return () => {
      window.removeEventListener('tvl-compare', f);
      window.removeEventListener('storage', f);
    };
  }, []);
  return {
    items,
    has: (id: string) => items.some((i) => i.id === id),
    toggle: (it: CompareItem): 'added' | 'removed' | 'full' => {
      const cur = read();
      if (cur.some((i) => i.id === it.id)) {
        write(cur.filter((i) => i.id !== it.id));
        return 'removed';
      }
      if (cur.length >= COMPARE_MAX) return 'full';
      write([...cur, it]);
      return 'added';
    },
    remove: (id: string) => write(read().filter((i) => i.id !== id)),
    clear: () => write([]),
  };
}
