'use client';

import { useEffect } from 'react';

// Đợt 91 — VÙNG CHẠM ≥ 44px trên màn hình cảm ứng mà không phải sửa từng nút / làm trang dài ra:
// với mọi liên kết/nút nhỏ hơn 44px, thêm một vùng bấm "vô hình" bao quanh (tối đa +12px dọc, +10px ngang) bằng phần tử ảo ::after.
// Bố cục nhìn thấy KHÔNG đổi. Chỉ chạy khi thiết bị dùng ngón tay (pointer: coarse); máy tính/chuột không bị ảnh hưởng.
// Bỏ qua mục nằm trong [data-no-slop] (VD thanh điều hướng dưới đã đủ lớn).
const MIN = 44;
const SELECTOR = 'a[href],button,summary,[role="button"],label[for]';

export default function TapTargets() {
  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    const seen = new WeakSet<Element>();
    let pending = new Set<Element>();
    let timer = 0;

    function scan(roots: Element[]) {
      const reads: [HTMLElement, number, number][] = [];
      for (const root of roots) {
        const list = root.matches?.(SELECTOR) ? [root, ...Array.from(root.querySelectorAll(SELECTOR))] : Array.from(root.querySelectorAll(SELECTOR));
        for (const node of list) {
          const el = node as HTMLElement;
          if (seen.has(el) || el.classList.contains('tap-auto') || el.closest('[data-no-slop]')) continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue; // đang ẩn → lần sau
          seen.add(el);
          const dy = Math.min(12, Math.max(0, (MIN - r.height) / 2));
          const dx = Math.min(10, Math.max(0, (MIN - r.width) / 2));
          if (dy > 0.5 || dx > 0.5) reads.push([el, dx, dy]);
        }
      }
      for (const [el, dx, dy] of reads) {
        if (getComputedStyle(el, '::after').content !== 'none') continue; // đã dùng ::after cho việc khác
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        el.style.setProperty('--tx', `${dx.toFixed(1)}px`);
        el.style.setProperty('--ty', `${dy.toFixed(1)}px`);
        el.classList.add('tap-auto');
      }
    }

    function flush() {
      timer = 0;
      const roots = Array.from(pending).filter((n) => n.isConnected);
      pending = new Set();
      if (roots.length) scan(roots);
    }
    function queue(n: Element) {
      pending.add(n);
      if (!timer) timer = window.setTimeout(() => ((window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 0)))(flush, { timeout: 800 }), 250);
    }

    queue(document.body);
    const mo = new MutationObserver((ms) => {
      for (const m of ms) m.addedNodes.forEach((n) => n.nodeType === 1 && queue(n as Element));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);
  return null;
}
