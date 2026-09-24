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
import { JOB_REJECTION_REASONS } from '@/lib/catalogs';

export default function AdminJobReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { me, token } = useAuth();
  const [job, setJob] = useState<JobPosting | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null);
  // Đợt 12x (21/09/2026) — "Bắt buộc nhập lý do khi Từ chối": mở modal chọn lý do (checklist cố
  // định, danh mục dùng chung với NTD xem lại — JOB_REJECTION_REASONS ở catalogs.ts) thay vì từ chối
  // ngay khi bấm nút, kèm ghi chú tự do không bắt buộc.
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReasons, setRejectReasons] = useState<string[]>([]);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectError, setRejectError] = useState('');

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

  async function handleApprove() {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await adminApi.approveJob(token, params.id);
      setDone('approved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể cập nhật trạng thái tin');
    } finally {
      setBusy(false);
    }
  }

  function toggleReason(reason: string) {
    setRejectReasons((cur) => (cur.includes(reason) ? cur.filter((r) => r !== reason) : [...cur, reason]));
  }

  async function handleReject() {
    if (!token) return;
    if (rejectReasons.length === 0) {
      setRejectError('Vui lòng chọn ít nhất 1 lý do từ chối');
      return;
    }
    setBusy(true);
    setRejectError('');
    try {
      await adminApi.rejectJob(token, params.id, { reasons: rejectReasons, note: rejectNote.trim() || undefined });
      setShowRejectModal(false);
      setDone('rejected');
    } catch (err) {
      setRejectError(err instanceof ApiError ? err.message : 'Không thể từ chối tin');
    } finally {
      setBusy(false);
    }
  }

  if (!me || (me.role !== 'admin' && me.role !== 'moderator')) return null;

  return (
    <main className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-primary-dark text-white px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
        <div className="font-bold text-sm">⚙ Xem trước tin tuyển dụng (chế độ Admin)</div>
        <div className="flex items-center gap-4">
          {/* Đợt 12x (21/09/2026) — "Sửa tin trước khi duyệt": Admin thấy sai sót thì sửa luôn ở
              đây thay vì phải Từ chối rồi chờ NTD tự sửa gửi lại. */}
          {job && !done && (
            <Link href={`/admin/sua-tin/${params.id}`} className="text-xs font-semibold text-white/80 hover:text-white">
              ✎ Sửa tin
            </Link>
          )}
          <Link href="/admin/dashboard" className="text-xs font-semibold text-white/80 hover:text-white">
            ← Quay lại Admin Console
          </Link>
        </div>
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
                <div className={job.tags && job.tags.length > 0 ? 'mb-4' : ''}>
                  <h3 className="font-bold text-sm mb-2">Yêu cầu ứng viên</h3>
                  <RichTextView value={job.requirements} listFallback className="text-[12.8px] text-ink-muted leading-loose" />
                </div>
              )}

              {job.tags && job.tags.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-primary uppercase tracking-wide mb-2">Job tags / Skills</div>
                  <div className="flex flex-wrap gap-1.5">
                    {job.tags.map((t) => (
                      <span key={t} className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-surface-alt text-ink-muted">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Đợt 12x (21/09/2026) — nếu tin này TỪNG bị Admin (có thể là lần trước) từ chối và NTD
                gửi lại, cho Admin xem lại lý do cũ để biết NTD đã sửa đúng chỗ hay chưa. */}
            {job.rejectionReasons && job.rejectionReasons.length > 0 && (
              <div className="mt-4 rounded-xl border border-warning/30 bg-warning-tint p-4 text-[12.5px] text-ink">
                <div className="font-bold text-warning mb-1.5">Lý do bị từ chối lần trước</div>
                <ul className="list-disc pl-5 text-ink-muted leading-relaxed">
                  {job.rejectionReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {job.rejectionNote && <div className="mt-1.5 text-ink-muted">Ghi chú: {job.rejectionNote}</div>}
              </div>
            )}

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
                    onClick={handleApprove}
                    className="tvl-btn-primary !w-auto px-5 disabled:opacity-50"
                  >
                    Duyệt tin này
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setShowRejectModal(true)}
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

      {/* Đợt 12x (21/09/2026) — modal "Bắt buộc nhập lý do khi Từ chối": chọn ≥1 lý do từ checklist
          cố định + ghi chú tự do không bắt buộc. */}
      {showRejectModal && (
        <div className="fixed inset-0 z-20 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 max-h-[85vh] overflow-y-auto">
            <div className="font-extrabold text-sm mb-1">Từ chối tin tuyển dụng</div>
            <div className="text-[12px] text-ink-faint mb-3">
              Chọn ít nhất 1 lý do — NTD sẽ thấy để sửa lại đúng chỗ trước khi gửi duyệt lại.
            </div>
            <div className="flex flex-col gap-2 mb-3">
              {JOB_REJECTION_REASONS.map((r) => (
                <label key={r} className="flex items-start gap-2 text-[12.5px] text-ink-muted cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary mt-0.5"
                    checked={rejectReasons.includes(r)}
                    onChange={() => toggleReason(r)}
                  />
                  {r}
                </label>
              ))}
            </div>
            <label className="flex flex-col gap-1.5 mb-3">
              <span className="text-xs font-bold text-ink">Ghi chú thêm (không bắt buộc)</span>
              <textarea
                className="tvl-input text-[12.5px] min-h-[70px]"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="VD: mô tả công việc mục 3 chưa rõ đầu việc cụ thể..."
              />
            </label>
            {rejectError && <div className="text-critical text-[11.5px] font-semibold mb-3">{rejectError}</div>}
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectError('');
                }}
                className="tvl-btn-ghost !w-auto px-4 disabled:opacity-50"
              >
                Huỷ
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleReject}
                className="tvl-btn-accent !w-auto px-4 disabled:opacity-50"
              >
                {busy ? 'Đang gửi…' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
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
