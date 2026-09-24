'use client';

// Đợt 12x (21/09/2026) — "Sửa tin trước khi duyệt", theo yêu cầu người dùng: Admin xem tin (trang
// admin/xem-tin/[id]) thấy sai sót thì sửa luôn ở đây rồi quay lại bấm Duyệt, thay vì phải Từ chối
// và chờ NTD tự sửa gửi lại. Dùng lại đúng bộ trường của wizard "Đăng tin" NTD (lựa chọn "Sửa toàn
// bộ như form NTD" người dùng chốt), nhưng trình bày thành 1 trang cuộn (không chia bước) — Admin
// chỉ cần sửa đúng vài chỗ sai rồi lưu ngay, không cần đi qua từng bước như NTD nhập tin lần đầu.
// Gọi PATCH /admin/jobs/:id (AdminService.adminUpdateJob) — khác EmployerService.updateJob() ở chỗ
// KHÔNG đổi approvalStatus (tin đang chờ duyệt vẫn chờ duyệt, Admin tự bấm "Duyệt" ở bước sau).
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { RichTextEditor } from '@/components/RichTextEditor';
import { ChipsInput } from '@/components/profile/ui';
import { MultiSelectPopover } from '@/components/search/MultiSelectPopover';
import { adminApi, ApiError } from '@/lib/api';
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  GENDER_OPTIONS,
  INDUSTRIES,
  LEVELS,
  PINNED_PROVINCES,
  PROVINCE_REGIONS,
} from '@/lib/catalogs';

const PROVINCE_GROUPS = [
  { label: undefined, options: PINNED_PROVINCES },
  ...PROVINCE_REGIONS.map((r) => ({ label: r.region, options: r.provinces })),
];
const INDUSTRY_GROUPS = [{ label: undefined, options: INDUSTRIES }];
const DISTRICT_SUPPORTED_PROVINCES = ['Hồ Chí Minh', 'Hà Nội'];
const BENEFIT_OPTIONS = ['Bảo hiểm sức khỏe', 'Thưởng KPI', 'Laptop', 'Du lịch hằng năm', 'Tăng lương định kỳ', 'Đào tạo chuyên môn'];

interface FormState {
  title: string;
  headcount: string;
  industries: string[];
  level: string;
  employmentType: string;
  experienceLevel: string;
  provinces: string[];
  district: string;
  address: string;
  gender: string;
  ageRange: string;
  workSchedule: string;
  isUrgent: boolean;
  salaryMin: string;
  salaryMax: string;
  negotiable: boolean;
  description: string;
  requirements: string;
  benefits: string[];
  deadline: string;
  tags: string[];
}

