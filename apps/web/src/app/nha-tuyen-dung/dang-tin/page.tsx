'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import EmployerHeader from '@/components/EmployerHeader';
import { RichTextEditor } from '@/components/RichTextEditor';
import { useAuth } from '@/lib/auth-context';
import { employerApi, ApiError, type WorkLocation } from '@/lib/api';
import { formatSalary } from '@/lib/format';
import { isRichTextEmpty, richTextListItems } from '@/lib/richtext';
import { MultiSelectPopover } from '@/components/search/MultiSelectPopover';
import { ChipsInput } from '@/components/profile/ui';
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  GENDER_OPTIONS,
  INDUSTRIES,
  LEVELS,
  PINNED_PROVINCES,
  PROVINCE_REGIONS,
} from '@/lib/catalogs';

const STEPS = ['Thông tin vị trí', 'Mô tả & yêu cầu', 'Hạn nộp hồ sơ', 'Xem trước & gửi'];
// Đợt 10 — dùng chung danh mục ngành nghề/cấp bậc/hình thức việc làm/kinh nghiệm với thanh lọc tìm
// việc (lib/catalogs.ts) để tin đăng khớp đúng giá trị mà FilterBar lọc theo (job.level = ... v.v).
const PROVINCE_GROUPS = [
  { label: undefined, options: PINNED_PROVINCES },
  ...PROVINCE_REGIONS.map((r) => ({ label: r.region, options: r.provinces })),
];
const INDUSTRY_GROUPS = [{ label: undefined, options: INDUSTRIES }];
// Quận/huyện hiện chỉ có dữ liệu mẫu cho Hồ Chí Minh — chỉ hiện ô nhập quận khi chọn tỉnh có hỗ trợ.
const DISTRICT_SUPPORTED_PROVINCES = ['Hồ Chí Minh', 'Hà Nội'];
// Đợt 13 (24/09/2026) — "Quyền lợi được hưởng" trước đây chỉ chọn từ 6 lựa chọn dựng sẵn
// (BENEFIT_OPTIONS), theo yêu cầu người dùng đổi thành nhập tự do không giới hạn (giống ô "Job
// tags" đã có) để NTD ghi đúng quyền lợi thực tế của công ty mình, không bị bó buộc. Icon hiển thị
// (benefit-icons.ts) vốn đã khớp theo từ khoá trong chuỗi bất kỳ nên không cần đổi gì thêm ở phần
// hiển thị (JobCard/trang chi tiết tin/trang xem trước) — chỉ đổi cách NHẬP LIỆU ở đây.
// Đợt 14 (25/09/2026) — mục 15: đổi tiếp từ ChipsInput (mảng chip) sang RichTextEditor (rich text tự
// do, giống ô "Yêu cầu ứng viên") theo yêu cầu người dùng. Các gợi ý nhanh bên dưới giờ bấm vào sẽ
// CHÈN THÊM 1 đoạn <p> vào cuối nội dung đang có, thay vì thêm 1 phần tử vào mảng.
const BENEFIT_SUGGESTIONS = ['Bảo hiểm sức khỏe', 'Thưởng KPI', 'Laptop', 'Du lịch hằng năm', 'Tăng lương định kỳ', 'Đào tạo chuyên môn'];

function appendRichTextSuggestion(current: string, suggestion: string): string {
  const clean = isRichTextEmpty(current) ? '' : current;
  return `${clean}<p>${suggestion}</p>`;
}

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
  // Đợt 14 (25/09/2026) — mục 15: rich text tự do (HTML), không còn mảng chip.
  benefits: string;
  deadline: string;
  // Đợt 12v (21/09/2026) — "JOB TAGS / SKILLS": thẻ từ khoá/kỹ năng NTD tự nhập tự do (VD "Tiktokshop
  // Specialist", "Admin E-commerce"), hiển thị dạng chip ở trang chi tiết tin.
  tags: string[];
  // Đợt 12aa (24/09/2026) — "Thông tin liên hệ" (không bắt buộc), theo mẫu careerviet.vn.
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  // Đợt 14 (25/09/2026) — mục 15: ghi chú liên hệ tự do (rich text), song song với 3 trường có cấu
  // trúc ở trên để vẫn giữ link tự động mailto:/tel:.
  contactNote: string;
}

const INITIAL: FormState = {
  title: '',
  headcount: '1',
  industries: [],
  level: LEVELS[2],
  employmentType: EMPLOYMENT_TYPES[0],
  experienceLevel: EXPERIENCE_LEVELS[3],
  provinces: [],
  district: '',
  address: '',
  gender: GENDER_OPTIONS[0],
  ageRange: '',
  workSchedule: '',
  isUrgent: false,
  salaryMin: '',
  salaryMax: '',
  negotiable: false,
  description: '',
  requirements: '',
  benefits: '',
  deadline: '',
  tags: [],
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  contactNote: '',
};

