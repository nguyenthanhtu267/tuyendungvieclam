'use client';

import { useEffect, useState } from 'react';
import type { JobPosting } from '@/lib/api';
import { agoText, listCachedJobs, togglePin } from '@/lib/offline-cache';
import { formatSalary } from '@/lib/format';
import { RichTextView } from '@/components/RichTextView';

// Đợt 110 — "Tin trong máy": khi mất mạng/mạng quá yếu, đọc lại các tin đã xem hoặc đã ghim ngay tại chỗ (không cần tải thêm gì).
const fold = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

export default function OfflineJobsPanel({ initialQuery = '' }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [rows, setRows] = useState<ReturnType<typeof listCachedJobs<JobPosting>>>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setRows(listCachedJobs<JobPosting>()), []);
  if (!rows.length) return <div className="rounded-xl border border-border bg-white p-3 text-[13px] text-ink-muted">📂 Chưa có tin nào trong máy. Mở xem một vài tin (hoặc bấm 📌 Lưu offline) rồi quay lại đây.</div>;
  const fq = fold(q.trim());
  const shown = fq ? rows.filter((r) => fold(`${r.job.title} ${r.job.company?.name ?? ''} ${(r.job.provinces ?? []).join(' ')} ${r.job.industry ?? ''}`).includes(fq)) : rows;
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <div className="font-extrabold text-[14px] mb-2">📂 Tin trong máy bạn (đọc được khi không có mạng)</div>
      <input id="offline-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm trong tin đã lưu: chức danh, công ty, tỉnh…" className="tvl-input mb-2" />
      {!shown.length && <div className="text-[13px] text-ink-muted py-2">Không có tin nào khớp trong máy.</div>}
      <ul className="flex flex-col divide-y divide-border">
        {shown.map((r) => (
          <li key={r.id} className="py-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className="flex-1 text-left min-w-0">
                <div className="font-bold text-[14px] truncate">{r.pinned ? '📌 ' : ''}{r.job.title}</div>
                <div className="text-[12.5px] text-ink-muted truncate">{r.job.company?.name} · {formatSalary(r.job.salaryMin, r.job.salaryMax)} · lưu {agoText(r.at)}</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  togglePin(r.id);
                  setRows(listCachedJobs<JobPosting>());
                }}
                className="text-[12px] font-bold text-primary px-2 py-1"
              >
                {r.pinned ? 'Bỏ ghim' : 'Ghim'}
              </button>
            </div>
            {open === r.id && (
              <div className="mt-2 rounded-lg bg-[#F7F9FC] p-3 text-[13.5px] flex flex-col gap-2">
                <div>📍 {(r.job.provinces ?? []).join(', ')}{r.job.district ? ` · ${r.job.district}` : ''}</div>
                {r.job.description && <div><b>Mô tả</b><RichTextView value={r.job.description} /></div>}
                {r.job.requirements && <div><b>Yêu cầu</b><RichTextView value={r.job.requirements} listFallback /></div>}
                {r.job.benefits && <div><b>Quyền lợi</b><RichTextView value={r.job.benefits} /></div>}
                {(r.job.contactPhone || r.job.contactEmail) && <div>📞 {r.job.contactName ?? ''} {r.job.contactPhone ?? ''} {r.job.contactEmail ?? ''}</div>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
