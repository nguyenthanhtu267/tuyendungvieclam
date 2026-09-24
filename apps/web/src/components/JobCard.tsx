'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { JobPosting } from '@/lib/api';
import { candidatesApi, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { benefitIcon } from '@/lib/benefit-icons';
import { formatDate, formatSalaryTag, isNewJob } from '@/lib/format';
import { CompanyLogo } from '@/components/CompanyLogo';

// Đợt 10 — thẻ việc làm theo mục 4 đặc tả: tiêu đề đậm + badge (MỚI) chữ đỏ trong ngoặc (không phải
// pill), dòng lương đỏ, nhiều tỉnh ngăn bởi "|", hạn nộp/cập nhật, tag phúc lợi có icon, nút đỏ
// "ỨNG TUYỂN NGAY" + icon tim lưu việc.
export function JobCard({
  job,
  saved,
  onToggleSaved,
}: {
  job: JobPosting;
  saved?: boolean;
  onToggleSaved?: (jobId: string, nowSaved: boolean) => void;
}) {
  const router = useRouter();
  const { me, token } = useAuth();
  const [isSaved, setIsSaved] = useState(!!saved);
  const [busy, setBusy] = useState(false);

  const locationText = job.provinces?.length ? job.provinces.join(' | ') : job.location;

  async function handleToggleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!me || !token) {
      router.push('/dang-nhap');
      return;
    }
    setBusy(true);
    try {
      if (isSaved) {
        await candidatesApi.unsaveJob(token, job.id);
        setIsSaved(false);
        onToggleSaved?.(job.id, false);
      } else {
        await candidatesApi.saveJob(token, job.id);
        setIsSaved(true);
        onToggleSaved?.(job.id, true);
      }
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setBusy(false);
    }
  }

  function handleApplyNow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/viec-lam/${job.id}?apply=1`);
  }

  // Đợt 12aa (24/09/2026) — badge "URGENT" (tin khẩn cấp) thiết kế lại theo mẫu careerviet.vn: thẻ
  // nền hồng nhạt + viền hồng, badge có icon tia sét ⚡ và chữ tiếng Anh "URGENT" giống mẫu (thay
  // cho pill "KHẨN CẤP" nhỏ trước đây), để nổi bật hơn giữa danh sách tin thường.
  return (
    <Link
      href={`/viec-lam/${job.id}`}
      className={`relative flex gap-3 rounded-xl border p-4 transition-all ${
        job.isUrgent
          ? 'border-critical/30 bg-critical-tint/50 hover:border-critical hover:shadow-sm'
          : 'border-border bg-white hover:border-primary hover:shadow-sm'
      }`}
    >
      <button
        type="button"
        onClick={handleToggleSave}
        disabled={busy}
        aria-label={isSaved ? 'Bỏ lưu việc làm' : 'Lưu việc làm'}
        className={`absolute top-3 right-3 text-base leading-none ${isSaved ? 'text-critical' : 'text-ink-faint hover:text-critical'}`}
      >
        {isSaved ? '♥' : '♡'}
      </button>

      <CompanyLogo name={job.company.name} logoUrl={job.company.logoUrl} size={44} className="text-xs" />
      <div className="flex-1 min-w-0 pr-6">
        {job.isUrgent && (
          <div className="inline-flex items-center gap-1 mb-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-critical text-white tracking-wide">
            ⚡ URGENT
          </div>
        )}
        <div className="font-bold text-[13.5px] text-ink">
          {job.title}
          {isNewJob(job.createdAt) && <span className="text-critical font-extrabold ml-1.5">(MỚI)</span>}
        </div>
        <div className="text-xs text-ink-muted mt-0.5 truncate">{job.company.name}</div>

        <div className="text-critical font-bold text-[12.5px] mt-1.5">
          $ {formatSalaryTag(job.salaryMin, job.salaryMax)}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11.5px] text-ink-faint">
          {locationText && <span>📍 {locationText}</span>}
          {job.deadline && <span>Hạn nộp: {formatDate(job.deadline)}</span>}
          <span>Cập nhật: {formatDate(job.updatedAt ?? job.createdAt)}</span>
        </div>

        {job.benefits && job.benefits.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {job.benefits.slice(0, 3).map((b) => (
              <span
                key={b}
                className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface-alt text-ink-muted"
              >
                {benefitIcon(b)} {b}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2.5">
          <button
            type="button"
            onClick={handleApplyNow}
            className="inline-block bg-critical text-white text-[11.5px] font-extrabold tracking-wide rounded-lg px-4 py-1.5 hover:brightness-95"
          >
            ỨNG TUYỂN NGAY
          </button>
        </div>
      </div>
    </Link>
  );
}