// Đợt 12l (21/09/2026) — dùng chung wizard này cho cả "Đăng tin mới" và "Sửa tin" (nút Sửa ở trang
// Quản lý tin đăng dẫn tới đây kèm ?edit=<id>): khi có editId, nạp sẵn dữ liệu tin cũ vào form, đổi
// nhãn nút/thông báo cho phù hợp, và gọi updateJob() thay vì createJob() khi gửi.
function DangTinInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const { me, token } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
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

  function canProceed(): boolean {
    if (step === 0) return form.title.trim().length > 0;
    return true;
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
      salaryMin: form.negotiable || !form.salaryMin ? (editId ? null : undefined) : Number(form.salaryMin),
      salaryMax: form.negotiable || !form.salaryMax ? (editId ? null : undefined) : Number(form.salaryMax),
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
              <button className="tvl-btn-ghost !w-auto px-5" onClick={() => { setForm(INITIAL); setStep(0); setSuccess(false); }}>
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
        {/* Đợt 12x (21/09/2026) — "Bắt buộc nhập lý do khi Từ chối": hiện lại lý do Admin từ chối
            ngay trên form sửa, NTD biết chính xác cần sửa gì trước khi gửi duyệt lại. */}
        {rejectionInfo && (
          <div className="rounded-xl border border-critical/30 bg-critical-tint p-4 mb-5 text-[12.5px]">
            <div className="font-bold text-critical mb-1.5">Tin này đã bị từ chối — lý do:</div>
            <ul className="list-disc pl-5 text-ink-muted leading-relaxed">
              {rejectionInfo.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {rejectionInfo.note && <div className="mt-1.5 text-ink-muted">Ghi chú thêm: {rejectionInfo.note}</div>}
          </div>
        )}

        <div className="flex mb-6">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => i < step && setStep(i)}
              className="flex-1 flex flex-col items-center gap-1.5 text-center"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === step ? 'bg-primary text-white' : i < step ? 'bg-success text-white' : 'bg-surface-alt text-ink-faint'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <div className={`text-[11px] font-semibold ${i === step ? 'text-ink' : 'text-ink-faint'}`}>{label}</div>
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-white border border-border p-6 flex flex-col gap-5 min-h-[380px]">
          {error && <div className="rounded-lg bg-critical-tint text-critical text-sm px-3 py-2.5">{error}</div>}

          {step === 0 && (
            <>
              <h2 className="font-bold text-sm">Thông tin vị trí tuyển dụng</h2>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Chức danh">
                  <input className="tvl-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="VD: Nhân viên Kinh doanh B2B" />
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
              {savedLocations.length > 0 && (
                <Field label="Chọn nhanh từ địa điểm đã lưu" hint="không bắt buộc">
                  <select
                    className="tvl-input"
                    value=""
                    onChange={(e) => {
                      const loc = savedLocations.find((l) => l.id === e.target.value);
                      if (!loc) return;
                      setForm({ ...form, provinces: [loc.province], district: loc.district ?? '', address: loc.address ?? '' });
                    }}
                  >
                    <option value="">— Chọn địa điểm đã lưu ở trang Tài khoản —</option>
                    {savedLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.label} ({loc.province})
                      </option>
                    ))}
                  </select>
                </Field>
              )}
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
                  <input
                    className="tvl-input"
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                    placeholder="VD: Quận 1"
                  />
                </Field>
              )}
              {/* Đợt 12k (21/09/2026) — khối "Địa điểm làm việc" (địa chỉ chi tiết) và "Thông tin
                  khác" (Giới tính, Độ tuổi, Thời gian làm việc) hiện trên trang chi tiết tin, theo
                  mẫu careerviet.vn. Đều không bắt buộc. */}
              <Field label="Địa chỉ chi tiết" hint="không bắt buộc">
                <input
                  className="tvl-input"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="VD: KCN Lê Minh Xuân 3, Bình Chánh, Hồ Chí Minh"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Giới tính">
                  <select className="tvl-input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    {GENDER_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Độ tuổi" hint="không bắt buộc">
                  <input
                    className="tvl-input"
                    value={form.ageRange}
                    onChange={(e) => setForm({ ...form, ageRange: e.target.value })}
                    placeholder="VD: Không giới hạn tuổi, 22-35 tuổi"
                  />
                </Field>
              </div>
              <Field label="Thời gian làm việc" hint="không bắt buộc">
                <input
                  className="tvl-input"
                  value={form.workSchedule}
                  onChange={(e) => setForm({ ...form, workSchedule: e.target.value })}
                  placeholder="VD: Làm việc theo ca và hành chính"
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="font-bold text-sm">Mô tả & yêu cầu công việc</h2>
              {/* Đợt 12n (21/09/2026) — đổi từ <textarea> sang RichTextEditor: khung nhập rộng hơn,
                  kéo giãn chiều cao được, có Bold/Italic/Gạch chân/gạch đầu dòng/đánh số như Word —
                  theo góp ý người dùng "chỗ điền JD phải rất rộng ... thuận tiện nhập liệu". */}
              <Field label="Mô tả công việc">
                <RichTextEditor
                  value={form.description}
                  onChange={(html) => setForm({ ...form, description: html })}
                  placeholder="Mô tả các đầu việc chính..."
                  minHeight={220}
                />
              </Field>
              <Field label="Yêu cầu ứng viên">
                <RichTextEditor
                  value={form.requirements}
                  onChange={(html) => setForm({ ...form, requirements: html })}
                  placeholder="Yêu cầu về kinh nghiệm, kỹ năng..."
                  minHeight={220}
                />
              </Field>

              {/* Đợt 13 (24/09/2026) — "Quyền lợi được hưởng" chuyển từ bước "Phúc lợi & hạn nộp"
                  lên ngay sau "Yêu cầu ứng viên" (theo yêu cầu người dùng).
                  Đợt 14 (25/09/2026) — mục 15: đổi tiếp sang RichTextEditor (khung gõ tự do như Word,
                  giống ô "Yêu cầu ứng viên") thay vì ô chip — vẫn giữ gợi ý nhanh, bấm vào sẽ chèn
                  thêm 1 đoạn vào cuối nội dung đang nhập. */}
              <Field label="Quyền lợi được hưởng" hint="Gõ tự do, hoặc bấm gợi ý bên dưới để chèn thêm">
                <RichTextEditor
                  value={form.benefits}
                  onChange={(html) => setForm({ ...form, benefits: html })}
                  placeholder="VD: Bảo hiểm sức khỏe, thưởng KPI, laptop..."
                  minHeight={140}
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {BENEFIT_SUGGESTIONS.filter((opt) => !form.benefits.includes(opt)).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setForm({ ...form, benefits: appendRichTextSuggestion(form.benefits, opt) })}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface-alt text-ink-muted hover:bg-primary-tint hover:text-primary"
                    >
                      + {opt}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Đợt 12aa (24/09/2026) — "Thông tin liên hệ" (không bắt buộc), theo mẫu careerviet.vn:
                  ứng viên xem tin thấy được người/kênh liên hệ trực tiếp thay vì chỉ liên hệ qua nút
                  "Nộp đơn ứng tuyển". Bỏ trống hoàn toàn cũng được — trang chi tiết tin sẽ không hiện
                  khối này nếu tất cả các trường đều trống.
                  Đợt 14 (25/09/2026) — mục 15: thêm ô "Thông tin khác" (rich text tự do) bên cạnh 3
                  trường có cấu trúc, để NTD ghi chú thêm mà vẫn giữ link tự động mailto:/tel:.
                  Đợt 15 (25/09/2026) — theo yêu cầu người dùng, đổi thứ tự: "Thông tin khác" (ô rich
                  text) lên TRƯỚC, "Thông tin liên hệ" (3 trường có cấu trúc) xuống SAU — trước đó
                  đang ngược lại (Thông tin liên hệ trước, Thông tin khác sau). */}
              <div className="border-t border-border pt-4 flex flex-col gap-3">
                <Field label="Thông tin khác" hint="không bắt buộc — ghi chú tự do">
                  <RichTextEditor
                    value={form.contactNote}
                    onChange={(html) => setForm({ ...form, contactNote: html })}
                    placeholder="VD: Vui lòng ghi rõ tiêu đề email là 'Ứng tuyển [vị trí] - [Họ tên]'..."
                    minHeight={120}
                  />
                </Field>
                <h3 className="font-bold text-xs uppercase tracking-wide text-primary">
                  Thông tin liên hệ (không bắt buộc)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Người liên hệ">
                    <input
                      className="tvl-input"
                      value={form.contactName}
                      onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                      placeholder="VD: Phòng Nhân sự"
                    />
                  </Field>
                  <Field label="Số điện thoại liên hệ">
                    <input
                      className="tvl-input"
                      value={form.contactPhone}
                      onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                      placeholder="VD: 0901 234 567"
                    />
                  </Field>
                </div>
                <Field label="Email liên hệ">
                  <input
                    type="email"
                    className="tvl-input"
                    value={form.contactEmail}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    placeholder="VD: tuyendung@congty.vn"
                  />
                </Field>
              </div>

              {/* Đợt 12v (21/09/2026) — "JOB TAGS / SKILLS": thẻ từ khoá/kỹ năng tự nhập tự do (không
                  bắt buộc), hiển thị dạng chip ở trang chi tiết tin, dưới khối "Thông tin khác".
                  Đợt 14 (25/09/2026) — mục 15: chuyển xuống SAU "Thông tin liên hệ" (theo yêu cầu
                  người dùng, trước đây nằm giữa "Quyền lợi được hưởng" và "Thông tin liên hệ"). */}
              <Field label="Job tags / Kỹ năng (không bắt buộc)" hint="Nhập rồi Enter, VD: Tiktokshop Specialist">
                <ChipsInput value={form.tags} onChange={(v) => setForm({ ...form, tags: v })} placeholder="Nhập rồi Enter" />
              </Field>

              <div className="text-[11px] text-ink-faint">
                Ảnh/banner tin tuyển dụng: sẽ hỗ trợ ở bản cập nhật sau (khi kết nối lưu trữ tệp Cloudflare R2).
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-bold text-sm">Hạn nộp hồ sơ</h2>
              <Field label="Hạn nộp hồ sơ">
                <input type="date" className="tvl-input" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="font-bold text-sm">Xem trước tin tuyển dụng</h2>
              <div className="rounded-lg bg-surface-alt p-4">
                <div className="font-extrabold text-sm flex items-center gap-2 flex-wrap">
                  {form.title || '(Chưa nhập chức danh)'}
                  {form.isUrgent && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-critical-tint text-critical align-middle">
                      KHẨN CẤP
                    </span>
                  )}
                </div>
                <div className="text-xs text-ink-faint mt-1">
                  {form.provinces.length ? form.provinces.join(' | ') : 'Chưa rõ địa điểm'}
                  {form.district ? ` (${form.district})` : ''} ·{' '}
                  {form.negotiable ? 'Thoả thuận' : formatSalary(Number(form.salaryMin) || undefined, Number(form.salaryMax) || undefined)} · {form.employmentType} · {form.headcount} vị trí
                </div>
                {/* Đợt 14 (25/09/2026) — mục 15: `form.benefits` nay là rich text (HTML), không còn
                    mảng chip để spread trực tiếp — dùng richTextListItems() lấy tối đa 5 mục ngắn để
                    xem trước dạng chip như cũ. */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {[...form.industries, ...richTextListItems(form.benefits, 5)].map((tag, i) => (
                    <span key={`${tag}-${i}`} className="text-[11px] font-semibold bg-primary-tint text-primary rounded-full px-2.5 py-1">{tag}</span>
                  ))}
                </div>
                {form.tags.length > 0 && (
                  <div className="mt-2.5">
                    <div className="text-[10.5px] font-bold text-ink-faint uppercase tracking-wide mb-1">Job tags / Skills</div>
                    <div className="flex flex-wrap gap-1.5">
                      {form.tags.map((tag) => (
                        <span key={tag} className="text-[11px] font-semibold bg-surface-alt text-ink-muted rounded-full px-2.5 py-1">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                {form.deadline && <div className="text-[11px] text-ink-faint mt-2.5">Hạn nộp {form.deadline}</div>}
              </div>
              <div className="text-[11px] text-ink-faint">
                {editId
                  ? 'Kiểm tra lại thông tin ở 3 bước trước — sau khi lưu, tin sẽ quay về trạng thái chờ Admin duyệt lại trước khi hiển thị trong tìm kiếm việc làm.'
                  : 'Kiểm tra lại thông tin ở 3 bước trước — sau khi gửi, tin sẽ chờ Admin duyệt trước khi hiển thị trong tìm kiếm việc làm.'}
              </div>
            </>
          )}

          <div className="flex justify-between items-center gap-3 pt-4 border-t border-border mt-auto">
            <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="tvl-btn-ghost !w-auto px-4 disabled:opacity-40">
              ← Quay lại
            </button>
            {step < STEPS.length - 1 ? (
              <button type="button" disabled={!canProceed()} onClick={() => setStep((s) => s + 1)} className="tvl-btn-primary !w-auto px-5 disabled:opacity-50">
                Tiếp tục →
              </button>
            ) : (
              <button type="button" disabled={submitting} onClick={handleSubmit} className="tvl-btn-accent !w-auto px-5">
                {submitting ? 'Đang lưu…' : editId ? 'Cập nhật tin đăng →' : 'Gửi đăng tin →'}
              </button>
            )}
          </div>
        </div>
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
