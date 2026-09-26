'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi, ApiError } from '@/lib/api';
import { track } from '@/lib/analytics';
import { useAuth } from '@/lib/auth-context';
import PasswordInput from '@/components/PasswordInput';

export default function DangKyNtdPage() {
  const router = useRouter();
  const { setToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [industry, setIndustry] = useState('');
  const [size, setSize] = useState('');
  const [website, setWebsite] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.registerEmployer({
        email,
        password,
        fullName,
        phone: phone || undefined,
        companyName,
        taxCode,
        industry: industry || undefined,
        size: size || undefined,
        website: website || undefined,
      });
      track('signup', { meta: { role: 'employer' } });
      setToken(res.accessToken);
      router.push('/nha-tuyen-dung/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể tạo tài khoản, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between bg-primary text-white p-12">
        <Link href="/" className="flex items-center gap-3">
          {/* Đợt 12j (21/09/2026) — đổi biểu tượng logo từ icon dấu tích sang chữ "V" đơn giản. */}
          <span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
            <span className="text-white font-extrabold text-base leading-none select-none">V</span>
          </span>
          {/* Đợt 12c (21/09/2026) — đồng bộ chữ logo "ĐĂNG TUYỂN MIỄN PHÍ" với header; trang này
              đón NTD ngay khi họ chuẩn bị đăng ký, nên lời kêu gọi càng có ý nghĩa. */}
          <span className="text-lg font-extrabold tracking-tight">
            ĐĂNG TUYỂN <span className="text-accent">MIỄN PHÍ</span>
          </span>
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold leading-snug text-balance">
            Đăng tin tuyển dụng, tiếp cận hàng ngàn ứng viên
          </h1>
          <p className="mt-3 text-white/80 max-w-sm">
            Tạo tài khoản Nhà tuyển dụng để đăng tin và quản lý hồ sơ ứng viên ứng tuyển.
          </p>
        </div>
        <div className="flex gap-8 text-sm">
          <div>
            <div className="text-2xl font-extrabold font-mono">10.000+</div>
            <div className="text-white/70">Việc làm đang tuyển</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold font-mono">2.000+</div>
            <div className="text-white/70">Doanh nghiệp</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <h2 className="text-lg font-extrabold mb-1">Đăng ký tài khoản Nhà tuyển dụng</h2>
          <p className="text-xs text-ink-faint mb-6">
            Bạn là ứng viên tìm việc?{' '}
            <Link href="/dang-nhap" className="text-primary font-semibold">
              Đăng nhập / Đăng ký tại đây
            </Link>
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-critical-tint text-critical text-sm px-3 py-2.5">{error}</div>
          )}

          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="text-xs font-bold text-ink-faint uppercase tracking-wide">Thông tin công ty</div>
            <Field label="Tên công ty">
              <input required className="tvl-input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Công ty TNHH..." />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mã số thuế">
                <input required className="tvl-input" value={taxCode} onChange={(e) => setTaxCode(e.target.value)} placeholder="0301xxxxxx" />
              </Field>
              <Field label="Quy mô (không bắt buộc)">
                <input className="tvl-input" value={size} onChange={(e) => setSize(e.target.value)} placeholder="50-150 nhân viên" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ngành nghề (không bắt buộc)">
                <input className="tvl-input" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="CNTT / Phần mềm" />
              </Field>
              <Field label="Website (không bắt buộc)">
                <input className="tvl-input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
              </Field>
            </div>

            <div className="text-xs font-bold text-ink-faint uppercase tracking-wide mt-2">Người phụ trách đăng ký</div>
            <Field label="Họ tên">
              <input required className="tvl-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <input type="email" required className="tvl-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hr@congty.vn" />
              </Field>
              <Field label="Số điện thoại (không bắt buộc)">
                <input className="tvl-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" />
              </Field>
            </div>
            <Field label="Mật khẩu" hint="Tối thiểu 8 ký tự">
              <PasswordInput required minLength={8} className="tvl-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>

            <button type="submit" disabled={loading} className="tvl-btn-accent mt-2">
              {loading ? 'Đang tạo tài khoản…' : 'Tạo tài khoản Nhà tuyển dụng'}
            </button>
          </form>

          <p className="text-[11px] text-ink-faint mt-6 leading-relaxed">
            Bằng việc tiếp tục, bạn đồng ý với{' '}
            <a className="underline" href="#">
              Điều khoản sử dụng
            </a>{' '}
            và{' '}
            <a className="underline" href="#">
              Chính sách bảo mật
            </a>{' '}
            của Tuyển Dụng Việc Làm.
          </p>
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
