'use client';
import { useEffect } from 'react';

// Đợt 163 (web) — phím tắt: "/" nhảy vào ô tìm kiếm chính (như GitHub/YouTube); Esc trong ô tìm thì bỏ focus.
export default function KeyboardShortcuts() {
  useEffect(() => {
    function f(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const el = document.getElementById('tvl-main-search') as HTMLInputElement | null;
        if (el) { e.preventDefault(); el.focus(); el.select(); }
      } else if (e.key === 'Escape' && t?.id === 'tvl-main-search') {
        (t as HTMLInputElement).blur();
      }
    }
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, []);
  return null;
}
