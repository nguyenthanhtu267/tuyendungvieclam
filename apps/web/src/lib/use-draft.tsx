'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Đợt 91 — LƯU NHÁP TỰ ĐỘNG cho form dài (đăng tin tuyển dụng, ứng tuyển). Mất mạng / cuộn nhầm / tab bị đóng / điện thoại tắt màn hình
// giữa chừng → mở lại vẫn còn, hỏi "Khôi phục bản nháp?". Chỉ lưu trên MÁY NÀY (localStorage), tối đa 7 ngày, xoá khi gửi thành công
// hoặc khi đăng xuất (máy dùng chung không lộ thông tin người trước). Không bao giờ ghi đè nháp cũ trước khi người dùng chọn Khôi phục/Bỏ.
const PREFIX = 'tvl_draft:';
const TTL_MS = 7 * 24 * 3600 * 1000;

export function clearAllDrafts() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* bỏ qua */
  }
}

interface Stored<T> {
  v: T;
  t: number;
}

export function useDraft<T>({
  key,
  value,
  enabled = true,
  isEmpty,
  onRestore,
}: {
  key: string | null; // null = chưa đủ điều kiện (VD chưa biết user)
  value: T;
  enabled?: boolean;
  isEmpty: (v: T) => boolean;
  onRestore: (v: T) => void;
}) {
  const [pending, setPending] = useState<Stored<T> | null>(null);
  const [checked, setChecked] = useState(false);
  const stop = useRef(false); // sau khi gửi thành công → không lưu lại nữa
  const fullKey = key ? PREFIX + key : null;

  // 1) tìm nháp cũ khi mở form
  useEffect(() => {
    setChecked(false);
    setPending(null);
    stop.current = false;
    if (!fullKey || !enabled) return;
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw) {
        const s = JSON.parse(raw) as Stored<T>;
        if (s && typeof s.t === 'number' && Date.now() - s.t < TTL_MS && !isEmpty(s.v)) setPending(s);
        else localStorage.removeItem(fullKey);
      }
    } catch {
      /* bỏ qua */
    }
    setChecked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey, enabled]);

  // 2) tự lưu (chờ 0,8 giây sau lần gõ cuối) — không lưu khi đang chờ người dùng quyết định nháp cũ
  useEffect(() => {
    if (!fullKey || !enabled || !checked || pending || stop.current) return;
    const t = setTimeout(() => {
      try {
        if (isEmpty(value)) localStorage.removeItem(fullKey);
        else localStorage.setItem(fullKey, JSON.stringify({ v: value, t: Date.now() } satisfies Stored<T>));
      } catch {
        /* hết dung lượng / chế độ riêng tư → bỏ qua */
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, fullKey, enabled, checked, pending]);

  const restore = useCallback(() => {
    if (!pending) return;
    onRestore(pending.v);
    setPending(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const discard = useCallback(() => {
    if (fullKey) {
      try {
        localStorage.removeItem(fullKey);
      } catch {
        /* bỏ qua */
      }
    }
    setPending(null);
  }, [fullKey]);

  /** Gọi sau khi gửi thành công. */
  const clear = useCallback(() => {
    stop.current = true;
    if (fullKey) {
      try {
        localStorage.removeItem(fullKey);
      } catch {
        /* bỏ qua */
      }
    }
    setPending(null);
  }, [fullKey]);

  return { pending, restore, discard, clear };
}

function ago(t: number): string {
  const m = Math.max(1, Math.round((Date.now() - t) / 60000));
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} giờ trước`;
  return `${Math.round(h / 24)} ngày trước`;
}

export function DraftBanner({ savedAt, onRestore, onDiscard, label = 'Bạn có bản nháp chưa gửi' }: { savedAt: number; onRestore: () => void; onDiscard: () => void; label?: string }) {
  return (
    <div role="status" className="rounded-lg border border-warning bg-warning-tint px-3 py-2 flex items-center gap-2 flex-wrap text-[13px] mb-2" data-testid="draft-banner">
      <span className="font-semibold flex-1 min-w-[180px]">
        📝 {label} (lưu {ago(savedAt)}).
      </span>
      <button type="button" onClick={onRestore} className="rounded-lg bg-primary text-white font-bold px-3 min-h-[36px]">
        Khôi phục
      </button>
      <button type="button" onClick={onDiscard} className="rounded-lg border border-border-strong bg-white font-bold px-3 min-h-[36px]">
        Bỏ nháp
      </button>
    </div>
  );
}
