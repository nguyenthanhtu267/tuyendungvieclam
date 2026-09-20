'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Tab = 'login' | 'register';

export default function DangNhapPage() {
  const router = useRouter();
  const { setToken } = useAuth();
  const [tab, setTab] = useState<Tab>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Đợt 12a — "Quên mật khẩu?" trước đây là link chết (href="#"). Giai đoạn 1 không có email/SMS
  // (quyết định phạm vi ban đầu) nên chưa có luồng tự phục vụ qua email; thay vào đó hướng dẫn
  // liên hệ Admin để được đặt lại mật khẩu tạm (xem AdminService.resetUserPassword).
  const [showForgotHelp, setShowForgotHelp] = useState(false);

  // Đăng nhập
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Đăng ký
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login({ email: loginEmail, password: loginPassword });
      setToken(res.accessToken);
      if (res.user.role.startsWith('employer')) router.push('/nha-tuyen-dung/dashboard');
      else if (res.user.role === 'admin' || res.user.role === 'moderator') router.push('/admin/dashboard');
      else router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể đăng nhập, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.register({
        email: regEmail,
        password: regPassword,
        fullName: regFullName,
        phone: regPhone || undefined,
      });
      setToken(res.accessToken);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể đăng ký, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid md:grid-cols-2">
      {/* Trái: panel thương hiệu — theo màn A4 mockup */}
      <div className="hidden md:flex flex-col justify-between bg-primary text-white p-12">
        <div className="flex items-center gap-3">
          {/* Đợt 12j (21/09/2026) — đổi biểu tượng logo từ icon dấu tích sang chữ "V" đơn giản. */}
          <span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
            <span className="text-white font-extrabold text-base leading-none select-none">V</span>
          </span>
          {/* Đợt 12c (21/09/2026) — đồng bộ chữ logo "ĐĂNG TUYỂN MIỄN PHÍ" với header. */}
          <span className="text-lg font-extrabold tracking-tight">
            ĐĂNG TUYỂN <span className="text-accent">MIỄN PHÍ</span>
          </span>
        </div>
        <div>
          <h1 className="text-3xl font-extrabold leading-snug text-balance">
            Kết nối việc làm — đúng người, đúng việc
          </h1>
          <p className="mt-3 text-white/80 max-w-sm">
            Hàng ngàn việc làm từ các doanh nghiệp trên toàn quốc, cập nhật mỗi ngày.
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

      {/* Phải: form đăng nhập / đăng ký */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="flex gap-1 border-b border-border mb-6">
            <button
              className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px ${
                tab === 'login' ? 'text-primary border-primary' : 'text-ink-faint border-transparent'
              }`}
              onClick={() => setTab('login')}
              type="button"
            >
              Đăng nhập
            </button>
            <button
              className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px ${
                tab === 'register' ? 'text-primary border-primary' : 'text-ink-faint border-transparent'
              }`}
              onClick={() => setTab('register')}
              type="button"
            >
              Đăng ký
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-critical-tint text-critical text-sm px-3 py-2.5">
              {error}
            </div>
          )}

          {tab === 'login' ? (
            <form className="flex flex-col gap-4" onSubmit={handleLogin}>
              <Field label="Email">
                <input
                  type="email"
                  required
                  className="tvl-input"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ban@email.com"
                />
              </Field>
              <Field label="Mật khẩu">
                <input
                  type="password"
                  required
                  className="tvl-input"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <div className="text-right -mt-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-primary"
                  onClick={() => setShowForgotHelp((v) => !v)}
                >
                  Quên mật khẩu?
                </button>
              </div>
              {showForgotHelp && (
                <div className="-mt-2 rounded-lg bg-surface-alt text-ink-muted text-xs px-3 py-2.5">
                  Hệ thống hiện chưa hỗ trợ tự đặt lại mật khẩu qua email. Vui lòng liên hệ Admin (qua
                  hotline/email hỗ trợ của công ty) để được cấp mật khẩu tạm, sau đó đổi lại mật khẩu
                  ngay trong phần Cài đặt tài khoản sau khi đăng nhập.
                </div>
              )}
              <button type="submit" disabled={loading} className="tvl-btn-primary">
                {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
              </button>
            </form>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleRegister}>
              <Field label="Họ tên">
                <input
                  required
                  className="tvl-input"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  required
                  className="tvl-input"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="ban@email.com"
                />
              </Field>
              <Field label="Số điện thoại (không bắt buộc)">
                <input
                  className="tvl-input"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="09xx xxx xxx"
                />
              </Field>
              <Field label="Mật khẩu" hint="Tối thiểu 8 ký tự">
                <input
                  type="password"
                  required
                  minLength={8}
                  className="tvl-input"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <button type="submit" disabled={loading} className="tvl-btn-accent">
                {loading ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
              </button>
            </form>
          )}

          <div className="flex items-center gap-3 my-5 text-xs text-ink-faint">
            <div className="flex-1 h-px bg-border" />
            Hoặc tiếp tục với
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex flex-col gap-2.5">
            <button type="button" disabled className="tvl-btn-ghost" title="Sắp ra mắt">
              Tiếp tục với Google
            </button>
            <button type="button" disabled className="tvl-btn-ghost" title="Sắp ra mắt">
              Tiếp tục với Facebook / LinkedIn
            </button>
            <button type="button" disabled className="tvl-btn-ghost" title="Sắp ra mắt">
              Đăng nhập bằng số điện thoại (OTP)
            </button>
          </div>

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

          <p className="text-xs text-ink-faint mt-4 text-center">
            Bạn là nhà tuyển dụng?{' '}
            <Link href="/nha-tuyen-dung/dang-ky" className="text-primary font-semibold">
              Đăng ký tài khoản doanh nghiệp
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-ink">
        {label} {hint && <span className="font-normal text-ink-faint">({hint})</span>}
      </span>
      {children}
    </label>
  );
}
