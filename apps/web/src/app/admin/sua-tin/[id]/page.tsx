'use client';

// Đợt 12x (21/09/2026) — "Sửa tin trước khi duyệt", theo yêu cầu người dùng: Admin xem tin (trang
// admin/xem-tin/[id]) thấy sai sót thì sửa luôn ở đây rồi quay lại bấm Duyệt, thay vì phải Từ chối
// và chờ NTD tự sửa gửi lại. Dùng lại đúng bộ trường của wizard "Đăng tin" NTD.
// Đợt 17h (25/09/2026) — theo yêu cầu người dùng ("3 giao diện phải giống hệt trang Đăng tin NTD"),
// trang này đổi từ "1 trang cuộn không chia bước" (quyết định cũ ở Đợt 12x, ưu tiên sửa nhanh) sang
// DÙNG CHUNG wizard 4 Bước y hệt `nha-tuyen-dung/dang-tin` (component `JobWizardSteps`). Đọc query
// `?step=N` để mở đúng bước cần sửa khi bấm nút "✏️ Sửa" theo khối ở trang Xem tin (Đợt 17f — nay
// đổi từ anchor-scroll sang chọn đúng bước, vì trang không còn cuộn liền 1 mạch nữa).
// Vẫn gọi PATCH /admin/jobs/:id (AdminService.adminUpdateJob) — khác EmployerService.updateJob() ở
// chỗ KHÔNG đổi approvalStatus (tin đang chờ duyệt vẫn chờ duyệt, Admin tự bấm "Duyệt" ở bước sau).
import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { adminApi, ApiError } from '@/lib/api';
import { isRichTextEmpty } from '@/lib/richtext';
import { normalizeSalaryAmount } from '@/lib/format';
import { JobWizardSteps, type JobWizardFormState } from '@/components/JobWizardForm';
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, GENDER_OPTIONS, LEVELS } from '@/lib/catalogs';

