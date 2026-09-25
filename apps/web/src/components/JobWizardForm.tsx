'use client';

// Đợt 17h (25/09/2026) — theo yêu cầu người dùng: 3 nơi tạo/sửa tin tuyển dụng (wizard "Đăng tin"
// của NTD, "Sửa tin" của Admin, "Cách 3" ở tab Nguồn ngoài của Admin) phải GIỐNG HỆT NHAU — không
// chỉ cùng bộ trường (đã làm ở Đợt 17g) mà cùng GIAO DIỆN: wizard 4 Bước (Thông tin vị trí → Mô tả
// & yêu cầu → Hạn nộp hồ sơ → Xem trước & gửi), cùng thanh bước, cùng nút Tiếp tục/Quay lại.
//
// File này lấy đúng nguyên bộ JSX/logic 4 bước đã có sẵn, đang chạy tốt ở
// `nha-tuyen-dung/dang-tin/page.tsx` (dùng chung cho "Đăng tin mới" và NTD tự "Sửa tin" của họ từ
// Đợt 12l), tách thành 1 component dùng chung `<JobWizardSteps>` — để Admin "Sửa tin" và Admin
// "Nguồn ngoài Cách 3" tái sử dụng NGUYÊN VẸN, thay vì mỗi nơi tự viết 1 kiểu giao diện riêng.
//
// Hành vi nghiệp vụ (API gọi gì, có reset approvalStatus hay không, thông báo sau khi lưu...) KHÔNG
// nằm trong file này — mỗi trang gọi nó (`nha-tuyen-dung/dang-tin`, `admin/sua-tin/[id]`,
// `admin/dashboard` AddJobForm) tự quản lý state `form`/`step`, tự viết `onSubmit`, tự truyền chữ
// hiển thị (`submitLabel`, `previewNote`...) — file này chỉ là phần GIAO DIỆN dùng chung.
import { MultiSelectPopover } from '@/components/search/MultiSelectPopover';
import { ChipsInput } from '@/components/profile/ui';
import { RichTextEditor } from '@/components/RichTextEditor';
import { richTextListItems } from '@/lib/richtext';
import { formatSalary } from '@/lib/format';
import type { WorkLocation } from '@/lib/api';
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  GENDER_OPTIONS,
  INDUSTRIES,
  LEVELS,
  PINNED_PROVINCES,
  PROVINCE_REGIONS,
} from '@/lib/catalogs';

export const JOB_WIZARD_STEPS = ['Thông tin vị trí', 'Mô tả & yêu cầu', 'Hạn nộp hồ sơ', 'Xem trước & gửi'];

const PROVINCE_GROUPS = [
  { label: undefined, options: PINNED_PROVINCES },
  ...PROVINCE_REGIONS.map((r) => ({ label: r.region, options: r.provinces })),
];
const INDUSTRY_GROUPS = [{ label: undefined, options: INDUSTRIES }];
// Quận/huyện hiện chỉ có dữ liệu mẫu cho Hà Nội/Hồ Chí Minh — chỉ hiện ô nhập quận khi chọn tỉnh có hỗ trợ.
const DISTRICT_SUPPORTED_PROVINCES = ['Hồ Chí Minh', 'Hà Nội'];
const BENEFIT_SUGGESTIONS = ['Bảo hiểm sức khỏe', 'Thưởng KPI', 'Laptop', 'Du lịch hằng năm', 'Tăng lương định kỳ', 'Đào tạo chuyên môn'];

function appendRichTextSuggestion(current: string, suggestion: string): string {
  const clean = isRichTextEmptyLocal(current) ? '' : current;
  return `${clean}<p>${suggestion}</p>`;
}
// Bản cục bộ nhỏ, tránh vòng import — logic giống hệt isRichTextEmpty() ở lib/richtext.ts.
function isRichTextEmptyLocal(value?: string | null): boolean {
  if (!value) return true;
  const stripped = value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return stripped.length === 0;
}