export default function AdminSuaTinPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { me, token } = useAuth();
  const [form, setForm] = useState<FormState | null>(null);
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
          benefits: job.benefits ?? [],
          deadline: job.deadline ?? '',
          tags: job.tags ?? [],
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không thể tải tin để sửa'))
      .finally(() => setLoading(false));
  }, [token, params.id]);

  if (!me || (me.role !== 'admin' && me.role !== 'moderator')) return null;

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

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
      salaryMin: form.negotiable || !form.salaryMin ? null : Number(form.salaryMin),
      salaryMax: form.negotiable || !form.salaryMax ? null : Number(form.salaryMax),
      employmentType: form.employmentType,
      level: form.level,
      headcount: Number(form.headcount) || 1,
      description: form.description || undefined,
      requirements: form.requirements || undefined,
      benefits: form.benefits.length ? form.benefits : undefined,
      deadline: form.deadline || undefined,
      tags: form.tags.length ? form.tags : undefined,
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
          <div className="rounded-xl bg-white border border-border p-6 flex flex-col gap-5">
            {error && <div className="rounded-lg bg-critical-tint text-critical text-sm px-3 py-2.5">{error}</div>}

            <h2 className="font-bold text-sm">Thông tin vị trí</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Chức danh">
                <input className="tvl-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
              <Field label="Số lượng tuyển">
                <input type="number" min={1} className="tvl-input" value={form.headcount} onChange={(e) => setForm({ ...form, headcount: e.target.value })} />
              </Field>
            </div>
            <Field label="Ngành nghề" hint="chọn tối đa 3">
              <MultiSelectPopover
                label="Ngành nghề"
                placeholder="Chọn ngành nghề"
                groups={INDUSTRY_GROUPS}
                selected={form.industries}
                onChange={(v) => setForm({ ...form, industries: v.slice(0, 3) })}
                emptyText="Vui lòng chọn ngành nghề"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cấp bậc">
                <select className="tvl-input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                  {LEVELS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Hình thức làm việc">
                <select className="tvl-input" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                  {EMPLOYMENT_TYPES.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kinh nghiệm làm việc">
                <select className="tvl-input" value={form.experienceLevel} onChange={(e) => setForm({ ...form, experienceLevel: e.target.value })}>
                  {EXPERIENCE_LEVELS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Việc làm khẩn cấp">
                <div className="flex items-center h-[42px]">
                  <Chip active={form.isUrgent} onClick={() => setForm({ ...form, isUrgent: !form.isUrgent })}>
                    {form.isUrgent ? '🔥 Khẩn cấp' : 'Đánh dấu khẩn cấp'}
                  </Chip>
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tỉnh, Thành Phố" hint="có thể chọn nhiều">
                <MultiSelectPopover
                  label="Tỉnh, Thành Phố"
                  placeholder="Chọn tỉnh, thành phố"
                  groups={PROVINCE_GROUPS}
                  selected={form.provinces}
                  onChange={(v) => setForm({ ...form, provinces: v, district: v.length === 1 ? form.district : '' })}
                  emptyText="Chọn địa điểm làm việc"
                />
              </Field>
              <Field label="Mức lương (triệu)">
                <div className="flex gap-2 items-center">
                  <input disabled={form.negotiable} className="tvl-input" placeholder="Từ" value={form.salaryMin} onChange={(e) => setForm({ ...form, salaryMin: e.target.value })} />
                  <input disabled={form.negotiable} className="tvl-input" placeholder="Đến" value={form.salaryMax} onChange={(e) => setForm({ ...form, salaryMax: e.target.value })} />
                  <Chip active={form.negotiable} onClick={() => setForm({ ...form, negotiable: !form.negotiable })}>
                    Thoả thuận
                  </Chip>
                </div>
              </Field>
            </div>
            {form.provinces.length === 1 && DISTRICT_SUPPORTED_PROVINCES.includes(form.provinces[0]) && (
              <Field label="Quận / Huyện" hint="không bắt buộc">
                <input className="tvl-input" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
              </Field>
            )}
            <Field label="Địa chỉ chi tiết" hint="không bắt buộc">
              <input className="tvl-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Giới tính">
                <select className="tvl-input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  {GENDER_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Độ tuổi" hint="không bắt buộc">
                <input className="tvl-input" value={form.ageRange} onChange={(e) => setForm({ ...form, ageRange: e.target.value })} />
              </Field>
            </div>
            <Field label="Thời gian làm việc" hint="không bắt buộc">
              <input className="tvl-input" value={form.workSchedule} onChange={(e) => setForm({ ...form, workSchedule: e.target.value })} />
            </Field>

            <h2 className="font-bold text-sm border-t border-border pt-5">Mô tả & yêu cầu</h2>
            <Field label="Mô tả công việc">
              <RichTextEditor value={form.description} onChange={(html) => setForm({ ...form, description: html })} minHeight={200} />
            </Field>
            <Field label="Yêu cầu ứng viên">
              <RichTextEditor value={form.requirements} onChange={(html) => setForm({ ...form, requirements: html })} minHeight={200} />
            </Field>
            <Field label="Job tags / Kỹ năng (không bắt buộc)" hint="Nhập rồi Enter">
              <ChipsInput value={form.tags} onChange={(v) => setForm({ ...form, tags: v })} placeholder="Nhập rồi Enter" />
            </Field>

            <h2 className="font-bold text-sm border-t border-border pt-5">Phúc lợi & hạn nộp</h2>
            <Field label="Phúc lợi">
              <div className="flex flex-wrap gap-2">
                {BENEFIT_OPTIONS.map((opt) => (
                  <Chip key={opt} active={form.benefits.includes(opt)} onClick={() => setForm({ ...form, benefits: toggle(form.benefits, opt) })}>
                    {opt}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="Hạn nộp hồ sơ">
              <input type="date" className="tvl-input" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </Field>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Link href={`/admin/xem-tin/${params.id}`} className="tvl-btn-ghost !w-auto px-4">
                Huỷ
              </Link>
              <button type="button" disabled={submitting} onClick={handleSubmit} className="tvl-btn-primary !w-auto px-5 disabled:opacity-50">
                {submitting ? 'Đang lưu…' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-ink">
        {label} {hint && <span className="font-normal text-ink-faint">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
        active ? 'bg-primary text-white border-primary' : 'bg-white text-ink-muted border-border-strong hover:border-primary'
      }`}
    >
      {children}
    </button>
  );
}
