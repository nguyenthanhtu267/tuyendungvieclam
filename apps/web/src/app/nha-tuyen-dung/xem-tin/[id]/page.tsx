'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import EmployerHeader from '@/components/EmployerHeader';
import { useAuth } from '@/lib/auth-context';
import { employerApi, ApiError, type JobPosting } from '@/lib/api';
import {
  formatDate,
  formatSalaryTag,
  jobAddressDisplay,
  jobAgeRangeDisplay,
  jobGenderDisplay,
  jobWorkScheduleDisplay,
} from '@/lib/format';

// Đợt 12l (21/09/2026) — trang xem trước tin cho NTD ("Xem trước" ở Quản lý tin đăng, mở tab mới):
// hiện tin ĐÚNG NHƯ ứng viên sẽ thấy (bố cục giống /viec-lam/[id]), nhưng hoạt động với MỌI trạng
// thái (chờ duyệt/tạm ngưng/hết hạn...) vì dùng GET employer/jobs/:id (chỉ chủ tin xem được), khác
// trang công khai chỉ hiện tin đã APPROVED && !isPaused. Không có nút Lưu tin/Ứng tuyển — chỉ để NTD
// kiểm tra nội dung + có nút "Sửa tin này" đi thẳng tới wizard sửa tin.
const STATUS_LABEL: Record<string, string> = {
  draft: 'Bản nháp',
  pending: 'Đang chờ Admin duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
  expired: 'Đã hết hạn',
};

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-ink-faint/10 text-ink-faint',
  pending: 'bg-warning-tint text-warning',
  approved: 'bg-success-tint text-success',
  rejected: 'bg-critical-tint text-critical',
  expired: 'bg-ink-faint/10 text-ink-faint',
};

