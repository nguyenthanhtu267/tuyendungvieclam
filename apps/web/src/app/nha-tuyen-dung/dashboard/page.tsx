'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import EmployerHeader from '@/components/EmployerHeader';
import { useAuth } from '@/lib/auth-context';
import { employerApi, type Company, type EmployerDashboard } from '@/lib/api';
import { APPLICATION_STATUS_CLASS, APPLICATION_STATUS_LABEL, formatDate, formatNumber } from '@/lib/format';

const JOB_STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  approved: 'Đang hiển thị',
  rejected: 'Bị từ chối',
  expired: 'Hết hạn',
};
const JOB_STATUS_CLASS: Record<string, string> = {
  draft: 'bg-surface-alt text-ink-faint',
  pending: 'bg-warning-tint text-warning',
  approved: 'bg-success-tint text-success',
  rejected: 'bg-critical-tint text-critical',
  expired: 'bg-surface-alt text-ink-faint',
};

export default function EmployerDashboardPage() {
  const router = useRouter();
  const { me, token } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [dashboard, setDashboard] = useState<EmployerDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
    else if (me && !me.role.startsWith('employer')) router.replace('/');
  }, [me, router]);

  useEffect(() => {
    // Đợt 18 (26/09/2026) — sửa lỗi: khi Admin bấm "Quay lại Admin" lúc đang "Đăng nhập thay",
    // `token` đổi sang token Admin NGAY (đồng bộ) trong khi trang này chưa kịp điều hướng đi — effect
    // này từng chạy lại với token Admin (không gắn công ty nào) và ném lỗi 403 chưa bắt (unhandled
    // promise rejection) ra console. Chỉ gọi API khi `me` đã xác nhận đúng là tài khoản NTD; thêm
    // catch để không bao giờ vãi lỗi mạng ra console dù trường hợp nào.
    if (!token || !me || !me.role.startsWith('employer')) return;
    (async () => {
      setLoading(true);
      try {
        const [c, d] = await Promise.all([employerApi.getCompany(token), employerApi.dashboard(token)]);
        setCompany(c);
        setDashboard(d);
      } catch {
        // đang chuyển phiên (VD thoát "Đăng nhập thay") hoặc lỗi mạng tạm thời — bỏ qua, trang sẽ
        // tự điều hướng đi hoặc người dùng có thể tải lại.
      } finally {
        setLoading(false);
      }
    })();
  }, [token, me]);

  if (!me || !me.role.startsWith('employer')) return null;

  return (
    <main className="min-h-screen bg-bg">
      <EmployerHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col gap-5">
        <div className="rounded-2xl p-6 bg-gradient-to-br from-primary to-primary-dark text-white flex flex-wrap justify-between items-center gap-4">
          <div>
            <div className="font-extrabold text-lg">Chào {company?.name ?? '...'} 👋</div>
            <div className="text-white/70 text-xs mt-1">
              Trạng thái công ty: {company?.approvalStatus === 'approved' ? 'Đã xác thực' : 'Chờ xác thực'}
            </div>
          </div>
          <div className="flex gap-2.5">
            <Link href="/nha-tuyen-dung/dang-tin" className="rounded-lg bg-white text-primary font-bold text-sm px-4 py-2.5">
              + Đăng tin mới
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-ink-faint py-10 text-sm">Đang tải…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatTile value={dashboard?.jobCount ?? 0} label="Tin đang tuyển" />
              <StatTile value={dashboard?.totalApplications ?? 0} label="Tổng hồ sơ nhận được" />
              <StatTile value={dashboard?.newApplicationsToday ?? 0} label="Hồ sơ mới hôm nay" />
            </div>

            <div className="grid md:grid-cols-2 gap-4 items-start">
              <div className="rounded-xl bg-white border border-border p-5">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="font-bold text-sm">Tin đăng gần đây</h2>
                  <Link href="/nha-tuyen-dung/tin-dang" className="text-xs font-semibold text-primary">
                    Quản lý tất cả
                  </Link>
                </div>
                {!dashboard || dashboard.recentJobs.length === 0 ? (
                  <div className="text-center text-ink-faint text-xs py-6">Chưa có tin tuyển dụng nào</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-ink-faint text-left border-b border-border">
                          <th className="py-2 font-semibold">Vị trí</th>
                          <th className="py-2 font-semibold">Trạng thái</th>
                          <th className="py-2 font-semibold text-right">Hồ sơ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.recentJobs.map((job) => (
                          <tr key={job.id} className="border-b border-border last:border-0">
                            <td className="py-2.5 font-semibold">{job.title}</td>
                            <td className="py-2.5">
                              <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${JOB_STATUS_CLASS[job.approvalStatus ?? 'approved']}`}>
                                {JOB_STATUS_LABEL[job.approvalStatus ?? 'approved']}
                              </span>
                            </td>
                            <td className="py-2.5 text-right tabular-nums">{formatNumber(job.applicationCount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-white border border-border p-5">
                <h2 className="font-bold text-sm mb-3">Hồ sơ ứng tuyển mới nhất</h2>
                {!dashboard || dashboard.recentApplications.length === 0 ? (
                  <div className="text-center text-ink-faint text-xs py-6">Chưa có hồ sơ ứng tuyển nào</div>
                ) : (
                  <div className="flex flex-col gap-3 text-xs">
                    {dashboard.recentApplications.map((app) => (
                      <div key={app.id} className="flex justify-between items-start gap-2">
                        <div>
                          <div className="font-bold">{app.cv.candidateProfile.fullName}</div>
                          <div className="text-ink-faint mt-0.5">
                            {app.jobPosting?.title} · {formatDate(app.appliedAt)}
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-1 rounded-full text-[11px] font-semibold ${APPLICATION_STATUS_CLASS[app.status]}`}>
                          {APPLICATION_STATUS_LABEL[app.status]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-white border border-border p-4">
      <div className="text-2xl font-extrabold tabular-nums">{formatNumber(value)}</div>
      <div className="text-xs text-ink-faint mt-1">{label}</div>
    </div>
  );
}
