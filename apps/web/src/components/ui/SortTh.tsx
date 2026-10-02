'use client';

import { useMemo, useState } from 'react';

// Đợt 144 — tiêu đề cột bấm được để sắp xếp (dùng chung cho mọi bảng): bấm lần 1 tăng ↑, lần 2 giảm ↓,
// lần 3 bỏ sắp xếp (về thứ tự gốc). Sắp theo tiếng Việt (có dấu), số sắp theo giá trị, ô trống luôn xuống cuối.
// Dùng:  const s = useSort(rows, { title: (r) => r.title, salary: (r) => r.salaryMin });
//        <SortTh s={s} k="title">Chức danh</SortTh> ... rồi map s.rows thay cho rows.
export type SortDir = 'asc' | 'desc';
export type SortAccessors<T> = Record<string, (row: T) => string | number | boolean | Date | null | undefined>;

const collator = typeof Intl !== 'undefined' ? new Intl.Collator('vi', { numeric: true, sensitivity: 'base' }) : null;

function norm(v: unknown): string | number | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  return String(v);
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const x = String(a);
  const y = String(b);
  return collator ? collator.compare(x, y) : x.localeCompare(y);
}

export function useSort<T>(rows: T[] | null | undefined, accessors: SortAccessors<T>, initial?: { key: string; dir: SortDir }) {
  const [state, setState] = useState<{ key: string; dir: SortDir } | null>(initial ?? null);
  const list = rows ?? [];
  const sorted = useMemo(() => {
    if (!state) return list;
    const get = accessors[state.key];
    if (!get) return list;
    const mul = state.dir === 'asc' ? 1 : -1;
    return list
      .map((r, i) => ({ r, i, v: norm(get(r)) }))
      .sort((p, q) => {
        if (p.v == null && q.v == null) return p.i - q.i;
        if (p.v == null) return 1; // ô trống luôn cuối, bất kể chiều
        if (q.v == null) return -1;
        return compare(p.v, q.v) * mul || p.i - q.i;
      })
      .map((x) => x.r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, state]);
  function toggle(key: string) {
    setState((cur) => (!cur || cur.key !== key ? { key, dir: 'asc' } : cur.dir === 'asc' ? { key, dir: 'desc' } : null));
  }
  return { rows: sorted, key: state?.key ?? null, dir: state?.dir ?? null, toggle };
}

export type SortApi = { key: string | null; dir: SortDir | null; toggle: (k: string) => void };

export function SortTh({
  s,
  k,
  children,
  className = '',
  align = 'left',
}: {
  s: SortApi;
  k: string;
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  const on = s.key === k;
  return (
    <th
      aria-sort={on ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`${className} ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={() => s.toggle(k)}
        title="Bấm để sắp xếp tăng / giảm / bỏ sắp xếp"
        className={`inline-flex items-center gap-1 whitespace-nowrap [text-transform:inherit] hover:text-primary ${on ? 'text-primary' : ''}`}
      >
        {children}
        <span aria-hidden className={`text-[10px] leading-none ${on ? '' : 'opacity-40'}`}>{on ? (s.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}
