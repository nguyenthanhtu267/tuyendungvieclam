'use client';

// Đợt 12i (21/09/2026) — trang Admin xem trước ĐÚNG nội dung đầy đủ của 1 tin tuyển dụng (kể cả
// tin CHƯA duyệt) trước khi bấm Duyệt/Từ chối, thay vì chỉ đọc vài dòng rút gọn trong bảng "Duyệt
// tin". Route công khai /viec-lam/{id} chỉ hiện tin ĐÃ duyệt nên không dùng lại được — trang này
// gọi API riêng /admin/jobs/:id (yêu cầu đăng nhập Admin). Đi kèm cảnh báo tự động nếu nội dung có
// link hoặc từ khoá nghi vấn (lừa đảo/đa cấp/thu phí) — chỉ để Admin tự đọc và quyết định, không
// tự động chặn.
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { RichTextView } from '@/components/RichTextView';
import { adminApi, ApiError, type JobPosting } from '@/lib/api';
import { formatDate, formatSalary } from '@/lib/format';
import { scanJobContent } from '@/lib/content-moderation';

export default function AdminJobReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { me, token } = useAuth();
  const [job, setJob] = useState<JobPosting | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
  }, [me, router]);

  useEffect(() => {
    if (!token) return;
    adminApi
      .getJobForReview(token, params.id)
      .then(setJob)
      .catch((err) => {
        setJob(null);
        setError(err instanceof ApiError ? err.message : 'Không tải được tin tuyển dụng');
      });
  }, [token, params.id]);

  async function handleDecision(decision: 'approve' | 'reject') {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      if (decision === 'approve') await adminApi.approveJob(token, params.id);
      else await adminApi.rejectJob(token, params.id);
      setDone(decision === 'approve' ? 'approved' : 'rejected');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể cập nhật trạng thái tin');
    } finally {
      setBusy(false);
    }
  }

  if (!me || (me.role !== 'admin' && me.role !== 'moderator')) return null;

  return (
    <main className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-primary-dark text-white px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
        <div className="font-bold text-sm">⚙ Xem trước tin tuyển dụng (chế độ Admin)</div>
        <Link href="/admin/dashboard" className="text-xs font-semibold text-white/80 hover:text-white">
          ← Quay lại Admin Console
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6">
        {job === undefined ? (
          <div className="text-center text-ink-faint text-sm py-16">Đang tải…</div>
        ) : job === null ? (
          <div className="text-center text-critical text-sm py-16">{error || 'Không tìm thấy tin tuyển dụng'}</div>
        ) : (
          <>
            {(() => {
              const scan = scanJobContent(job.title, job.description, job.requirements);
              return (scan.hasLink || scan.sensitiveHits.length > 0) ? (
                <div className="rounded-xl border border-critical/30 bg-critical-tint p-4 mb-4 text-[12.5px] text-critical flex flex-col gap-1.5">
                  <div className="font-bold">⚠ Cảnh báo tự động — đọc kỹ trước khi duyệt</div>
                  {scan.hasLink && <div>Phát hiện link trong nội dung: {scan.links.join(', ')}</div>}
                  {scan.sensitiveHits.length > 0 && (
                    <div>Từ khoá nghi vấn (lừa đảo/đa cấp/thu phí…): {scan.sensitiveHits.join(', ')}</div>
                  )}
                </div>
              ) : null;
            })()}

            <div className="rounded-xl border border-border bg-white p-5">
              <div className="text-[11px] font-bold text-ink-faint uppercase tracking-wide mb-1">
                {job.approvalStatus === 'pending' ? 'Đang chờ duyệt' : job.approvalStatus}
              </div>
              <h1 className="font-extrabold text-lg mb-1">{job.title}</h1>
              <div className="text-sm text-ink-muted font-semibold mb-4">{job.company?.name}</div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-[12.5px] mb-4">
                <Detail label="📍 Địa điểm" value={job.provinces?.length ? job.provinces.join(' | ') : job.location ?? '—'} />
                {job.district && <Detail label="🏙️ Quận/Huyện" value={job.district} />}
                <Detail label="🏷️ Ngành nghề" value={job.industry ?? '—'} />
                <Detail label="💼 Hình thức" value={job.employmentType ?? '—'} />
                <Detail label="💰 Lương" value={formatSalary(job.salaryMin, job.salaryMax)} />
                <Detail label="🎖️ Cấp bậc" value={job.level ?? '—'} />
                {job.experienceLevel && <Detail label="📊 Kinh nghiệm" value={job.experienceLevel} />}
                <Detail label="⏳ Hạn nộp" value={job.deadline ? formatDate(job.deadline) : '—'} />
                <Detail label="👥 Số lượng" value={String(job.headcount)} />
                <Detail label="🕒 Gửi lúc" value={formatDate(job.createdAt)} />
              </div>

              {job.benefits && job.benefits.length > 0 && (
                <div className="mb-4">
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
                <div className="mb-4">
                  <h3 className="font-bold text-sm mb-2">Mô tả công việc</h3>
                  <RichTextView value={job.description} className="text-[12.8px] text-ink-muted" />
                </div>
              )}

              {job.requirements && (
                <div>
                  <h3 className="font-bold text-sm mb-2">Yêu cầu ứng viên</h3>
                  <RichTextView value={job.requirements} listFallback className="text-[12.8px] text-ink-muted leading-loose" />
                </div>
              )}
            </div>

            {error && <div className="text-critical text-xs font-semibold mt-3">{error}</div>}

            {done ? (
              <div className="mt-4 rounded-xl border border-success/30 bg-success-tint text-success text-sm font-semibold p-4">
                Đã {done === 'approved' ? 'DUYỆT' : 'TỪ CHỐI'} tin này. Bạn có thể đóng tab hoặc{' '}
                <Link href="/admin/dashboard" className="underline">
                  quay lại danh sách
                </Link>
                .
              </div>
            ) : (
              job.approvalStatus === 'pending' && (
                <div className="flex gap-2.5 mt-4">
                  <button
                    disabled={busy}
                    onClick={() => handleDecision('approve')}
                    className="tvl-btn-primary !w-auto px-5 disabled:opacity-50"
                  >
                    Duyệt tin này
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleDecision('reject')}
                    className="tvl-btn-ghost !w-auto px-5 disabled:opacity-50"
                  >
                    Từ chối
                  </button>
                </div>
              )
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-ink-faint text-[11px] mb-0.5">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
