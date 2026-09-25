'use client';

// Đợt 17h (25/09/2026) — phần JSX 4 bước (thanh bước, từng bước, nút Tiếp tục/Quay lại) đã tách
// sang component dùng chung `@/components/JobWizardForm` (JobWizardSteps) để Admin "Sửa tin" và
// Admin "Nguồn ngoài Cách 3" tái sử dụng NGUYÊN VẸN giao diện này (theo yêu cầu người dùng: 3 nơi
// tạo/sửa tin phải giống hệt nhau, lấy đúng trang "Đăng tin" NTD làm gốc). File này giờ chỉ còn
// phần RIÊNG của NTD: nạp dữ liệu khi sửa tin của chính mình (`?edit=<id>`), gọi employerApi, màn
// hình "Đã gửi/Đã lưu" — không đổi hành vi nghiệp vụ nào so với trước.
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import EmployerHeader from '@/components/EmployerHeader';
import { useAuth } from '@/lib/auth-context';
import { employerApi, ApiError, type WorkLocation } from '@/lib/api';
import { normalizeSalaryAmount } from '@/lib/format';
import { isRichTextEmpty } from '@/lib/richtext';
import { JobWizardSteps, JOB_WIZARD_INITIAL, type JobWizardFormState } from '@/components/JobWizardForm';
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, GENDER_OPTIONS, LEVELS } from '@/lib/catalogs';

