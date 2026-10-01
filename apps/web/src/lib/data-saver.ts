'use client';
import { useEffect, useState } from 'react';

// Đợt 87 — Chế độ tiết kiệm dữ liệu: tắt nền vector + banner quảng cáo (nặng ảnh) cho mạng yếu / 3G / gói data hạn chế.
// Tự bật nếu trình duyệt báo "Data Saver" hoặc mạng 2G/3G chậm (người dùng vẫn tắt được); lựa chọn thủ công được nhớ.
export const SAVER_KEY = 'tvl_data_saver'; // '1' bật | '0' tắt | (không có) = tự động

export function detectSlowNet(): boolean {
  try {
    const c = (navigator as any).connection;
    if (!c) return false;
    return !!c.saveData || /(^|-)2g$|3g/.test(String(c.effectiveType || ''));
  } catch {
    return false;
  }
}

export function readSaver(): boolean {
  try {
    const v = localStorage.getItem(SAVER_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    /* bỏ qua */
  }
  return detectSlowNet();
}

export function applySaver(on: boolean) {
  if (typeof document === 'undefined') return;
  if (on) document.documentElement.dataset.saver = '1';
  else delete document.documentElement.dataset.saver;
  window.dispatchEvent(new Event('tvl-saver'));
}

export function setSaver(on: boolean) {
  try {
    localStorage.setItem(SAVER_KEY, on ? '1' : '0');
  } catch {
    /* bỏ qua */
  }
  applySaver(on);
}

export function useDataSaver(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(document.documentElement.dataset.saver === '1');
    sync();
    window.addEventListener('tvl-saver', sync);
    return () => window.removeEventListener('tvl-saver', sync);
  }, []);
  return on;
}

// Đợt 109 — Chế độ CHỈ CHỮ: không tải logo/ảnh, giữ lại chữ. Lựa chọn nhớ ở máy.
export const TEXT_KEY = 'tvl_text_only';
export function readTextOnly(): boolean {
  try {
    return localStorage.getItem(TEXT_KEY) === '1';
  } catch {
    return false;
  }
}
export function applyTextOnly(on: boolean) {
  if (typeof document === 'undefined') return;
  if (on) document.documentElement.dataset.textonly = '1';
  else delete document.documentElement.dataset.textonly;
  window.dispatchEvent(new Event('tvl-textonly'));
}
export function setTextOnly(on: boolean) {
  try {
    localStorage.setItem(TEXT_KEY, on ? '1' : '0');
  } catch {
    /* bỏ qua */
  }
  applyTextOnly(on);
}
export function useTextOnly(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(document.documentElement.dataset.textonly === '1');
    sync();
    window.addEventListener('tvl-textonly', sync);
    return () => window.removeEventListener('tvl-textonly', sync);
  }, []);
  return on;
}
// Mạng yếu theo trình duyệt (Chrome/Edge): 2G/3G, độ trễ cao hoặc tốc độ tải thấp.
export function detectWeakNet(): boolean {
  try {
    const c = (navigator as any).connection;
    if (!c) return false;
    return /(^|-)2g$|3g/.test(String(c.effectiveType || '')) || (c.rtt && c.rtt >= 800) || (c.downlink && c.downlink < 0.7) || !!c.saveData;
  } catch {
    return false;
  }
}

// Đợt 111 — đánh dấu "vừa có lời gọi chậm" để các nơi khác biết mạng đang yếu (gộp thao tác lọc, chỉ báo…).
let lastSlowAt = 0;
export function markSlow() {
  lastSlowAt = Date.now();
}
export function isWeakNow(): boolean {
  return detectWeakNet() || Date.now() - lastSlowAt < 120_000;
}
// Ước tính dung lượng đã tiết kiệm nhờ "Chỉ chữ" (mỗi logo thu nhỏ khoảng 6KB) — chỉ là số ước tính, tính trong phiên này.
const LOGO_KB = 6;
const counted = new Set<string>();
export function countLogoSaved(key: string) {
  if (counted.has(key)) return;
  counted.add(key);
  window.dispatchEvent(new CustomEvent('tvl-saved-kb', { detail: counted.size * LOGO_KB }));
}
export function savedKb(): number {
  return counted.size * LOGO_KB;
}
export function useSavedKb(): number {
  const [kb, setKb] = useState(0);
  useEffect(() => {
    setKb(savedKb());
    const on = (e: Event) => setKb(Number((e as CustomEvent<number>).detail) || 0);
    window.addEventListener('tvl-saved-kb', on);
    return () => window.removeEventListener('tvl-saved-kb', on);
  }, []);
  return kb;
}