export interface JobWizardFormState {
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
  benefits: string;
  deadline: string;
  tags: string[];
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactNote: string;
}

export const JOB_WIZARD_INITIAL: JobWizardFormState = {
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

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-ink">
        {label} {hint && <span className="font-normal text-ink-faint">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

export interface JobWizardStepsProps {
  form: JobWizardFormState;
  setForm: (updater: JobWizardFormState | ((f: JobWizardFormState) => JobWizardFormState)) => void;
  step: number;
  setStep: (updater: number | ((s: number) => number)) => void;
  error?: string | null;
  submitting: boolean;
  onSubmit: () => void;
  /** Chữ trên nút cuối cùng (bước "Xem trước & gửi"), VD "Gửi đăng tin →" / "Cập nhật tin đăng →" / "Đăng tin (hiển thị công khai ngay) →". */
  submitLabel: string;
  /** Dòng ghi chú nhỏ dưới khối xem trước ở bước cuối (khác nhau tuỳ nơi gọi — NTD chờ duyệt, Admin sửa không đổi trạng thái, Admin tạo hộ hiện công khai ngay...). */
  previewNote: string;
  /** "Chọn nhanh từ địa điểm đã lưu" — chỉ NTD tự đăng tin có tính năng này (lưu trước ở trang Tài khoản). */
  savedLocations?: WorkLocation[];
  onPickSavedLocation?: (loc: WorkLocation) => void;
  /** Hiện lại lý do Admin từ chối (chỉ dùng ở wizard "Sửa tin" của NTD). */
  rejectionInfo?: { reasons: string[]; note?: string } | null;
}

// Đợt 17h — toàn bộ JSX 4 bước dưới đây lấy nguyên từ `nha-tuyen-dung/dang-tin/page.tsx` (Đợt
// 10 → 17g), không đổi cấu trúc/nhãn/hành vi trong từng ô — chỉ tham số hoá phần khác nhau giữa 3
// nơi gọi (chữ trên nút cuối, ghi chú xem trước, có/không "địa điểm đã lưu", có/không lý do từ chối).
export function JobWizardSteps({
  form,
  setForm,
  step,
  setStep,
  error,
  submitting,
  onSubmit,
  submitLabel,
  previewNote,
  savedLocations = [],
  onPickSavedLocation,
  rejectionInfo,
}: JobWizardStepsProps) {
  function canProceed(): boolean {
    if (step === 0) return form.title.trim().length > 0;
    return true;
  }

  return (
    <>
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
        {JOB_WIZARD_STEPS.map((label, i) => (
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
                    onPickSavedLocation?.(loc);
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

            <Field label="Phúc lợi" hint="Gõ tự do, hoặc bấm gợi ý bên dưới để chèn thêm">
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

            <div className="border-t border-border pt-4 flex flex-col gap-3">
              <Field label="Thông tin khác" hint="không bắt buộc">
                <RichTextEditor
                  value={form.contactNote}
                  onChange={(html) => setForm({ ...form, contactNote: html })}
                  placeholder="VD: Bằng cấp, độ tuổi, giới tính, chứng chỉ đặc thù, chế độ phúc lợi, mức lương…"
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
            <div className="text-[11px] text-ink-faint">{previewNote}</div>
          </>
        )}

        <div className="flex justify-between items-center gap-3 pt-4 border-t border-border mt-auto">
          <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="tvl-btn-ghost !w-auto px-4 disabled:opacity-40">
            ← Quay lại
          </button>
          {step < JOB_WIZARD_STEPS.length - 1 ? (
            <button type="button" disabled={!canProceed()} onClick={() => setStep((s) => s + 1)} className="tvl-btn-primary !w-auto px-5 disabled:opacity-50">
              Tiếp tục →
            </button>
          ) : (
            <button type="button" disabled={submitting} onClick={onSubmit} className="tvl-btn-accent !w-auto px-5">
              {submitting ? 'Đang lưu…' : submitLabel}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