// Đợt 17h — `useSearchParams()` (đọc `?step=`) bắt buộc phải nằm trong <Suspense> ở Next.js App
// Router, giống hệt cách `nha-tuyen-dung/dang-tin/page.tsx` đã làm với `?edit=`.
function AdminSuaTinInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const [step, setStep] = useState(() => {
    const raw = Number(searchParams.get('step'));
    return Number.isFinite(raw) && raw >= 0 && raw <= 3 ? raw : 0;
  });
  const [form, setForm] = useState<JobWizardFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
  }, [me, router]);

  useEffect(() => {
    if (!token) return;
    adminApi
      .getJobForReview(token, params.id)
      .then((job) => {
        setForm({
          title: job.title ?? '',
          headcount: String(job.headcount ?? 1),
          industries: job.industry ? [job.industry] : [],
          level: job.level ?? LEVELS[2],
          employmentType: job.employmentType ?? EMPLOYMENT_TYPES[0],
          experienceLevel: job.experienceLevel ?? EXPERIENCE_LEVELS[3],
          provinces: job.provinces ?? [],
          district: job.district ?? '',
          address: job.address ?? '',
          gender: job.gender ?? GENDER_OPTIONS[0],
          ageRange: job.ageRange ?? '',
          workSchedule: job.workSchedule ?? '',
          isUrgent: job.isUrgent ?? false,
          salaryMin: job.salaryMin != null ? String(job.salaryMin) : '',
          salaryMax: job.salaryMax != null ? String(job.salaryMax) : '',
          negotiable: job.salaryMin == null && job.salaryMax == null,
          description: job.description ?? '',
          requirements: job.requirements ?? '',
          benefits: job.benefits ?? '',
          deadline: job.deadline ?? '',
          tags: job.tags ?? [],
          contactName: job.contactName ?? '',
          contactEmail: job.contactEmail ?? '',
          contactPhone: job.contactPhone ?? '',
          contactNote: job.contactNote ?? '',
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không thể tải tin để sửa'))
      .finally(() => setLoading(false));
  }, [token, params.id]);

  if (!me || (me.role !== 'admin' && me.role !== 'moderator')) return null;

  async function handleSubmit() {
    if (!token || !form) return;
    setSubmitting(true);
    setError(null);
    const payload = {
      title: form.title,
      industry: form.industries[0],
      location: form.provinces.length ? form.provinces.join(', ') : undefined,
      provinces: form.provinces.length ? form.provinces : undefined,
      district: form.district || undefined,
      address: form.address.trim() || undefined,
      gender: form.gender || undefined,
      ageRange: form.ageRange.trim() || undefined,
      workSchedule: form.workSchedule.trim() || undefined,
      experienceLevel: form.experienceLevel || undefined,
      isUrgent: form.isUrgent,
      // Đợt 17d — quy đổi lương ngay trước khi gửi (VD gõ nhầm 20000000 thay vì 20 → tự hiểu là 20
      // triệu). Xem normalizeSalaryAmount() ở lib/format.ts.
      salaryMin: form.negotiable || !form.salaryMin ? null : normalizeSalaryAmount(Number(form.salaryMin)),
      salaryMax: form.negotiable || !form.salaryMax ? null : normalizeSalaryAmount(Number(form.salaryMax)),
      employmentType: form.employmentType,
      level: form.level,
      headcount: Number(form.headcount) || 1,
      description: form.description || undefined,
      requirements: form.requirements || undefined,
      benefits: isRichTextEmpty(form.benefits) ? undefined : form.benefits,
      deadline: form.deadline || undefined,
      tags: form.tags.length ? form.tags : undefined,
      contactName: form.contactName.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      contactNote: isRichTextEmpty(form.contactNote) ? undefined : form.contactNote,
    };
    try {
      await adminApi.updateJob(token, params.id, payload);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể lưu thay đổi, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-primary-dark text-white px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
        <div className="font-bold text-sm">✎ Sửa tin tuyển dụng (chế độ Admin)</div>
        <Link href={`/admin/xem-tin/${params.id}`} className="text-xs font-semibold text-white/80 hover:text-white">
          ← Quay lại Xem tin
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="text-center text-ink-faint text-sm py-16">Đang tải…</div>
        ) : !form ? (
          <div className="text-center text-critical text-sm py-16">{error || 'Không tìm thấy tin tuyển dụng'}</div>
        ) : success ? (
          <div className="rounded-xl bg-white border border-border p-6 text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-success-tint text-success flex items-center justify-center text-2xl">✓</div>
            <h1 className="font-extrabold text-lg">Đã lưu thay đổi!</h1>
            <p className="text-sm text-ink-faint">
              Nội dung tin "{form.title}" đã được cập nhật. Tin vẫn đang ở trạng thái chờ duyệt — quay lại trang Xem tin để bấm "Duyệt tin này".
            </p>
            <Link href={`/admin/xem-tin/${params.id}`} className="tvl-btn-primary !w-auto px-5 mt-1">
              Quay lại Xem tin →
            </Link>
          </div>
        ) : (
          <JobWizardSteps
            form={form}
            setForm={(u) => setForm((f) => (f ? (typeof u === 'function' ? u(f) : u) : f) as JobWizardFormState)}
            step={step}
            setStep={setStep}
            error={error}
            submitting={submitting}
            onSubmit={handleSubmit}
            submitLabel="Lưu thay đổi →"
            previewNote='Kiểm tra lại thông tin ở 3 bước trước — Admin lưu KHÔNG làm đổi trạng thái duyệt của tin (tin đang chờ duyệt vẫn chờ duyệt, tin đã duyệt vẫn giữ đã duyệt). Bấm "← Quay lại Xem tin" để duyệt/từ chối sau khi sửa xong.'
          />
        )}
      </div>
    </main>
  );
}

export default function AdminSuaTinPage() {
  return (
    <Suspense fallback={null}>
      <AdminSuaTinInner />
    </Suspense>
  );
}
