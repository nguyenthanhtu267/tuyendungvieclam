'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { adminApi, ApiError, type AdminDashboard, type JobPosting, type Company, type Order } from '@/lib/api';
import { formatDate, formatSalary, formatCurrency, PAYMENT_METHOD_LABEL } from '@/lib/format';
import ChangePasswordCard from '@/components/ChangePasswordCard';
import { scanJobContent } from '@/lib/content-moderation';

// Đợt 12f (21/09/2026) — bổ sung mục "Đổi mật khẩu" tự phục vụ cho Admin, còn thiếu sót ở Đợt
// 12a (lúc đó chỉ làm cho Ứng viên và Nhà tuyển dụng). Trước khi có mục này, Admin chỉ có thể
// dùng chức năng "Người dùng → Đặt lại mật khẩu (tạm)" để tự đặt lại cho chính mình (mật khẩu
// ngẫu nhiên hệ thống sinh ra) — vẫn dùng được để khoá ngay mật khẩu mẫu, nhưng không tự chọn
// được mật khẩu mong muốn như mục này.
const NAV_ITEMS = [
  { id: 'overview', label: '📊 Tổng quan' },
  { id: 'jobs', label: '🗂 Duyệt tin' },
  { id: 'companies', label: '🏢 Duyệt công ty' },
  { id: 'orders', label: '💰 Đơn hàng' },
  { id: 'users', label: '👤 Người dùng' },
  { id: 'settings', label: '🔒 Đổi mật khẩu' },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const { me, token, logout } = useAuth();
  const [tab, setTab] = useState('overview');
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [pendingJobs, setPendingJobs] = useState<JobPosting[]>([]);
  const [pendingCompanies, setPendingCompanies] = useState<Company[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
    else if (me && me.role !== 'admin' && me.role !== 'moderator') router.replace('/');
  }, [me, router]);

  // Chỉ hiện "Đang tải…" toàn trang ở lần đầu — duyệt/xác nhận xong không cần che UI.
  const loadAll = useCallback(async () => {
    if (!token) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [d, jobs, companies, orders] = await Promise.all([
        adminApi.dashboard(token),
        adminApi.listPendingJobs(token),
        adminApi.listPendingCompanies(token),
        adminApi.listPendingOrders(token),
      ]);
      setDashboard(d);
      setPendingJobs(jobs);
      setPendingCompanies(companies);
      setPendingOrders(orders);
      hasLoadedRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleJobDecision(id: string, decision: 'approve' | 'reject') {
    if (!token) return;
    setBusyId(id);
    try {
      if (decision === 'approve') await adminApi.approveJob(token, id);
      else await adminApi.rejectJob(token, id);
      await loadAll();
    } finally {
      setBusyId(null);
    }
  }

  async function handleCompanyDecision(id: string, decision: 'approve' | 'reject') {
    if (!token) return;
    setBusyId(id);
    try {
      if (decision === 'approve') await adminApi.approveCompany(token, id);
      else await adminApi.rejectCompany(token, id);
      await loadAll();
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmPayment(id: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await adminApi.confirmOrderPayment(token, id);
      await loadAll();
    } finally {
      setBusyId(null);
    }
  }

  if (!me || (me.role !== 'admin' && me.role !== 'moderator') || !token) return null;

  return (
    <main className="min-h-screen bg-bg grid md:grid-cols-[200px_1fr]">
      <aside className="bg-primary-dark text-white p-3 flex flex-col gap-1 md:min-h-screen">
        <div className="font-extrabold text-sm px-2 pt-1.5 pb-3.5">⚙ Admin Console</div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`text-left px-2.5 py-2 rounded-lg text-xs font-bold ${
              tab === item.id ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white'
            }`}
          >
            {item.label}
            {item.id === 'jobs' && dashboard ? ` (${dashboard.pendingJobsCount})` : ''}
            {item.id === 'companies' && dashboard ? ` (${dashboard.pendingCompaniesCount})` : ''}
            {item.id === 'orders' ? ` (${pendingOrders.length})` : ''}
          </button>
        ))}
        <button onClick={logout} className="mt-auto text-left px-2.5 py-2 rounded-lg text-xs font-bold text-white/70 hover:text-white">
          Đăng xuất
        </button>
      </aside>

      <div className="px-4 sm:px-6 lg:px-10 py-6">
        {loading ? (
          <div className="text-center text-ink-faint py-10 text-sm">Đang tải…</div>
        ) : tab === 'overview' ? (
          <>
            <h1 className="font-bold text-base mb-4">Tổng quan hệ thống</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile value={dashboard?.employerCount ?? 0} label="Nhà tuyển dụng" />
              <StatTile value={dashboard?.candidateCount ?? 0} label="Ứng viên" />
              <StatTile value={dashboard?.pendingJobsCount ?? 0} label="Tin chờ duyệt" />
              <StatTile value={dashboard?.pendingCompaniesCount ?? 0} label="Công ty chờ duyệt" />
            </div>
            <div className="rounded-xl bg-white border border-border p-5 mt-5">
              <h2 className="font-bold text-sm mb-3">Hàng chờ duyệt tin gần đây</h2>
              {!dashboard || dashboard.recentPendingJobs.length === 0 ? (
                <div className="text-center text-ink-faint text-xs py-6">Không có tin nào đang chờ duyệt</div>
              ) : (
                <div className="flex flex-col gap-2.5 text-xs">
                  {dashboard.recentPendingJobs.map((job) => (
                    <div key={job.id} className="flex justify-between items-center">
                      <div>
                        <span className="font-bold">{job.title}</span>
                        <span className="text-ink-faint"> · {job.company?.name}</span>
                      </div>
                      <span className="text-ink-faint">{formatDate(job.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : tab === 'jobs' ? (
          <>
            <h1 className="font-bold text-base mb-4">Hàng chờ duyệt tin tuyển dụng</h1>
            {pendingJobs.length === 0 ? (
              <div className="text-center text-ink-faint text-sm py-16">Không có tin nào đang chờ duyệt 🎉</div>
            ) : (
              <div className="rounded-xl bg-white border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-ink-faint bg-surface-alt">
                        <th className="py-2.5 px-4 font-semibold">Tin đăng</th>
                        <th className="py-2.5 px-3 font-semibold">Công ty</th>
                        <th className="py-2.5 px-3 font-semibold">Mức lương</th>
                        <th className="py-2.5 px-3 font-semibold">Gửi lúc</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingJobs.map((job) => {
                        const scan = scanJobContent(job.title, job.description, job.requirements);
                        return (
                        <tr key={job.id} className="border-t border-border align-top">
                          <td className="py-3 px-4 font-bold">
                            {job.title}
                            {(scan.hasLink || scan.sensitiveHits.length > 0) && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {scan.hasLink && (
                                  <span
                                    className="font-semibold text-[10px] rounded-full bg-critical-tint text-critical px-2 py-0.5"
                                    title={`Phát hiện link: ${scan.links.join(', ')}`}
                                  >
                                    ⚠ Có link
                                  </span>
                                )}
                                {scan.sensitiveHits.length > 0 && (
                                  <span
                                    className="font-semibold text-[10px] rounded-full bg-warning-tint text-warning px-2 py-0.5"
                                    title={`Từ khoá nghi vấn: ${scan.sensitiveHits.join(', ')}`}
                                  >
                                    ⚠ Từ khoá nhạy cảm ({scan.sensitiveHits.length})
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-ink-faint">{job.company?.name}</td>
                          <td className="py-3 px-3 tabular-nums">{formatSalary(job.salaryMin, job.salaryMax)}</td>
                          <td className="py-3 px-3 tabular-nums whitespace-nowrap">{formatDate(job.createdAt)}</td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <a
                              href={`/admin/xem-tin/${job.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block text-[11px] font-bold rounded-md bg-surface-alt text-ink px-2.5 py-1.5 mr-1.5"
                            >
                              Xem trước
                            </a>
                            <button
                              disabled={busyId === job.id}
                              onClick={() => handleJobDecision(job.id, 'approve')}
                              className="text-[11px] font-bold rounded-md bg-success-tint text-success px-2.5 py-1.5 mr-1.5 disabled:opacity-50"
                            >
                              Duyệt
                            </button>
                            <button
                              disabled={busyId === job.id}
                              onClick={() => handleJobDecision(job.id, 'reject')}
                              className="text-[11px] font-bold rounded-md bg-critical-tint text-critical px-2.5 py-1.5 disabled:opacity-50"
                            >
                              Từ chối
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : tab === 'companies' ? (
          <>
            <h1 className="font-bold text-base mb-4">Hàng chờ duyệt công ty</h1>
            {pendingCompanies.length === 0 ? (
              <div className="text-center text-ink-faint text-sm py-16">Không có công ty nào đang chờ duyệt 🎉</div>
            ) : (
              <div className="rounded-xl bg-white border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-ink-faint bg-surface-alt">
                        <th className="py-2.5 px-4 font-semibold">Tên công ty</th>
                        <th className="py-2.5 px-3 font-semibold">Mã số thuế</th>
                        <th className="py-2.5 px-3 font-semibold">Ngành nghề</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingCompanies.map((c) => (
                        <tr key={c.id} className="border-t border-border">
                          <td className="py-3 px-4 font-bold">{c.name}</td>
                          <td className="py-3 px-3 tabular-nums">{c.taxCode}</td>
                          <td className="py-3 px-3 text-ink-faint">{c.industry ?? '—'}</td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              disabled={busyId === c.id}
                              onClick={() => handleCompanyDecision(c.id, 'approve')}
                              className="text-[11px] font-bold rounded-md bg-success-tint text-success px-2.5 py-1.5 mr-1.5 disabled:opacity-50"
                            >
                              Duyệt
                            </button>
                            <button
                              disabled={busyId === c.id}
                              onClick={() => handleCompanyDecision(c.id, 'reject')}
                              className="text-[11px] font-bold rounded-md bg-critical-tint text-critical px-2.5 py-1.5 disabled:opacity-50"
                            >
                              Từ chối
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : tab === 'orders' ? (
          <>
            <h1 className="font-bold text-base mb-4">Đơn hàng chờ xác nhận thanh toán</h1>
            <div className="text-xs text-ink-faint -mt-2.5 mb-4">
              Chỉ áp dụng cho đơn dùng phương thức &quot;Hợp đồng + hoá đơn VAT&quot; — xác nhận sau khi đã ký hợp
              đồng và nhận thanh toán ngoài hệ thống. Các cổng thanh toán online (VNPay/MoMo/ZaloPay/VietQR) chưa
              được tích hợp thật.
            </div>
            {pendingOrders.length === 0 ? (
              <div className="text-center text-ink-faint text-sm py-16">Không có đơn hàng nào đang chờ xác nhận 🎉</div>
            ) : (
              <div className="rounded-xl bg-white border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-ink-faint bg-surface-alt">
                        <th className="py-2.5 px-4 font-semibold">Công ty</th>
                        <th className="py-2.5 px-3 font-semibold">Gói dịch vụ</th>
                        <th className="py-2.5 px-3 font-semibold">Số tiền</th>
                        <th className="py-2.5 px-3 font-semibold">Phương thức</th>
                        <th className="py-2.5 px-3 font-semibold">Ngày đặt</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingOrders.map((o) => (
                        <tr key={o.id} className="border-t border-border">
                          <td className="py-3 px-4 font-bold">{o.company?.name ?? '—'}</td>
                          <td className="py-3 px-3">{o.servicePackage?.name ?? '—'}</td>
                          <td className="py-3 px-3 tabular-nums">
                            {o.servicePackage ? formatCurrency(o.servicePackage.price) : '—'}
                          </td>
                          <td className="py-3 px-3">{PAYMENT_METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod}</td>
                          <td className="py-3 px-3 tabular-nums whitespace-nowrap">{formatDate(o.createdAt)}</td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              disabled={busyId === o.id}
                              onClick={() => handleConfirmPayment(o.id)}
                              className="text-[11px] font-bold rounded-md bg-success-tint text-success px-2.5 py-1.5 disabled:opacity-50"
                            >
                              Xác nhận đã thanh toán
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : tab === 'users' ? (
          <UsersCard token={token} />
        ) : (
          <>
            <h1 className="font-bold text-base mb-4">Đổi mật khẩu</h1>
            <div className="max-w-md">
              <ChangePasswordCard token={token} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// Đợt 12a (20/09/2026) — Admin tra cứu tài khoản theo email và đặt lại mật khẩu tạm, thay cho
// "quên mật khẩu" tự phục vụ qua email (Giai đoạn 1 không có email/SMS). Mật khẩu tạm chỉ hiển thị
// 1 lần ngay sau khi tạo — Admin cần tự báo cho người dùng qua kênh ngoài hệ thống.
function UsersCard({ token }: { token: string }) {
  const [email, setEmail] = useState('');
  const [user, setUser] = useState<{ id: string; email: string; fullName?: string; role: string; status: string } | null>(
    null,
  );
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setUser(null);
    setTempPassword(null);
    if (!email.trim()) return;
    setLoading(true);
    try {
      const found = await adminApi.findUserByEmail(token, email.trim());
      setUser(found);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tìm thấy tài khoản');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.resetUserPassword(token, user.id);
      setTempPassword(result.tempPassword);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể đặt lại mật khẩu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="font-bold text-base mb-4">Tra cứu tài khoản & đặt lại mật khẩu</h1>
      <div className="text-xs text-ink-faint -mt-2.5 mb-4 max-w-2xl">
        Dùng khi người dùng quên mật khẩu và không tự đặt lại được (Giai đoạn 1 chưa gửi email/SMS).
        Tìm tài khoản theo email, đặt lại thành mật khẩu tạm, rồi tự báo mật khẩu này cho người dùng qua kênh khác
        (điện thoại, gặp trực tiếp...). Người dùng nên đổi lại mật khẩu ngay trong phần Cài đặt sau khi đăng nhập.
      </div>
      <div className="rounded-xl bg-white border border-border p-5 max-w-md">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="email"
            required
            placeholder="Email tài khoản…"
            className="tvl-input text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={loading} className="tvl-btn-primary !w-auto px-4 whitespace-nowrap">
            Tìm
          </button>
        </form>
        {error && <div className="text-critical text-xs font-semibold mt-3">{error}</div>}
        {user && (
          <div className="mt-4 text-xs flex flex-col gap-2">
            <div>
              <span className="text-ink-faint">Họ tên: </span>
              <span className="font-bold">{user.fullName ?? '—'}</span>
            </div>
            <div>
              <span className="text-ink-faint">Vai trò: </span>
              <span className="font-bold">{user.role}</span>
            </div>
            <div>
              <span className="text-ink-faint">Trạng thái: </span>
              <span className="font-bold">{user.status}</span>
            </div>
            <button
              onClick={handleReset}
              disabled={loading}
              className="tvl-btn-primary !w-auto px-4 mt-1.5 self-start"
            >
              Đặt lại mật khẩu (tạm)
            </button>
          </div>
        )}
        {tempPassword && (
          <div className="mt-4 rounded-lg bg-warning-tint text-warning text-xs font-semibold px-3.5 py-2.5">
            Mật khẩu tạm cho {user?.email}: <span className="font-mono">{tempPassword}</span>
            <br />
            Chỉ hiển thị 1 lần — hãy sao chép và báo ngay cho người dùng.
          </div>
        )}
      </div>
    </>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-white border border-border p-4">
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="text-xs text-ink-faint mt-1">{label}</div>
    </div>
  );
}
