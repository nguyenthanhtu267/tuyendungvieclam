'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/SmartLink';
import { jobsApi, type JobPosting } from '@/lib/api';
import { formatSalaryTag } from '@/lib/format';
import { RichTextView } from '@/components/RichTextView';
import { CompanyLogo } from '@/components/CompanyLogo';

// Đợt 107 — "Xem nhanh" (máy tính bảng ngang / màn hình ≥1024px): bấm 1 tin ở danh sách → chi tiết rút gọn hiện ngay cột bên phải, không rời trang
// danh sách. Bấm ✕ (hoặc Esc) để quay lại thanh bên cũ. Chỉ tải khi chọn tin.
export default function JobQuickView({ jobId, onClose, sheet = false }: { jobId: string; onClose: () => void; sheet?: boolean }) {
  const [job, setJob] = useState<JobPosting | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setJob(undefined);
    jobsApi
      .get(jobId)
      .then((r) => alive && setJob(r.job))
      .catch(() => alive && setJob(null));
    return () => {
      alive = false;
    };
  }, [jobId]);
  return (
    <aside className={sheet ? 'bg-white max-h-[85vh] overflow-y-auto' : 'rounded-xl border border-border bg-white lg:sticky lg:top-14 max-h-[calc(100vh-72px)] overflow-y-auto'} aria-label="Xem nhanh tin tuyển dụng">
      <div className="sticky top-0 z-10 bg-white border-b border-border px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-bold text-ink-muted">{sheet ? 'Xem nhanh' : 'Xem nhanh · phím J/K chuyển tin · Esc đóng'}</span>
        <button type="button" onClick={onClose} aria-label="Đóng xem nhanh" className="w-10 h-10 text-lg text-ink-faint">✕</button>
      </div>
      {job === undefined && <div className="p-4 text-sm text-ink-faint">Đang tải…</div>}
      {job === null && <div className="p-4 text-sm text-ink-muted">Không tải được tin này. Thử lại hoặc mở trang đầy đủ.</div>}
      {job && (
        <div className="p-3.5 flex flex-col gap-2.5">
          <div className="flex gap-3 items-start">
            <CompanyLogo name={job.company.name} logoUrl={job.company.logoUrl} size={56} className="text-base" hideIfEmpty />
            <div className="min-w-0">
              <div className="font-extrabold text-[16px] text-ink leading-snug">{job.title}</div>
              <Link href={`/cong-ty/${job.company.id}`} className="co-name text-[13px] hover:underline">{job.company.name}</Link>
            </div>
          </div>
          <div className="text-critical font-bold text-[14px]">$ {formatSalaryTag(job.salaryMin, job.salaryMax)}</div>
          <div className="text-[12.5px] text-ink-muted flex flex-wrap gap-x-3 gap-y-0.5">
            {(job.provinces?.length ? job.provinces.join(' | ') : job.location) && <span>📍 {job.provinces?.length ? job.provinces.join(' | ') : job.location}</span>}
            {job.employmentType && <span>💼 {job.employmentType}</span>}
            {job.experienceLevel && <span>🎖 {job.experienceLevel}</span>}
            {job.deadline && <span>⏳ Hạn nộp: {new Date(job.deadline).toLocaleDateString('vi-VN')}</span>}
          </div>
          <div className="flex gap-2">
            <Link href={`/viec-lam/${job.id}?apply=1`} className="flex-1 h-11 rounded-lg bg-accent text-white font-extrabold text-[14px] inline-flex items-center justify-center">⚡ Ứng tuyển</Link>
            <Link href={`/viec-lam/${job.id}`} className="flex-1 h-11 rounded-lg border border-primary text-primary font-bold text-[14px] inline-flex items-center justify-center">Xem đầy đủ →</Link>
          </div>
          {job.description && (
            <div>
              <div className="font-extrabold text-[13px] text-ink mb-1">Mô tả công việc</div>
              <RichTextView value={job.description} className="text-[13.5px] text-ink" />
            </div>
          )}
          {job.requirements && (
            <div>
              <div className="font-extrabold text-[13px] text-ink mb-1">Yêu cầu</div>
              <RichTextView value={job.requirements} listFallback className="text-[13.5px] text-ink" />
            </div>
          )}
          {job.benefits && (
            <div>
              <div className="font-extrabold text-[13px] text-ink mb-1">Quyền lợi</div>
              <RichTextView value={job.benefits} className="text-[13.5px] text-ink" />
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
