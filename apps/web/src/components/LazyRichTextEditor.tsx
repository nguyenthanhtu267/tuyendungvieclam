'use client';

import dynamic from 'next/dynamic';

// Đợt 90 — trình soạn thảo (Tiptap, ~150 KB) tách thành gói riêng, tải SAU khi trang đã hiện.
// Trong lúc tải hiện một khung trống cùng kích thước để trang không bị giật.
export const RichTextEditor = dynamic(() => import('./RichTextEditor').then((m) => m.RichTextEditor), {
  ssr: false,
  loading: () => <div className="tvl-input min-h-[120px] animate-pulse motion-reduce:animate-none bg-surface-alt" aria-busy="true" aria-label="Đang tải trình soạn thảo" />,
});