// Đợt 12l (21/09/2026) — dùng chung wizard này cho cả "Đăng tin mới" và "Sửa tin" (nút Sửa ở trang
// Quản lý tin đăng dẫn tới đây kèm ?edit=<id>): khi có editId, nạp sẵn dữ liệu tin cũ vào form, đổi
// nhãn nút/thông báo cho phù hợp, và gọi updateJob() thay vì createJob() khi gửi.
function DangTinInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const { me, token } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<JobWizardFormState>(JOB_WIZARD_INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);
  // Đợt 12x (21/09/2026) — hiện lại lý do Admin từ chối (nếu có) ngay trên form Sửa tin, để NTD biết
  // chính xác cần sửa gì trước khi gửi duyệt lại. Không phải 1 field của FormState vì không gửi lại
  // lên server khi submit — chỉ đọc để hiển thị.
  const [rejectionInfo, setRejectionInfo] = useState<{ reasons: string[]; note?: string } | null>(null);
  // Đợt 12ac (24/09/2026) — "chọn từ địa điểm đã lưu" để autofill tỉnh/thành + quận/huyện + địa chỉ.
  const [savedLocations, setSavedLocations] = useState<WorkLocation[]>([]);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
    else if (me && !me.role.startsWith('employer')) router.replace('/');
  }, [me, router]);

  useEffect(() => {
    if (!token) return;
    employerApi.listWorkLocations(token).then(setSavedLocations).catch(() => setSavedLocations([]));
  }, [token]);

  useEffect(() => {
    if (!editId || !token) return;
    setLoadingEdit(true);
    employerApi
      .getJob(token, editId)
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
        if (job.rejectionReasons && job.rejectionReasons.length > 0) {
          setRejectionInfo({ reasons: job.rejectionReasons, note: job.rejectionNote });
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không thể tải tin để sửa'))
      .finally(() => setLoadingEdit(false));
  }, [editId, token]);

  if (!me || !me.role.startsWith('employer')) return null;

  if (loadingEdit) {
    return (
      <main className="min-h-screen bg-bg">
        <EmployerHeader />
        <div className="max-w-2xl mx-auto px-4 py-24 text-center text-ink-faint text-sm">Đang tải tin để sửa...</div>
      </main>
    );
  }

  async function handleSubmit() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    // Đợt 12l — khi sửa tin, salaryMin/salaryMax gửi `null` (thay vì bỏ qua) lúc bật "Thoả thuận",
    // để backend biết cần XOÁ giá trị cũ chứ không phải giữ nguyên (xem updateJob() ở employer.service.ts).
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
      // triệu), không đổi ở ô nhập để không phá luồng gõ số của người dùng. Xem normalizeSalaryAmount().
      salaryMin: form.negotiable || !form.salaryMin ? (editId ? null : undefined) : normalizeSalaryAmount(Number(form.salaryMin)),
      salaryMax: form.negotiable || !form.salaryMax ? (editId ? null : undefined) : normalizeSalaryAmount(Number(form.salaryMax)),
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
      if (editId) await employerApi.updateJob(token, editId, payload);
      else await employerApi.createJob(token, payload);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : editId
            ? 'Không thể lưu thay đổi, vui lòng thử lại'
            : 'Không thể đăng tin, vui lòng thử lại',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-bg">
        <EmployerHeader />
        <div className="max-w-lg mx-auto px-4 py-24 text-center flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-success-tint text-success flex items-center justify-center text-2xl">✓</div>
          <h1 className="font-extrabold text-lg">{editId ? 'Đã lưu thay đổi!' : 'Đã gửi tin để duyệt!'}</h1>
          <p className="text-sm text-ink-faint">
            {editId
              ? `Thay đổi cho tin "${form.title}" đã được lưu và gửi lại cho Admin xét duyệt. Tin sẽ hiển thị lại trong tìm kiếm việc làm ngay sau khi được duyệt (thường trong vòng 24 giờ).`
              : `Tin tuyển dụng "${form.title}" đã được gửi cho Admin xét duyệt. Tin sẽ hiển thị trong tìm kiếm việc làm ngay sau khi được duyệt (thường trong vòng 24 giờ).`}
          </p>
          {/* Đợt 12e (21/09/2026) — chia sẻ Facebook: link công khai chỉ xem được sau khi Admin
              duyệt, nên chưa mở popup chia sẻ ngay ở đây (link sẽ báo "không tìm thấy") — hướng
              NTD quay lại trang Quản lý tin đăng để chia sẻ khi tin đã thật sự "Đang đăng". */}
          <p className="text-xs text-info bg-info-tint rounded-lg px-3.5 py-2.5">
            📣 Sau khi tin được duyệt, vào{' '}
            <Link href="/nha-tuyen-dung/tin-dang" className="font-bold underline">
              Quản lý tin đăng
            </Link>{' '}
            để chia sẻ tin lên Facebook cá nhân — giúp tiếp cận thêm nhiều ứng viên.
          </p>
          <div className="flex gap-3 mt-2">
            {!editId && (
              <button className="tvl-btn-ghost !w-auto px-5" onClick={() => { setForm(JOB_WIZARD_INITIAL); setStep(0); setSuccess(false); }}>
                Đăng tin khác
              </button>
            )}
            <button
              className="tvl-btn-primary !w-auto px-5"
              onClick={() => router.push(editId ? '/nha-tuyen-dung/tin-dang' : '/nha-tuyen-dung/dashboard')}
            >
              {editId ? 'Về Quản lý tin đăng' : 'Về Dashboard'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg">
      <EmployerHeader />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <JobWizardSteps
          form={form}
          setForm={setForm}
          step={step}
          setStep={setStep}
          error={error}
          submitting={submitting}
          onSubmit={handleSubmit}
          submitLabel={editId ? 'Cập nhật tin đăng →' : 'Gửi đăng tin →'}
          previewNote={
            editId
              ? 'Kiểm tra lại thông tin ở 3 bước trước — sau khi lưu, tin sẽ quay về trạng thái chờ Admin duyệt lại trước khi hiển thị trong tìm kiếm việc làm.'
              : 'Kiểm tra lại thông tin ở 3 bước trước — sau khi gửi, tin sẽ chờ Admin duyệt trước khi hiển thị trong tìm kiếm việc làm.'
          }
          savedLocations={savedLocations}
          onPickSavedLocation={(loc) => setForm({ ...form, provinces: [loc.province], district: loc.district ?? '', address: loc.address ?? '' })}
          rejectionInfo={rejectionInfo}
        />
      </div>
    </main>
  );
}

export default function DangTinPage() {
  return (
    <Suspense fallback={null}>
      <DangTinInner />
    </Suspense>
  );
}
