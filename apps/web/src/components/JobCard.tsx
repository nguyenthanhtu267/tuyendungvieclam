'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { JobPosting } from '@/lib/api';
import { candidatesApi, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { benefitIcon } from '@/lib/benefit-icons';
import { formatDate, formatSalaryTag, isNewJob } from '@/lib/format';
import { richTextListItems } from '@/lib/richtext';
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
  const benefitItems = richTextListItems(job.benefits, 3);

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
  // Đợt 14 (25/09/2026) — mục 13 danh sách lỗi: 2 thay đổi theo yêu cầu người dùng (không có ảnh
  // mẫu cụ thể, tự thiết kế theo mô tả bằng lời):
  //  1. Badge "URGENT" chuyển vào CÙNG dòng tiêu đề, ngay sau "(MỚI)" — trước đây là 1 khối riêng
  //     phía trên tiêu đề, tách biệt với "(MỚI)".
  //  2. Nút "ỨNG TUYỂN NGAY" to hơn, chuyển sang cột riêng bên PHẢI thẻ (căn giữa theo chiều dọc so
  //     với khối nội dung), thay vì nằm ở dòng cuối cùng bên dưới tag phúc lợi như trước. Dùng
  //     flex-wrap để tự động xuống dòng khi thẻ quá hẹp (vẫn giữ đúng bố cục ở lưới sm:grid-cols-2).
  return (
    <Link
      href={`/viec-lam/${job.id}`}
      className={`relative flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-xl border p-4 transition-all ${
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

      {/* Đợt 13 (24/09/2026) — mục 4 danh sách lỗi: logo công ty trên thẻ việc làm quá nhỏ so với
          các trang khác (chi tiết tin, trang công ty đều dùng size lớn hơn). Tăng 44→60px + cỡ chữ
          initials theo tỷ lệ để không bị vỡ layout khi công ty chưa có logoUrl. */}
      <CompanyLogo name={job.company.name} logoUrl={job.company.logoUrl} size={60} className="text-sm" />
      <div className="flex-1 min-w-0 pr-6">
        <div className="font-bold text-[13.5px] text-ink">
          {job.title}
          {isNewJob(job.createdAt) && <span className="text-critical font-extrabold ml-1.5">(MỚI)</span>}
          {job.isUrgent && (
            <span className="inline-flex items-center gap-1 ml-1.5 align-middle text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-critical text-white tracking-wide">
              ⚡ URGENT
            </span>
          )}
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

        {/* Đợt 14 (25/09/2026) — mục 15: `benefits` nay là rich text tự do (HTML), không còn mảng
            chip. richTextListItems() tách tối đa 3 "mục" ngắn (theo khối <li>/<p> nếu có, hoặc theo
            dấu phẩy cho dữ liệu cũ) để vẫn hiện dạng chip có icon như trước — chỉ đổi CÁCH LẤY dữ
            liệu, giao diện thẻ giữ nguyên. */}
        {benefitItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {benefitItems.map((b, i) => (
              <span
                key={i}
                className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface-alt text-ink-muted"
              >
                {benefitIcon(b)} {b}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
        <button
          type="button"
          onClick={handleApplyNow}
          className="w-full sm:w-auto bg-critical text-white text-[13px] font-extrabold tracking-wide rounded-lg px-6 py-2.5 hover:brightness-95"
        >
          ỨNG TUYỂN NGAY
        </button>
      </div>
    </Link>
  );
}
