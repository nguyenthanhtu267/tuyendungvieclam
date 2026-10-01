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
