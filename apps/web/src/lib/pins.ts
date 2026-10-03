'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth-context';

// Đợt 74 — "Ghim" tối đa 3 lĩnh vực và 3 địa điểm hay tìm: mục đã ghim luôn nằm trên cùng danh sách chọn.
// Lưu theo tài khoản trên trình duyệt này (localStorage, khoá theo id người dùng); chỉ dành cho người đã đăng nhập.
export const MAX_PINS = 3;
export type PinKind = 'industries' | 'provinces' | 'labor_groups';

export interface PinsApi {
  list: string[];
  max: number;
  toggle: (v: string) => string | void; // trả về thông báo nếu không ghim thêm được
}

export function usePins(kind: PinKind): PinsApi | undefined {
  const { me } = useAuth();
  const key = me ? `tvl_pins_${kind}_${me.id}` : null;
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    if (!key) return setList([]);
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? '[]');
      setList(Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX_PINS) : []);
    } catch {
      setList([]);
    }
  }, [key]);
  const toggle = useCallback(
    (v: string) => {
      if (!key) return;
      let next: string[];
      if (list.includes(v)) next = list.filter((x) => x !== v);
      else if (list.length >= MAX_PINS) return `Chỉ ghim tối đa ${MAX_PINS}. Bỏ ghim một mục để ghim mục khác.`;
      else next = [...list, v];
      setList(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* bỏ qua: chế độ riêng tư */
      }
    },
    [key, list],
  );
  return key ? { list, max: MAX_PINS, toggle } : undefined;
}
