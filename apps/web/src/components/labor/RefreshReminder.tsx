'use client';

import Link from '@/components/SmartLink';
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
      const d = v ? (Date.now() - +new Date(v.refreshedAt)) / 864e5 : 0;
      // Đợt 84 — sinh viên/thực tập sinh: mùa nghỉ hè (T5–T6) và nghỉ Tết (T12–T1) lịch rảnh thay đổi ⇒ nhắc sớm hơn (sau 10 ngày)
      const mo = new Date().getMonth() + 1;
      const seasonal = !!v && v.kind !== 'worker' && [5, 6, 12, 1].includes(mo) && d > 10;
      if (v && (d > 7 || seasonal) && sessionStorage.getItem('tvl_rr_hide') !== '1') setM(v);
    } catch {
      /* bỏ qua */
    }
  }, []);
  if (!m) return null;
  const days = Math.floor((Date.now() - +new Date(m.refreshedAt)) / 864e5);
  const mo = new Date().getMonth() + 1;
  const season = m.kind !== 'worker' && [5, 6, 12, 1].includes(mo) ? (mo === 5 || mo === 6 ? 'Sắp nghỉ hè' : 'Sắp nghỉ Tết') : null;
  return (
    <div className="rounded-xl border-2 border-warning bg-[#FFF4CC] px-3 py-2 flex flex-wrap items-center gap-2 text-[14px] text-ink" role="status">
      <span>
        Chào <b>{m.name}</b>, thông tin tìm việc của bạn đã <b>{days} ngày</b> chưa làm mới.{days >= 45 ? ' Hồ sơ đang bị xếp xuống cuối danh sách của nhà tuyển dụng.' : season ? ` ${season} — lịch rảnh và ngày bắt đầu của bạn có thể đã đổi, hãy cập nhật để nhà tuyển dụng xếp ca đúng.` : ' Làm mới để nhà tuyển dụng thấy bạn vẫn đang tìm việc.'}
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
