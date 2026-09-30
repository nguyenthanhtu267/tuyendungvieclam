'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Đợt 31 — "bộ điều tiết mật độ" quảng cáo: banner phải tự nhiên, không dồn cục.
//  · Banner ngang (dải giữa trang): 2 banner cách nhau < MIN_GAP px theo chiều dọc → chỉ giữ cái ưu tiên cao hơn.
//    Ưu tiên: xen giữa/giữa bài > đầu trang > cuối nội dung > ngay trên chân trang. Nghĩa là mỗi ~1 màn hình chỉ có ≤ 1 banner ngang.
//  · Cột phải (AdStack): chỉ giữ 1 banner — cột dính theo khi cuộn nên 1 banner là đủ, không xếp chồng 2–3 khung sát nhau.
//  · Dải nhỏ (sau khi nộp đơn, menu điện thoại) là khung tương tác riêng → không bị điều tiết.
// Đo lúc tất cả banner đang hiện rồi quyết định trong cùng 1 nhịp (không nhấp nháy); ẩn bằng class .ad-suppressed.
const MIN_GAP = 720;
// Ngân sách mỗi trang: máy tính ≤ 3 banner (1 khung dọc cột phải + ≤ 2 dải ngang); điện thoại ≤ 2 dải ngang. Chỉ 2 loại kích thước: dải ngang và khung dọc.
const BUDGET_DESKTOP = 3;
const BUDGET_MOBILE = 2;
const PRIORITY = ['jobs-inline', 'job-mid', 'home-top', 'home-mid', 'candidate-top', 'employer-top', 'employer-search', 'jobs-bottom', 'job-bottom', 'company-bottom', 'home-bottom', 'footer-top'];
const rank = (s: string) => {
  const i = PRIORITY.indexOf(s);
  return i < 0 ? 99 : i;
};

function govern() {
  const all = Array.from(document.querySelectorAll<HTMLElement>('[data-ad-slot]'));
  all.forEach((e) => e.classList.remove('ad-suppressed'));

  // Trùng nội dung (cùng tiêu đề + link) → chỉ giữ cái xuất hiện trước trên trang.
  const seenKeys = new Set<string>();
  all
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
    .forEach((e) => {
      const k = e.dataset.adKey || '';
      if (!k) return;
      if (seenKeys.has(k)) e.classList.add('ad-suppressed');
      else seenKeys.add(k);
    });

  // Cột phải: giữ banner đầu tiên của mỗi AdStack.
  document.querySelectorAll<HTMLElement>('[data-ad-stack]').forEach((stack) => {
    Array.from(stack.querySelectorAll<HTMLElement>('[data-ad-slot]:not(.ad-suppressed)')).slice(1).forEach((e) => e.classList.add('ad-suppressed'));
  });

  // Dải ngang: chọn tham lam theo ưu tiên.
  const wides = all.filter((e) => e.dataset.adGov === 'wide' && !e.classList.contains('ad-suppressed') && e.offsetParent !== null);
  const box = (e: HTMLElement) => {
    const r = e.getBoundingClientRect();
    return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
  };
  const desktop = window.matchMedia('(min-width: 1024px)').matches;
  const sideKept = all.filter((e) => e.dataset.adGov === 'tall' && !e.classList.contains('ad-suppressed') && e.offsetParent !== null).length;
  const allowWide = Math.max(0, (desktop ? BUDGET_DESKTOP : BUDGET_MOBILE) - (desktop ? sideKept : 0));
  const kept: { top: number; bottom: number }[] = [];
  wides
    .map((e) => ({ e, r: rank(e.dataset.adSlot || ''), b: box(e) }))
    .sort((a, b) => a.r - b.r)
    .forEach(({ e, b }) => {
      const near = kept.some((k) => Math.max(b.top - k.bottom, k.top - b.bottom) < MIN_GAP);
      if (near || kept.length >= allowWide) e.classList.add('ad-suppressed');
      else kept.push(b);
    });
}

export function AdGovernor() {
  const path = usePathname();
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      clearTimeout(t);
      t = setTimeout(govern, 120);
    };
    run();
    const mo = new MutationObserver((muts) => {
      // Chỉ phản ứng khi có phần tử được thêm/bớt (không phản ứng khi đổi class của chính bộ này).
      if (muts.some((m) => m.type === 'childList')) run();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    const ro = new ResizeObserver(run);
    ro.observe(document.body);
    window.addEventListener('resize', run);
    return () => {
      clearTimeout(t);
      mo.disconnect();
      ro.disconnect();
      window.removeEventListener('resize', run);
    };
  }, [path]);
  return null;
}
