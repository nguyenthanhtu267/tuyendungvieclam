'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { jobsApi } from '@/lib/api';

// Đợt 38 — "Phù hợp x%" cho tài khoản ứng viên có hồ sơ. Gom nhiều thẻ tin thành 1 lần gọi API (chờ ~40ms), có bộ nhớ đệm.
export interface MatchInfo {
  score: number;
  reasons: string[];
  gaps: string[];
}
const cache = new Map<string, MatchInfo | null>();
const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let version = 0;
const subs = new Set<() => void>();
let tokenRef: string | null = null;

function flush() {
  timer = null;
  const ids = Array.from(pending);
  pending.clear();
  if (!ids.length || !tokenRef) return;
  const t = tokenRef;
  jobsApi
    .match(t, ids)
    .then((r) => {
      ids.forEach((id) => cache.set(id, r.scores[id] ?? null));
    })
    .catch(() => ids.forEach((id) => cache.set(id, null)))
    .finally(() => {
      version++;
      subs.forEach((f) => f());
    });
}

export function useMatches(ids: string[]): Record<string, MatchInfo | null> {
  const { me, token } = useAuth();
  const [, setV] = useState(version);
  const enabled = !!token && me?.role === 'candidate';
  useEffect(() => {
    const f = () => setV(version);
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  }, []);
  const key = ids.join(',');
  useEffect(() => {
    if (!enabled) return;
    tokenRef = token;
    let need = false;
    ids.forEach((id) => {
      if (!cache.has(id) && !pending.has(id)) {
        pending.add(id);
        need = true;
      }
    });
    if (need && !timer) timer = setTimeout(flush, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, token]);
  const out: Record<string, MatchInfo | null> = {};
  if (enabled) ids.forEach((id) => (out[id] = cache.get(id) ?? null));
  return out;
}

export function matchTone(score: number) {
  if (score >= 80) return { cls: 'bg-success text-white', label: 'Rất phù hợp' };
  if (score >= 65) return { cls: 'bg-primary text-white', label: 'Phù hợp' };
  return { cls: 'bg-surface-alt text-ink border border-border-strong', label: 'Tham khảo' };
}
