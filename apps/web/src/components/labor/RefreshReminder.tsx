'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { KIND_SLUG } from '@/lib/labor';
import type { WorkerKind } from '@/lib/api';

const MARK = 'tvl_worker_mark';
interface Mark { name: string; kind: WorkerKind; refreshedAt: string }

/** Ghi dấu nhẹ trên máy (chỉ tên gọi + mốc làm mới, không lưu SĐT/ngày sinh) để nhắc làm mới khi quay lại. */
export function markWorker(m: Mark) {
  try {
    localStorage.setItem(MARK, JSON.stringify({ ...m, name: m.name.trim().split(/\s+/).slice(-1)[0] }));
  } catch {
    /* bỏ qua */
  }
}

// Đợt 80 — nhắc làm mới ngay trên web (không SMS/email): thông tin quá 7 ngày chưa làm mới.
export function RefreshReminder() {
  const [m, setM] = useState<Mark | null>(null);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(MARK) ?? 'null') as Mark | null;
      if (v && Date.now() - +new Date(v.refreshedAt) > 7 * 864e5 && sessionStorage.getItem('tvl_rr_hide') !== '1') setM(v);
    } catch {
      /* bỏ qua */
    }
  }, []);
  if (!m) return null;
  const days = Math.floor((Date.now() - +new Date(m.refreshedAt)) / 864e5);
  return (
    <div className="rounded-xl border-2 border-warning bg-[#FFF4CC] px-3 py-2 flex flex-wrap items-center gap-2 text-[14px] text-ink" role="status">
      <span>
        Chào <b>{m.name}</b>, thông tin tìm việc của bạn đã <b>{days} ngày</b> chưa làm mới.{days >= 45 ? ' Hồ sơ đang bị xếp xuống cuối danh sách của nhà tuyển dụng.' : ' Làm mới để nhà tuyển dụng thấy bạn vẫn đang tìm việc.'}
      </span>
      <Link href={`/lao-dong-pho-thong?loai=${KIND_SLUG[m.kind] ?? 'cong-nhan'}`} className="rounded-lg bg-primary text-white font-bold text-[13.5px] px-3 py-1.5">Làm mới ngay</Link>
      <button
        type="button"
        onClick={() => {
          try {
            sessionStorage.setItem('tvl_rr_hide', '1');
          } catch {
            /* bỏ qua */
          }
          setM(null);
        }}
        className="text-[13px] font-bold text-ink-muted"
      >
        Để sau
      </button>
    </div>
  );
}
