'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// Đợt 53 — chữ TỰ CO LẠI cho vừa khung (không tràn, không xuống dòng): đo bề rộng nội dung so với khung chứa rồi thu nhỏ
// bằng scale. Dùng cho tên công ty / nhãn ở những khung hẹp. Co tối đa tới `min` (mặc định 50%).
export function FitText({
  children,
  className = '',
  min = 0.5,
  align = 'left',
  lines,
}: {
  children: ReactNode;
  className?: string;
  min?: number;
  align?: 'left' | 'center' | 'right';
  // Có `lines` → cho phép xuống tối đa n dòng và thu cỡ chữ đến khi vừa n dòng (tên rất dài vẫn đọc được).
  // Không có → 1 dòng, thu bằng scale (dùng cho nhãn/badge có cỡ chữ cố định).
  lines?: number;
}) {
  if (lines) return <WrapFit className={className} min={min} lines={lines}>{children}</WrapFit>;
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  const [h, setH] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const ow = o.clientWidth;
      const iw = i.offsetWidth;
      if (!ow || !iw) return;
      const s = Math.max(min, Math.min(1, ow / iw));
      setScale(s);
      setH(i.offsetHeight * s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [children, min]);

  const origin = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
  return (
    <span ref={outer} className={`block w-full min-w-0 overflow-hidden ${className}`} style={{ height: h }}>
      <span
        ref={inner}
        className="inline-block whitespace-nowrap"
        style={{ transform: `scale(${scale})`, transformOrigin: `${origin} top`, marginLeft: align === 'center' ? 'auto' : undefined }}
      >
        {children}
      </span>
    </span>
  );
}

function WrapFit({ children, className, min, lines }: { children: ReactNode; className: string; min: number; lines: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = '';
      const base = parseFloat(getComputedStyle(el).fontSize);
      if (!base || !el.clientWidth) return;
      let f = 1;
      const lh = () => parseFloat(getComputedStyle(el).lineHeight) || base * 1.25;
      // đo lại chiều cao mỗi lần thu 4% cho tới khi đủ số dòng cho phép
      while (f > min && el.scrollHeight > lh() * lines + 1) {
        f -= 0.04;
        el.style.fontSize = `${base * f}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, min, lines]);
  return (
    <span
      ref={ref}
      className={`w-full min-w-0 break-words ${className}`}
      style={{ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
    >
      {children}
    </span>
  );
}