export default function XemTinNtdPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { me, token } = useAuth();
  const [job, setJob] = useState<JobPosting | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
    else if (me && !me.role.startsWith('employer')) router.replace('/');
  }, [me, router]);

  useEffect(() => {
    if (!token) return;
    employerApi
      .getJob(token, params.id)
      .then(setJob)
      .catch((err) => {
        setJob(null);
        setError(err instanceof ApiError ? err.message : 'Không thể tải tin tuyển dụng');
      });
  }, [token, params.id]);

  if (!me || !me.role.startsWith('employer')) return null;

  if (job === undefined) {
    return (
      <main className="min-h-screen">
        <EmployerHeader />
        <div className="max-w-6xl mx-auto px-4 py-16 text-center text-ink-faint text-sm">Đang tải...</div>
      </main>
    );
  }

  if (job === null) {
    return (
      <main className="min-h-screen">
        <EmployerHeader />
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <div className="text-ink-muted text-sm mb-3">{error ?? 'Không tìm thấy tin tuyển dụng này.'}</div>
          <Link href="/nha-tuyen-dung/tin-dang" className="text-primary font-semibold text-sm">
            ← Quay lại Quản lý tin đăng
          </Link>
        </div>
      </main>
    );
  }

  const statusKey = job.approvalStatus ?? 'pending';
  const locationText = job.provinces?.length ? job.provinces.join(' | ') : job.location;

  return (
    <main className="min-h-screen bg-bg">
      <EmployerHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6">
        <div className="rounded-xl bg-info-tint border border-info/30 px-4 py-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[12.5px] font-bold text-info">👁️ Xem trước — đây là nội dung ứng viên sẽ thấy</span>
            <span className={`px-2 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${STATUS_CLASS[statusKey]}`}>
              {STATUS_LABEL[statusKey] ?? statusKey}
              {job.isPaused ? ' · Tạm ngưng' : ''}
            </span>
          </div>
          <div className="flex gap-2">
            <Link href={`/nha-tuyen-dung/dang-tin?edit=${job.id}`} className="tvl-btn-primary !w-auto px-4 text-xs">
              Sửa tin này
            </Link>
            <Link href="/nha-tuyen-dung/tin-dang" className="tvl-btn-ghost !w-auto px-4 text-xs">
              ← Quay lại
            </Link>
          </div>
        </div>

        <div className="rounded-2xl bg-primary p-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-white text-xl font-extrabold flex items-center gap-2 flex-wrap">
              {job.title}
              {job.isUrgent && (
                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-white/20 text-white align-middle">
                  KHẨN CẤP
                </span>
              )}
            </div>
            <div className="text-white/75 text-[13px] mt-1">{job.company.name}</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_280px] gap-5 mt-5 items-start">
          <div>
            <div className="rounded-xl border border-border bg-white p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-[12.5px]">
                <Detail label="📍 Địa điểm" value={locationText ?? '—'} />
                {job.district && <Detail label="🏙️ Quận/Huyện" value={job.district} />}
                <Detail label="🕒 Cập nhật" value={formatDate(job.updatedAt ?? job.createdAt)} />
                <Detail label="🏷️ Ngành nghề" value={job.industry ?? '—'} />
                <Detail label="💼 Hình thức" value={job.employmentType ?? '—'} />
                <Detail label="💰 Lương" value={formatSalaryTag(job.salaryMin, job.salaryMax)} />
                <Detail label="🎖️ Cấp bậc" value={job.level ?? '—'} />
                {job.experienceLevel && <Detail label="📊 Kinh nghiệm" value={job.experienceLevel} />}
                <Detail label="⏳ Hạn nộp" value={job.deadline ? formatDate(job.deadline) : '—'} />
                <Detail label="👥 Số lượng" value={String(job.headcount)} />
              </div>

              <div className="mt-5">
                <div className="text-xs font-bold text-primary uppercase tracking-wide mb-2">Địa điểm làm việc</div>
                <div className="text-[12.8px] font-bold text-ink">{locationText ?? 'Đang cập nhật'}</div>
                <div className="text-[12.5px] text-ink-muted mt-1 flex items-start gap-1.5">
                  <span>📍</span>
                  <span>{jobAddressDisplay(job.address, locationText)}</span>
                </div>
              </div>

              <div className="mt-5">
                <div className="text-xs font-bold text-primary uppercase tracking-wide mb-2">Thông tin khác</div>
                <ul className="text-[12.8px] text-ink-muted leading-loose list-disc pl-5">
                  <li>Giới tính: {jobGenderDisplay(job.gender)}</li>
                  <li>Độ tuổi: {jobAgeRangeDisplay(job.ageRange)}</li>
                  <li>Thời gian làm việc: {jobWorkScheduleDisplay(job.workSchedule)}</li>
                  <li>Lương: {formatSalaryTag(job.salaryMin, job.salaryMax)}</li>
                </ul>
              </div>

              {job.benefits && job.benefits.length > 0 && (
                <div className="mt-5">
                  <div className="text-xs font-bold text-primary uppercase tracking-wide mb-2">Phúc lợi</div>
                  <div className="flex flex-wrap gap-1.5">
                    {job.benefits.map((b) => (
                      <span key={b} className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-surface-alt text-ink-muted">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {job.description && (
                <div className="mt-5">
                  <h3 className="font-bold text-sm mb-2">Mô tả công việc</h3>
                  <p className="text-[12.8px] text-ink-muted leading-relaxed whitespace-pre-line">{job.description}</p>
                </div>
              )}

              {job.requirements && (
                <div className="mt-4">
                  <h3 className="font-bold text-sm mb-2">Yêu cầu ứng viên</h3>
                  <ul className="text-[12.8px] text-ink-muted leading-loose list-disc pl-5">
                    {job.requirements.split('\n').filter(Boolean).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            <div className="rounded-xl border border-border bg-white p-4 text-[12.5px] text-ink-muted">
              <div className="font-bold text-ink text-sm mb-1.5">{job.company.name}</div>
              <div>Mã số thuế: {job.company.taxCode}</div>
              {job.company.industry && <div>Lĩnh vực: {job.company.industry}</div>}
              {job.company.size && <div>Quy mô: {job.company.size}</div>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-ink-faint text-[11px]">{label}</div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}
