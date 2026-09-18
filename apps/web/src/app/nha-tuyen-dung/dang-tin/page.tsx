'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import EmployerHeader from '@/components/EmployerHeader';
import { useAuth } from '@/lib/auth-context';
import { employerApi, ApiError } from '@/lib/api';
import { formatSalary } from '@/lib/format';

const STEPS = ['Thông tin vị trí', 'Mô tả & yêu cầu', 'Phúc lợi & hạn nộp', 'Xem trước & gửi'];
const INDUSTRY_OPTIONS = [
  'Kinh doanh / Bán hàng',
  'CNTT / Phần mềm',
  'Marketing',
  'Dịch vụ khách hàng',
  'Y tế / Dược',
  'Sản xuất / Cơ khí',
  'Logistics',
  'Nhà hàng / Khách sạn',
];
const BENEFIT_OPTIONS = ['Bảo hiểm sức khỏe', 'Thưởng KPI', 'Laptop', 'Du lịch hằng năm', 'Tăng lương định kỳ', 'Đào tạo chuyên môn'];
const LEVEL_OPTIONS = ['Thực tập sinh', 'Nhân viên', 'Giám sát / Trưởng nhóm', 'Quản lý', 'Trưởng phòng trở lên'];
const EMPLOYMENT_TYPE_OPTIONS = ['Toàn thời gian', 'Bán thời gian', 'Thực tập', 'Thời vụ'];

interface FormState {
  title: string;
  headcount: string;
  industries: string[];
  level: string;
  employmentType: string;
  location: string;
  salaryMin: string;
  salaryMax: string;
  negotiable: boolean;
  description: string;
  requirements: string;
  benefits: string[];
  deadline: string;
}

const INITIAL: FormState = {
  title: '',
  headcount: '1',
  industries: [],
  level: LEVEL_OPTIONS[1],
  employmentType: EMPLOYMENT_TYPE_OPTIONS[0],
  location: '',
  salaryMin: '',
  salaryMax: '',
  negotiable: false,
  description: '',
  requirements: '',
  benefits: [],
  deadline: '',
};

export default function DangTinPage() {
  const router = useRouter();
  const { me, token } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
    else if (me && !me.role.startsWith('employer')) router.replace('/');
  }, [me, router]);

  if (!me || !me.role.startsWith('employer')) return null;

  function toggle(list: string[], value: string, max?: number): string[] {
    if (list.includes(value)) return list.filter((v) => v !== value);
    if (max && list.length >= max) return list;
    return [...list, value];
  }

  function canProceed(): boolean {
    if (step === 0) return form.title.trim().length > 0;
    return true;
  }

  async function handleSubmit() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await employerApi.createJob(token, {
        title: form.title,
        industry: form.industries[0],
        location: form.location || undefined,
        salaryMin: form.negotiable || !form.salaryMin ? undefined : Number(form.salaryMin),
        salaryMax: form.negotiable || !form.salaryMax ? undefined : Number(form.salaryMax),
        employmentType: form.employmentType,
        level: form.level,
        headcount: Number(form.headcount) || 1,
        description: form.description || undefined,
        requirements: form.requirements || undefined,
        benefits: form.benefits.length ? form.benefits : undefined,
        deadline: form.deadline || undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể đăng tin, vui lòng thử lại');
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
          <h1 className="font-extrabold text-lg">Đã gửi tin để duyệt!</h1>
          <p className="text-sm text-ink-faint">
            Tin tuyển dụng &quot;{form.title}&quot; đã được gửi cho Admin xét duyệt. Tin sẽ hiển thị trong tìm kiếm việc làm ngay sau khi được duyệt (thường trong vòng 24 giờ).
          </p>
          <div className="flex gap-3 mt-2">
            <button className="tvl-btn-ghost !w-auto px-5" onClick={() => { setForm(INITIAL); setStep(0); setSuccess(false); }}>
              Đăng tin khác
            </button>
            <button className="tvl-btn-primary !w-auto px-5" onClick={() => router.push('/nha-tuyen-dung/dashboard')}>
              Về Dashboard
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
                <div className="flex flex-wrap gap-2">
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <Chip key={opt} active={form.industries.includes(opt)} onClick={() => setForm({ ...form, industries: toggle(form.industries, opt, 3) })}>
                      {opt}
                    </Chip>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cấp bậc">
                  <select className="tvl-input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                    {LEVEL_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Hình thức làm việc">
                  <select className="tvl-input" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                    {EMPLOYMENT_TYPE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Địa điểm làm việc">
                  <input className="tvl-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="VD: Q.1, Hồ Chí Minh" />
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
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="font-bold text-sm">Mô tả & yêu cầu công việc</h2>
              <Field label="Mô tả công việc">
                <textarea className="tvl-input min-h-[110px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mô tả các đầu việc chính..." />
              </Field>
              <Field label="Yêu cầu ứng viên">
                <textarea className="tvl-input min-h-[110px]" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} placeholder="Yêu cầu về kinh nghiệm, kỹ năng..." />
              </Field>
              <div className="text-[11px] text-ink-faint">
                Ảnh/banner tin tuyển dụng: sẽ hỗ trợ ở bản cập nhật sau (khi kết nối lưu trữ tệp Cloudflare R2).
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-bold text-sm">Phúc lợi & hạn nộp hồ sơ</h2>
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
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="font-bold text-sm">Xem trước tin tuyển dụng</h2>
              <div className="rounded-lg bg-surface-alt p-4">
                <div className="font-extrabold text-sm">{form.title || '(Chưa nhập chức danh)'}</div>
                <div className="text-xs text-ink-faint mt-1">
                  {form.location || 'Chưa rõ địa điểm'} · {form.negotiable ? 'Thoả thuận' : formatSalary(Number(form.salaryMin) || undefined, Number(form.salaryMax) || undefined)} · {form.employmentType} · {form.headcount} vị trí
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {[...form.industries, ...form.benefits].map((tag) => (
                    <span key={tag} className="text-[11px] font-semibold bg-primary-tint text-primary rounded-full px-2.5 py-1">{tag}</span>
                  ))}
                </div>
                {form.deadline && <div className="text-[11px] text-ink-faint mt-2.5">Hạn nộp {form.deadline}</div>}
              </div>
              <div className="text-[11px] text-ink-faint">
                Kiểm tra lại thông tin ở 3 bước trước — sau khi gửi, tin sẽ chờ Admin duyệt trước khi hiển thị trong tìm kiếm việc làm.
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
                {submitting ? 'Đang gửi…' : 'Gửi đăng tin →'}
              </button>
            )}
          </div>
        </div>
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
