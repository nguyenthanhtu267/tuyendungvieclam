'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  adminApi,
  ApiError,
  type AdminDashboard,
  type JobPosting,
  type Company,
  type Order,
  type AdminStatsPoint,
  type AdminAuditLogEntry,
  type CreateDraftCompanyPayload,
  type DraftAccountInfo,
  type CompanyClaimRequestRow,
  type CompanyClaimRequestStatus,
  type CreateJobPayload,
} from '@/lib/api';
import { formatDate, formatDateTime, formatSalary, formatCurrency, formatNumber, normalizeSalaryAmount, PAYMENT_METHOD_LABEL } from '@/lib/format';
import ChangePasswordCard from '@/components/ChangePasswordCard';
import { scanJobContent } from '@/lib/content-moderation';
import { CompanyLogo } from '@/components/CompanyLogo';
import { isRichTextEmpty } from '@/lib/richtext';
import { JobWizardSteps, JOB_WIZARD_INITIAL, type JobWizardFormState } from '@/components/JobWizardForm';
import { INDUSTRIES, PROVINCES } from '@/lib/catalogs';

// Đợt 12f (21/09/2026) — bổ sung mục "Đổi mật khẩu" tự phục vụ cho Admin, còn thiếu sót ở Đợt
// 12a (lúc đó chỉ làm cho Ứng viên và Nhà tuyển dụng). Trước khi có mục này, Admin chỉ có thể
// dùng chức năng "Người dùng → Đặt lại mật khẩu (tạm)" để tự đặt lại cho chính mình (mật khẩu
// ngẫu nhiên hệ thống sinh ra) — vẫn dùng được để khoá ngay mật khẩu mẫu, nhưng không tự chọn
// được mật khẩu mong muốn như mục này.
const NAV_ITEMS = [
  { id: 'overview', label: '📊 Tổng quan' },
  { id: 'jobs', label: '🗂 Duyệt tin' },
  { id: 'companies', label: '🏢 Duyệt công ty' },
  // Đợt 12q (21/09/2026) — Batch 5: 4 mục Admin mới.
  { id: 'featured', label: '🌟 DN yêu thích' },
  // Đợt 17 (25/09/2026) — "Nguồn ngoài / Tin tổng hợp" (mô hình "labeled aggregator").
  { id: 'sourced', label: '🏷️ Nguồn ngoài' },
  { id: 'stats', label: '📈 Thống kê' },
  { id: 'orders', label: '💰 Đơn hàng' },
  { id: 'users', label: '👤 Người dùng' },
  { id: 'audit-log', label: '📜 Nhật ký thao tác' },
  { id: 'settings', label: '🔒 Đổi mật khẩu' },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const { me, token, logout } = useAuth();
  // Đợt 15 (25/09/2026) — mặc định mở ở tab "Duyệt tin" (theo yêu cầu người dùng: "để tôi duyệt tin
  // nhanh nhất") thay vì "Tổng quan" như trước — Admin vào Console là thấy ngay hàng chờ duyệt.
  const [tab, setTab] = useState('jobs');
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [pendingJobs, setPendingJobs] = useState<JobPosting[]>([]);
  const [pendingCompanies, setPendingCompanies] = useState<Company[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  // Đợt 15 (25/09/2026) — "Tự động duyệt tin": công tắc chung, mặc định TẮT cho tới khi tải được
  // trạng thái thật từ server (null = chưa biết, tránh nháy UI sai trạng thái lúc đầu).
  const [autoApproveEnabled, setAutoApproveEnabled] = useState<boolean | null>(null);
  const [autoApproveBusy, setAutoApproveBusy] = useState(false);

  // Đợt 12q (21/09/2026) — Batch 5 mục #2: chọn nhiều dòng để duyệt/từ chối hàng loạt.
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
    else if (me && me.role !== 'admin' && me.role !== 'moderator') router.replace('/');
  }, [me, router]);

  // Chỉ hiện "Đang tải…" toàn trang ở lần đầu — duyệt/xác nhận xong không cần che UI.
  const loadAll = useCallback(async () => {
    if (!token) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [d, jobs, companies, orders, autoApprove] = await Promise.all([
        adminApi.dashboard(token),
        adminApi.listPendingJobs(token),
        adminApi.listPendingCompanies(token),
        adminApi.listPendingOrders(token),
        adminApi.getAutoApproveSetting(token),
      ]);
      setDashboard(d);
      setPendingJobs(jobs);
      setPendingCompanies(companies);
      setPendingOrders(orders);
      setAutoApproveEnabled(autoApprove.enabled);
      hasLoadedRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Đợt 12x (21/09/2026) — "Bắt buộc nhập lý do khi Từ chối": Từ chối không còn là 1 click ở đây
  // nữa (adminApi.rejectJob giờ đòi hỏi reasons: string[] không rỗng) — nút "Từ chối" bên dưới đưa
  // Admin sang trang /admin/xem-tin/[id] để chọn lý do trong modal. handleJobDecision chỉ còn xử lý
  // Duyệt (vẫn 1 click như cũ, không cần lý do).
  async function handleJobApprove(id: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await adminApi.approveJob(token, id);
      await loadAll();
    } finally {
      setBusyId(null);
    }
  }

  // Đợt 15 (25/09/2026) — công tắc chung "Tự động duyệt tin": bật thì mọi tin đang chờ (kể cả tin
  // gửi lại sau khi từng bị từ chối) sẽ tự động duyệt sau 15 phút — xem AdminService.runAutoApproveSweep().
  async function handleToggleAutoApprove() {
    if (!token || autoApproveEnabled === null) return;
    setAutoApproveBusy(true);
    try {
      const result = await adminApi.setAutoApproveSetting(token, !autoApproveEnabled);
      setAutoApproveEnabled(result.enabled);
    } finally {
      setAutoApproveBusy(false);
    }
  }

  // Đợt 15 (25/09/2026) — nút "Tin đã kiểm tra": chỉ áp dụng cho tin đã được TỰ ĐỘNG duyệt (còn hiện
  // trong danh sách chờ Admin xem lại lần 2) — bấm xong thì dòng tin biến mất khỏi danh sách này,
  // KHÔNG đổi trạng thái duyệt (tin vẫn đang hiển thị công khai như trước khi bấm).
  async function handleMarkReviewed(id: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await adminApi.markJobReviewed(token, id);
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

  // Đợt 12q (21/09/2026) — Batch 5 mục #2: duyệt/từ chối hàng loạt tin/công ty đang chờ.
  function toggleJobSelected(id: string) {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllJobsSelected() {
    setSelectedJobIds((prev) => (prev.size === pendingJobs.length ? new Set() : new Set(pendingJobs.map((j) => j.id))));
  }
  async function handleBulkJobDecision(decision: 'approve' | 'reject') {
    if (!token || selectedJobIds.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selectedJobIds);
      if (decision === 'approve') await adminApi.bulkApproveJobs(token, ids);
      else await adminApi.bulkRejectJobs(token, ids);
      setSelectedJobIds(new Set());
      await loadAll();
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleCompanySelected(id: string) {
    setSelectedCompanyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllCompaniesSelected() {
    setSelectedCompanyIds((prev) =>
      prev.size === pendingCompanies.length ? new Set() : new Set(pendingCompanies.map((c) => c.id)),
    );
  }
  async function handleBulkCompanyDecision(decision: 'approve' | 'reject') {
    if (!token || selectedCompanyIds.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selectedCompanyIds);
      if (decision === 'approve') await adminApi.bulkApproveCompanies(token, ids);
      else await adminApi.bulkRejectCompanies(token, ids);
      setSelectedCompanyIds(new Set());
      await loadAll();
    } finally {
      setBulkBusy(false);
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
            {item.id === 'jobs' && dashboard ? ` (${formatNumber(dashboard.pendingJobsCount)})` : ''}
            {item.id === 'companies' && dashboard ? ` (${formatNumber(dashboard.pendingCompaniesCount)})` : ''}
            {item.id === 'orders' ? ` (${formatNumber(pendingOrders.length)})` : ''}
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
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <h1 className="font-bold text-base">Hàng chờ duyệt tin tuyển dụng</h1>
              {/* Đợt 15 (25/09/2026) — công tắc chung "Tự động duyệt tin" (theo yêu cầu người dùng):
                  bật thì tin đang chờ (kể cả tin gửi lại) tự động duyệt sau 15 phút, không cần Admin
                  bấm tay — nhưng vẫn còn hiện trong danh sách này (nhãn riêng bên dưới) chờ kiểm tra
                  lần 2. Mặc định TẮT. */}
              <button
                type="button"
                disabled={autoApproveEnabled === null || autoApproveBusy}
                onClick={handleToggleAutoApprove}
                className={`flex items-center gap-2 text-xs font-bold rounded-lg px-3 py-2 border disabled:opacity-50 ${
                  autoApproveEnabled
                    ? 'bg-success-tint text-success border-success/30'
                    : 'bg-surface-alt text-ink-faint border-border'
                }`}
              >
                <span
                  className={`inline-block w-8 h-4 rounded-full relative transition-colors ${
                    autoApproveEnabled ? 'bg-success' : 'bg-ink-faint/40'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                      autoApproveEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`}
                  />
                </span>
                Tự động duyệt tin (sau 15 phút){autoApproveEnabled ? ': ĐANG BẬT' : ': đang tắt'}
              </button>
            </div>
            <div className="text-[11px] text-ink-faint -mt-1.5 mb-4 max-w-2xl">
              Khi bật, tin đang chờ duyệt (kể cả tin gửi lại sau khi từng bị từ chối) sẽ tự động lên web cho ứng
              viên nộp hồ sơ sau 15 phút nếu Admin chưa duyệt tay. Tin vẫn còn hiện trong danh sách này (nhãn
              &quot;Đã tự động duyệt&quot;) để kiểm tra lại lần 2 — bấm &quot;Tin đã kiểm tra&quot; khi xong.
            </div>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              {/* Đợt 12q (21/09/2026) — Batch 5 mục #2: thanh thao tác hàng loạt, chỉ hiện khi đã chọn
                  ít nhất 1 dòng. */}
              {selectedJobIds.size > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-ink-faint font-semibold">Đã chọn {selectedJobIds.size}</span>
                  <button
                    disabled={bulkBusy}
                    onClick={() => handleBulkJobDecision('approve')}
                    className="font-bold rounded-md bg-success-tint text-success px-2.5 py-1.5 disabled:opacity-50"
                  >
                    Duyệt tất cả đã chọn
                  </button>
                  <button
                    disabled={bulkBusy}
                    onClick={() => handleBulkJobDecision('reject')}
                    className="font-bold rounded-md bg-critical-tint text-critical px-2.5 py-1.5 disabled:opacity-50"
                  >
                    Từ chối tất cả đã chọn
                  </button>
                </div>
              )}
            </div>
            {pendingJobs.length === 0 ? (
              <div className="text-center text-ink-faint text-sm py-16">Không có tin nào đang chờ duyệt 🎉</div>
            ) : (
              <div className="rounded-xl bg-white border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-ink-faint bg-surface-alt">
                        <th className="py-2.5 px-3 w-8">
                          <input
                            type="checkbox"
                            checked={selectedJobIds.size > 0 && selectedJobIds.size === pendingJobs.length}
                            onChange={toggleAllJobsSelected}
                          />
                        </th>
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
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={selectedJobIds.has(job.id)}
                              onChange={() => toggleJobSelected(job.id)}
                            />
                          </td>
                          <td className="py-3 px-4 font-bold">
                            {job.title}
                            {/* Đợt 15 (25/09/2026) — nhãn phân biệt tin đã được TỰ ĐỘNG duyệt (còn
                                chờ Admin kiểm tra lần 2) với tin CHƯA duyệt (đang chờ) — theo lựa
                                chọn người dùng qua AskUserQuestion: "Có, nhãn riêng". */}
                            {job.autoApproved && !job.adminReviewed && (
                              <div className="mt-1.5">
                                <span className="font-semibold text-[10px] rounded-full bg-success-tint text-success px-2 py-0.5">
                                  ✓ Đã tự động duyệt — chờ kiểm tra
                                </span>
                              </div>
                            )}
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
                          <td className="py-3 px-3 tabular-nums whitespace-nowrap">{formatDate(job.updatedAt ?? job.createdAt)}</td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <a
                              href={`/admin/xem-tin/${job.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block text-[11px] font-bold rounded-md bg-surface-alt text-ink px-2.5 py-1.5 mr-1.5"
                            >
                              Xem trước
                            </a>
                            {job.autoApproved && !job.adminReviewed ? (
                              // Đợt 15 — tin này ĐÃ được duyệt (tự động), không cần nút "Duyệt" nữa;
                              // "Tin đã kiểm tra" chỉ ẩn dòng khỏi danh sách, không đổi trạng thái.
                              // Vẫn giữ "Từ chối" phòng khi Admin kiểm tra lại thấy nội dung có vấn đề.
                              <button
                                disabled={busyId === job.id}
                                onClick={() => handleMarkReviewed(job.id)}
                                className="text-[11px] font-bold rounded-md bg-primary text-white px-2.5 py-1.5 mr-1.5 disabled:opacity-50"
                              >
                                Tin đã kiểm tra
                              </button>
                            ) : (
                              <button
                                disabled={busyId === job.id}
                                onClick={() => handleJobApprove(job.id)}
                                className="text-[11px] font-bold rounded-md bg-success-tint text-success px-2.5 py-1.5 mr-1.5 disabled:opacity-50"
                              >
                                Duyệt
                              </button>
                            )}
                            {/* Đợt 12x — Từ chối giờ bắt buộc chọn lý do, không còn là 1 click ở
                                bảng này nữa: đưa sang trang Xem trước có modal chọn lý do. */}
                            <a
                              href={`/admin/xem-tin/${job.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block text-[11px] font-bold rounded-md bg-critical-tint text-critical px-2.5 py-1.5"
                            >
                              Từ chối
                            </a>
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
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h1 className="font-bold text-base">Hàng chờ duyệt công ty</h1>
              {selectedCompanyIds.size > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-ink-faint font-semibold">Đã chọn {selectedCompanyIds.size}</span>
                  <button
                    disabled={bulkBusy}
                    onClick={() => handleBulkCompanyDecision('approve')}
                    className="font-bold rounded-md bg-success-tint text-success px-2.5 py-1.5 disabled:opacity-50"
                  >
                    Duyệt tất cả đã chọn
                  </button>
                  <button
                    disabled={bulkBusy}
                    onClick={() => handleBulkCompanyDecision('reject')}
                    className="font-bold rounded-md bg-critical-tint text-critical px-2.5 py-1.5 disabled:opacity-50"
                  >
                    Từ chối tất cả đã chọn
                  </button>
                </div>
              )}
            </div>
            {pendingCompanies.length === 0 ? (
              <div className="text-center text-ink-faint text-sm py-16">Không có công ty nào đang chờ duyệt 🎉</div>
            ) : (
              <div className="rounded-xl bg-white border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-ink-faint bg-surface-alt">
                        <th className="py-2.5 px-3 w-8">
                          <input
                            type="checkbox"
                            checked={selectedCompanyIds.size > 0 && selectedCompanyIds.size === pendingCompanies.length}
                            onChange={toggleAllCompaniesSelected}
                          />
                        </th>
                        <th className="py-2.5 px-4 font-semibold">Tên công ty</th>
                        <th className="py-2.5 px-3 font-semibold">Mã số thuế</th>
                        <th className="py-2.5 px-3 font-semibold">Ngành nghề</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingCompanies.map((c) => (
                        <tr key={c.id} className="border-t border-border">
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={selectedCompanyIds.has(c.id)}
                              onChange={() => toggleCompanySelected(c.id)}
                            />
                          </td>
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
        ) : tab === 'featured' ? (
          <FeaturedEmployersCard token={token} />
        ) : tab === 'sourced' ? (
          <SourcedCompaniesCard token={token} />
        ) : tab === 'stats' ? (
          <StatsCard token={token} />
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
        ) : tab === 'audit-log' ? (
          <AuditLogCard token={token} />
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
      <div className="text-2xl font-extrabold tabular-nums">{formatNumber(value)}</div>
      <div className="text-xs text-ink-faint mt-1">{label}</div>
    </div>
  );
}

// Đợt 12q (21/09/2026) — Batch 5 mục #1 "Bật/tắt Doanh nghiệp yêu thích qua Admin UI": trước đây cờ
// isFeaturedEmployer chỉ sửa được thẳng trong CSDL. Tìm công ty theo tên (mọi trạng thái duyệt) rồi
// bật/tắt — cờ này quyết định huy hiệu + bộ lọc "Nhà tuyển dụng nổi bật" ở trang tìm việc công khai.
function FeaturedEmployersCard({ token }: { token: string }) {
  const [q, setQ] = useState('');
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await adminApi.searchCompanies(token, q);
      setCompanies(rows);
    } finally {
      setLoading(false);
    }
  }, [token, q]);

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggle(id: string) {
    setBusyId(id);
    try {
      const updated = await adminApi.toggleFeaturedEmployer(token, id);
      setCompanies((prev) => prev?.map((c) => (c.id === id ? updated : c)) ?? prev);
    } finally {
      setBusyId(null);
    }
  }

  // Đợt 16 (25/09/2026) — mục 22b danh sách lỗi: dùng chung màn hình tìm công ty theo tên (đã có sẵn
  // cho việc bật/tắt "Doanh nghiệp yêu thích") để thêm công cụ "tìm & gán logo" thủ công — theo yêu
  // cầu người dùng ("tìm theo tên công ty giúp tôi nếu tìm ra được logo của công ty đó thì thêm vào
  // luôn"). Công ty chưa dán logoUrl thủ công đang tự động hiện favicon theo website (mục 22a) —
  // dùng ô này để thay bằng logo thật đẹp hơn khi cần.
  async function handleSaveLogo(id: string, logoUrl: string) {
    setBusyId(id);
    try {
      const updated = await adminApi.updateCompanyLogo(token, id, logoUrl);
      setCompanies((prev) => prev?.map((c) => (c.id === id ? updated : c)) ?? prev);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <h1 className="font-bold text-base mb-1">Doanh nghiệp yêu thích &amp; Logo công ty</h1>
      <div className="text-xs text-ink-faint mb-4 max-w-2xl">
        Công ty được đánh dấu &ldquo;yêu thích&rdquo; sẽ hiện huy hiệu &ldquo;Nhà tuyển dụng nổi bật&rdquo; và xuất
        hiện trong bộ lọc cùng tên ở trang tìm việc công khai. Công ty chưa có logo sẽ tự động hiện favicon theo
        website đã lưu (nếu có) — dùng nút &ldquo;Tìm ảnh&rdquo; bên dưới để mở tìm logo thật trên Google Images
        rồi dán URL vào ô, bấm Lưu để thay bằng logo đẹp hơn.
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="flex gap-2 mb-4 max-w-md"
      >
        <input
          type="text"
          placeholder="Tìm theo tên công ty…"
          className="tvl-input text-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" disabled={loading} className="tvl-btn-primary !w-auto px-4 whitespace-nowrap">
          Tìm
        </button>
      </form>
      {loading ? (
        <div className="text-center text-ink-faint py-10 text-sm">Đang tải…</div>
      ) : !companies || companies.length === 0 ? (
        <div className="text-center text-ink-faint text-sm py-10">Không tìm thấy công ty nào.</div>
      ) : (
        <div className="rounded-xl bg-white border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink-faint bg-surface-alt">
                  <th className="py-2.5 px-4 font-semibold">Tên công ty</th>
                  <th className="py-2.5 px-3 font-semibold">Ngành nghề</th>
                  <th className="py-2.5 px-3 font-semibold">Trạng thái duyệt</th>
                  <th className="py-2.5 px-3 font-semibold">Logo</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-t border-border align-top">
                    <td className="py-3 px-4 font-bold">
                      {c.name}
                      {c.isFeaturedEmployer && (
                        <span className="ml-2 text-[10px] font-bold rounded-full bg-warning-tint text-warning px-2 py-0.5">
                          🌟 Yêu thích
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-ink-faint">{c.industry ?? '—'}</td>
                    <td className="py-3 px-3 text-ink-faint">{c.approvalStatus ?? '—'}</td>
                    <td className="py-3 px-3">
                      <CompanyLogoEditor
                        company={c}
                        busy={busyId === c.id}
                        onSave={(url) => handleSaveLogo(c.id, url)}
                      />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        disabled={busyId === c.id}
                        onClick={() => handleToggle(c.id)}
                        className={`text-[11px] font-bold rounded-md px-2.5 py-1.5 disabled:opacity-50 ${
                          c.isFeaturedEmployer ? 'bg-critical-tint text-critical' : 'bg-success-tint text-success'
                        }`}
                      >
                        {c.isFeaturedEmployer ? 'Bỏ đánh dấu' : 'Đánh dấu yêu thích'}
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
  );
}

// Đợt 16 (25/09/2026) — mục 22b: ô sửa logo riêng cho từng dòng công ty (state input tách biệt khỏi
// danh sách chính để gõ URL không làm re-render/mất focus cả bảng). Nút "Tìm ảnh" mở tìm kiếm Google
// Images theo ĐÚNG tên công ty ở tab mới — Admin tự xem & chọn ảnh phù hợp, copy URL ảnh rồi dán vào
// ô bên dưới (không tự động tải/xác nhận thay Admin vì cần con người kiểm tra đúng logo thật).
function CompanyLogoEditor({
  company,
  busy,
  onSave,
}: {
  company: Company;
  busy: boolean;
  onSave: (logoUrl: string) => void;
}) {
  const [value, setValue] = useState(company.logoUrl ?? '');

  useEffect(() => {
    setValue(company.logoUrl ?? '');
  }, [company.logoUrl]);

  const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${company.name} logo`)}`;

  return (
    <div className="flex items-center gap-2 min-w-[220px]">
      <CompanyLogo name={company.name} logoUrl={company.logoUrl} size={28} className="text-[9px] shrink-0" />
      <div className="flex flex-col gap-1 flex-1">
        <input
          type="text"
          placeholder="Dán URL ảnh logo…"
          className="tvl-input text-[11px] !py-1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <a
            href={searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10.5px] font-semibold text-primary hover:underline"
          >
            🔍 Tìm ảnh
          </a>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(value)}
            className="text-[10.5px] font-bold rounded-md px-2 py-1 bg-primary-tint text-primary disabled:opacity-50"
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Đợt 17 (25/09/2026) — "Nguồn ngoài / Tin tổng hợp" (mô hình "labeled aggregator") =====
// Admin tự tạo hồ sơ công ty + tài khoản NTD nháp + đăng tin hộ từ các trang tuyển dụng khác
// (careerviet.vn, vietnamworks.com, glints.com, itviec.com, viecoi.vn, lamthem.com.vn, nhóm Facebook…)
// để tăng lượng tin ngay từ đầu — mọi công ty/tin loại này hiện công khai NGAY kèm badge "Tin tổng
// hợp — chưa xác thực" cho tới khi công ty thật "nhận lại" (claim). 3 khối trong tab này: (1) tạo công
// ty nguồn ngoài mới, (2) danh sách công ty nguồn ngoài (quản lý tin + chuyển giao thủ công), (3) hàng
// chờ yêu cầu công khai "Đây là công ty của bạn?".
function SourcedCompaniesCard({ token }: { token: string }) {
  const [q, setQ] = useState('');
  const [claimedFilter, setClaimedFilter] = useState<'unclaimed' | 'claimed' | 'all'>('unclaimed');
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [claimRequests, setClaimRequests] = useState<CompanyClaimRequestRow[] | null>(null);
  const [claimRequestsLoading, setClaimRequestsLoading] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const claimed = claimedFilter === 'all' ? undefined : claimedFilter === 'claimed';
      const rows = await adminApi.listSourcedCompanies(token, q, claimed);
      setCompanies(rows);
    } finally {
      setLoading(false);
    }
  }, [token, q, claimedFilter]);

  const loadClaimRequests = useCallback(async () => {
    setClaimRequestsLoading(true);
    try {
      const rows = await adminApi.listClaimRequests(token, 'pending');
      setClaimRequests(rows);
    } finally {
      setClaimRequestsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    search();
  }, [search]);

  useEffect(() => {
    loadClaimRequests();
  }, [loadClaimRequests]);

  return (
    <>
      <h1 className="font-bold text-base mb-1">Nguồn ngoài &amp; Tin tổng hợp</h1>
      <div className="text-xs text-ink-faint mb-4 max-w-2xl">
        Tạo hồ sơ công ty + đăng tin hộ từ các trang tuyển dụng khác để tăng lượng tin ngay từ đầu. Mọi công ty/tin
        loại này hiện công khai NGAY kèm badge &ldquo;Tin tổng hợp — chưa xác thực&rdquo; cho tới khi công ty thật
        &ldquo;nhận lại&rdquo; tài khoản (chuyển giao thủ công bên dưới, hoặc duyệt yêu cầu &ldquo;Đây là công ty của
        bạn?&rdquo; công khai ở trang công ty).
      </div>

      <div className="rounded-xl bg-white border border-border p-4 mb-4">
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="text-xs font-bold text-primary"
        >
          {showCreateForm ? '▾ Ẩn form tạo công ty mới' : '▸ + Tạo công ty nguồn ngoài mới'}
        </button>
        {showCreateForm && (
          <CreateDraftCompanyForm
            token={token}
            onCreated={(company) => {
              setShowCreateForm(false);
              setSelectedId(company.id);
              search();
            }}
          />
        )}
      </div>

      {claimRequests && claimRequests.length > 0 && (
        <ClaimRequestsQueue
          token={token}
          requests={claimRequests}
          loading={claimRequestsLoading}
          onResolved={() => {
            loadClaimRequests();
            search();
          }}
        />
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          className="flex gap-2 max-w-md flex-1"
        >
          <input
            type="text"
            placeholder="Tìm theo tên công ty…"
            className="tvl-input text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit" disabled={loading} className="tvl-btn-primary !w-auto px-4 whitespace-nowrap">
            Tìm
          </button>
        </form>
        <div className="flex gap-1.5 text-xs">
          {(
            [
              ['unclaimed', 'Chưa xác thực'],
              ['claimed', 'Đã xác thực'],
              ['all', 'Tất cả'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setClaimedFilter(key)}
              className={`px-3 py-1.5 rounded-lg font-bold ${
                claimedFilter === key ? 'bg-primary text-white' : 'bg-surface-alt text-ink-faint'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-ink-faint py-10 text-sm">Đang tải…</div>
      ) : !companies || companies.length === 0 ? (
        <div className="text-center text-ink-faint text-sm py-10">Chưa có công ty nguồn ngoài nào.</div>
      ) : (
        <div className="rounded-xl bg-white border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink-faint bg-surface-alt">
                  <th className="py-2.5 px-4 font-semibold">Tên công ty</th>
                  <th className="py-2.5 px-3 font-semibold">Nguồn</th>
                  <th className="py-2.5 px-3 font-semibold">Số tin</th>
                  <th className="py-2.5 px-3 font-semibold">Trạng thái</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-t border-border align-top">
                    <td className="py-3 px-4 font-bold">
                      <div className="flex items-center gap-2">
                        <CompanyLogo name={c.name} logoUrl={c.logoUrl} size={24} className="text-[9px] shrink-0" />
                        {c.name}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-ink-faint">{c.sourceLabel ?? '—'}</td>
                    <td className="py-3 px-3 tabular-nums">{c.jobCount ?? 0}</td>
                    <td className="py-3 px-3">
                      {c.claimedAt ? (
                        <span className="font-semibold text-[10px] rounded-full bg-success-tint text-success px-2 py-0.5">
                          ✓ Đã xác thực
                        </span>
                      ) : (
                        <span className="font-semibold text-[10px] rounded-full bg-warning-tint text-warning px-2 py-0.5">
                          ⚠ Chưa xác thực
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedId(c.id)}
                        className="text-[11px] font-bold rounded-md bg-primary-tint text-primary px-2.5 py-1.5"
                      >
                        Quản lý
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedId && (
        <CompanyDetailPanel
          token={token}
          companyId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={search}
        />
      )}
    </>
  );
}

// Form tạo công ty "chưa xác thực" + tài khoản NTD nháp — tài khoản này CHƯA gửi cho ai, chỉ để Admin
// tự đăng tin hộ (xem ghi chú AdminService.createDraftCompany() ở backend).
function CreateDraftCompanyForm({ token, onCreated }: { token: string; onCreated: (company: Company) => void }) {
  const [form, setForm] = useState<CreateDraftCompanyPayload>({ name: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ company: Company; draftAccount: DraftAccountInfo } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await adminApi.createDraftCompany(token, form);
      setResult(res);
      onCreated(res.company);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể tạo công ty');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="mt-3 rounded-lg bg-warning-tint text-warning text-xs font-semibold px-3.5 py-2.5">
        Đã tạo công ty &ldquo;{result.company.name}&rdquo;. Tài khoản tạm: <span className="font-mono">{result.draftAccount.email}</span>{' '}
        / mật khẩu: <span className="font-mono">{result.draftAccount.tempPassword}</span>
        <br />
        {result.draftAccount.note}
        <br />
        <button
          type="button"
          onClick={() => setResult(null)}
          className="mt-2 text-[11px] font-bold underline"
        >
          Tạo công ty khác
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid sm:grid-cols-2 gap-2.5 text-xs">
      <input
        required
        placeholder="Tên công ty *"
        className="tvl-input text-sm sm:col-span-2"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
      />
      <input
        placeholder="Nguồn (VD: Tổng hợp từ careerviet.vn)"
        className="tvl-input text-sm sm:col-span-2"
        value={form.sourceLabel ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, sourceLabel: e.target.value }))}
      />
      <select
        className="tvl-input text-sm"
        value={form.industry ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value || undefined }))}
      >
        <option value="">Ngành nghề…</option>
        {INDUSTRIES.map((i) => (
          <option key={i} value={i}>{i}</option>
        ))}
      </select>
      <input
        placeholder="Quy mô (VD: 100-499 nhân viên)"
        className="tvl-input text-sm"
        value={form.size ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
      />
      <input
        placeholder="Website"
        className="tvl-input text-sm"
        value={form.website ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
      />
      <input
        placeholder="URL logo (không bắt buộc)"
        className="tvl-input text-sm"
        value={form.logoUrl ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
      />
      <textarea
        placeholder="Giới thiệu công ty (không bắt buộc)"
        className="tvl-input text-sm sm:col-span-2"
        rows={2}
        value={form.description ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
      />
      {error && <div className="text-critical font-semibold sm:col-span-2">{error}</div>}
      <button type="submit" disabled={busy} className="tvl-btn-primary !w-auto px-5 sm:col-span-2 self-start">
        Tạo công ty
      </button>
    </form>
  );
}

// Hàng chờ yêu cầu công khai "Đây là công ty của bạn?" — Admin xác minh NGOÀI hệ thống (điện
// thoại/Zalo/giấy tờ) rồi mới Duyệt (chuyển giao) hoặc Từ chối.
function ClaimRequestsQueue({
  token,
  requests,
  loading,
  onResolved,
}: {
  token: string;
  requests: CompanyClaimRequestRow[];
  loading: boolean;
  onResolved: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await adminApi.approveClaimRequest(token, id);
      onResolved();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Không thể duyệt yêu cầu này');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    const note = window.prompt('Lý do từ chối (không bắt buộc):') ?? undefined;
    setBusyId(id);
    try {
      await adminApi.rejectClaimRequest(token, id, { adminNote: note });
      onResolved();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-xl bg-white border border-border p-4 mb-4">
      <div className="font-bold text-sm mb-1">
        Yêu cầu &ldquo;Đây là công ty của bạn?&rdquo; đang chờ ({requests.length})
      </div>
      <div className="text-[11px] text-ink-faint mb-3">
        Vui lòng xác minh thông tin người gửi ngoài hệ thống (gọi điện/email công ty thật) trước khi Duyệt.
      </div>
      {loading ? (
        <div className="text-center text-ink-faint text-xs py-4">Đang tải…</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 flex-wrap border-t border-border pt-2.5 text-xs">
              <div>
                <div className="font-bold">{r.company?.name ?? '—'}</div>
                <div className="text-ink-faint">
                  {r.requesterName} · {r.requesterEmail}
                  {r.requesterPhone ? ` · ${r.requesterPhone}` : ''}
                </div>
                {r.note && <div className="text-ink-faint italic mt-0.5">&ldquo;{r.note}&rdquo;</div>}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  disabled={busyId === r.id}
                  onClick={() => handleApprove(r.id)}
                  className="text-[11px] font-bold rounded-md bg-success-tint text-success px-2.5 py-1.5 disabled:opacity-50"
                >
                  Duyệt (chuyển giao)
                </button>
                <button
                  disabled={busyId === r.id}
                  onClick={() => handleReject(r.id)}
                  className="text-[11px] font-bold rounded-md bg-critical-tint text-critical px-2.5 py-1.5 disabled:opacity-50"
                >
                  Từ chối
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Panel quản lý 1 công ty nguồn ngoài: thông tin + chuyển giao thủ công + danh sách tin + thêm tin.
function CompanyDetailPanel({
  token,
  companyId,
  onClose,
  onChanged,
}: {
  token: string;
  companyId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<{ company: Company; jobs: JobPosting[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddJob, setShowAddJob] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSourcedCompanyDetail(token, companyId);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [token, companyId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center overflow-y-auto py-8 px-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-sm">{data?.company.name ?? 'Đang tải…'}</div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink text-lg leading-none">✕</button>
        </div>

        {loading || !data ? (
          <div className="text-center text-ink-faint text-sm py-10">Đang tải…</div>
        ) : (
          <>
            <div className="text-xs text-ink-faint mb-3">
              Nguồn: {data.company.sourceLabel ?? '—'} ·{' '}
              {data.company.claimedAt ? (
                <span className="text-success font-semibold">✓ Đã xác thực ({formatDate(data.company.claimedAt)})</span>
              ) : (
                <span className="text-warning font-semibold">⚠ Chưa xác thực</span>
              )}
            </div>

            {!data.company.claimedAt && (
              <div className="rounded-lg border border-border p-3 mb-4">
                <button
                  type="button"
                  onClick={() => setShowClaimForm((v) => !v)}
                  className="text-xs font-bold text-primary"
                >
                  {showClaimForm ? '▾ Ẩn form chuyển giao' : '▸ Chuyển giao thủ công (đã xác minh ngoài hệ thống)'}
                </button>
                {showClaimForm && (
                  <ClaimCompanyForm
                    token={token}
                    companyId={companyId}
                    onClaimed={() => {
                      setShowClaimForm(false);
                      load();
                      onChanged();
                    }}
                  />
                )}
              </div>
            )}

            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-xs">Tin đăng ({data.jobs.length})</div>
              <button
                type="button"
                onClick={() => setShowAddJob((v) => !v)}
                className="text-[11px] font-bold text-primary"
              >
                {showAddJob ? '▾ Ẩn form thêm tin' : '▸ + Thêm tin mới'}
              </button>
            </div>

            {showAddJob && (
              <AddJobForm
                token={token}
                companyId={companyId}
                onCreated={() => {
                  setShowAddJob(false);
                  load();
                  onChanged();
                }}
              />
            )}

            {data.jobs.length === 0 ? (
              <div className="text-center text-ink-faint text-xs py-6 border border-dashed border-border rounded-lg">
                Chưa có tin nào — dùng form phía trên để thêm.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 mt-2">
                {data.jobs.map((j) => (
                  <div key={j.id} className="flex items-center justify-between gap-2 text-xs border-t border-border pt-1.5">
                    <span className="font-semibold truncate">{j.title}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-ink-faint">{formatSalary(j.salaryMin, j.salaryMax)}</span>
                      {/* Đợt 17e — trước đây dòng tin ở đây chỉ hiển thị, không có cách nào sửa các
                          trường (lương/địa điểm/hình thức/hạn nộp/...) của tin đã cào từ nguồn ngoài
                          ngay trong màn "Quản lý" công ty.
                          Đợt 17f — theo lựa chọn người dùng: bấm vào tin phải ra trang XEM đầy đủ,
                          đúng bố cục thật, MỖI khối nội dung có nút Sửa riêng cạnh khối đó — không
                          nhảy thẳng vào form sửa chung nữa (đổi từ /admin/sua-tin sang /admin/xem-tin). */}
                      <a
                        href={`/admin/xem-tin/${j.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-[11px] font-bold rounded-md bg-surface-alt text-ink px-2 py-1"
                      >
                        👁️ Xem / Sửa
                      </a>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// "Chuyển giao thủ công": Admin đã tự xác minh công ty thật ngoài hệ thống (điện thoại/Zalo), nhập
// email thật để đổi email đăng nhập + đặt lại mật khẩu tạm — báo cho công ty qua kênh ngoài hệ thống.
function ClaimCompanyForm({
  token,
  companyId,
  onClaimed,
}: {
  token: string;
  companyId: string;
  onClaimed: () => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DraftAccountInfo | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await adminApi.claimCompany(token, companyId, {
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        taxCode: taxCode.trim() || undefined,
      });
      setResult(res.account);
      onClaimed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể chuyển giao');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="mt-3 rounded-lg bg-warning-tint text-warning text-xs font-semibold px-3.5 py-2.5">
        Đã chuyển giao. Tài khoản: <span className="font-mono">{result.email}</span> / mật khẩu tạm:{' '}
        <span className="font-mono">{result.tempPassword}</span>
        <br />
        Chỉ hiển thị 1 lần — hãy báo ngay cho công ty qua kênh ngoài hệ thống.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid sm:grid-cols-2 gap-2.5 text-xs">
      <input
        required
        type="email"
        placeholder="Email thật của công ty *"
        className="tvl-input text-sm sm:col-span-2"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        placeholder="Họ tên người đại diện"
        className="tvl-input text-sm"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <input
        placeholder="Số điện thoại"
        className="tvl-input text-sm"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <input
        placeholder="Mã số thuế thật (không bắt buộc ngay)"
        className="tvl-input text-sm sm:col-span-2"
        value={taxCode}
        onChange={(e) => setTaxCode(e.target.value)}
      />
      {error && <div className="text-critical font-semibold sm:col-span-2">{error}</div>}
      <button type="submit" disabled={busy} className="tvl-btn-primary !w-auto px-5 sm:col-span-2 self-start">
        Chuyển giao ngay
      </button>
    </form>
  );
}

// Đợt 17c (25/09/2026) — "Dán nhanh" nội dung copy từ nhóm Facebook. Facebook nhóm bắt buộc đăng
// nhập + render bằng JavaScript + chặn truy cập tự động + không có dữ liệu chuẩn hoá (schema.org) như
// các trang tuyển dụng khác — nên KHÔNG thể tự động trích xuất như "Cách 1" (đã trao đổi + xác nhận
// với người dùng). Người dùng tự copy nguyên bài đăng Facebook, dán vào đây — hệ thống chỉ hỗ trợ
// TÁCH NHANH theo từ khoá tiếng Việt thường gặp (Mô tả công việc/Yêu cầu/Quyền lợi/Địa điểm/Liên hệ),
// không phải phân tích ngữ nghĩa — Admin luôn xem/sửa lại ở "Cách 3" bên dưới trước khi lưu. Theo
// AskUserQuestion: ảnh Facebook KHÔNG xử lý ở đợt này (người dùng chọn "Bỏ qua ảnh, chỉ cần chữ").
type QuickPasteField = 'description' | 'requirements' | 'benefits' | 'address' | 'contactNote';

// Mỗi từ khoá 1 regex riêng (không gộp thành 1 alternation) để khi so khớp 1 dòng, có thể chọn đúng
// từ khoá DÀI NHẤT khớp được (VD "Mô tả công việc:" phải nhận đúng cả cụm, không dừng ở "Mô tả:" rồi
// để sót " công việc:" lẫn vào nội dung) — xem logic chọn `bestPrefixLen` trong quickParseFacebookPost().
const QUICK_PASTE_KEYWORDS: { field: QuickPasteField; regex: RegExp }[] = [
  { field: 'description', regex: /^[^A-Za-zÀ-ỹ]*mô tả công việc[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'description', regex: /^[^A-Za-zÀ-ỹ]*mô tả[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'description', regex: /^[^A-Za-zÀ-ỹ]*công việc chính[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'description', regex: /^[^A-Za-zÀ-ỹ]*nhiệm vụ[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'requirements', regex: /^[^A-Za-zÀ-ỹ]*yêu cầu ứng viên[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'requirements', regex: /^[^A-Za-zÀ-ỹ]*yêu cầu công việc[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'requirements', regex: /^[^A-Za-zÀ-ỹ]*yêu cầu[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'benefits', regex: /^[^A-Za-zÀ-ỹ]*quyền lợi[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'benefits', regex: /^[^A-Za-zÀ-ỹ]*phúc lợi[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'benefits', regex: /^[^A-Za-zÀ-ỹ]*chế độ đãi ngộ[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'benefits', regex: /^[^A-Za-zÀ-ỹ]*chế độ[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'address', regex: /^[^A-Za-zÀ-ỹ]*địa điểm làm việc[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'address', regex: /^[^A-Za-zÀ-ỹ]*địa điểm[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'address', regex: /^[^A-Za-zÀ-ỹ]*nơi làm việc[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'address', regex: /^[^A-Za-zÀ-ỹ]*địa chỉ làm việc[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'address', regex: /^[^A-Za-zÀ-ỹ]*địa chỉ[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'contactNote', regex: /^[^A-Za-zÀ-ỹ]*thông tin liên hệ[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'contactNote', regex: /^[^A-Za-zÀ-ỹ]*liên hệ[\s*_]*:?[ \t]*(.*)$/i },
  { field: 'contactNote', regex: /^[^A-Za-zÀ-ỹ]*liên lạc[\s*_]*:?[ \t]*(.*)$/i },
];

// Giống toRichTextHtml() ở backend (job-url-extractor.util.ts) — mỗi dòng nguồn → 1 đoạn <p>, tương
// thích thẳng với RichTextEditor. Không cần giải mã thực thể HTML ở đây vì nội dung dán vào là text
// thuần từ clipboard (trình duyệt tự giải mã sẵn khi copy từ Facebook), khác trường hợp JSON-LD thô.
function wrapParagraphs(lines: string[]): string {
  const cleaned = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (cleaned.length === 0) return '';
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return cleaned.map((l) => `<p>${esc(l)}</p>`).join('');
}

// Đợt 17d (25/09/2026) — bổ sung theo yêu cầu người dùng (đã hỏi rõ qua AskUserQuestion, chọn "Có, tự
// dò best-effort"): số tiền lương thường nằm lẫn trong đoạn Phúc lợi dạng văn xuôi khi copy từ Facebook
// (VD "Thu nhập: 15 - 18 triệu theo năng lực") chứ không có ô riêng — tự dò theo mẫu câu tiếng Việt
// thường gặp. Số dò được (VD "15") đã đúng đơn vị triệu sẵn — xem quy ước ở normalizeSalaryAmount()
// (lib/format.ts) — không cần nhân/chia gì thêm. Giống hệt logic phía backend (job-url-extractor.util.ts
// extractSalaryFromText()) — 2 nơi khác gói (apps/web/apps/api) nên không dùng chung được 1 file.
function extractSalaryFromLines(lines: string[]): { min?: number; max?: number } {
  const text = lines.join(' ');
  const rangeMatch = text.match(/(\d{1,3})\s*(?:triệu|tr)?\s*(?:-|–|~|đến)\s*(\d{1,3})\s*(?:triệu|tr\b)/i);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (min > 0 || max > 0) return { min: min || undefined, max: max || undefined };
  }
  const singleMatch = text.match(/(\d{1,3})\s*(?:triệu|tr\b)/i);
  if (singleMatch) {
    const v = Number(singleMatch[1]);
    if (v > 0) return { min: v, max: v };
  }
  return {};
}

function quickParseFacebookPost(raw: string): {
  title?: string;
  description?: string;
  requirements?: string;
  benefits?: string;
  address?: string;
  contactNote?: string;
  salaryMin?: number;
  salaryMax?: number;
} {
  const lines = raw.split(/\r\n|\r|\n/);
  const buckets: Record<QuickPasteField, string[]> = {
    description: [],
    requirements: [],
    benefits: [],
    address: [],
    contactNote: [],
  };
  const intro: string[] = [];
  let current: QuickPasteField | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let best: { field: QuickPasteField; content: string } | null = null;
    let bestPrefixLen = -1;
    for (const { field, regex } of QUICK_PASTE_KEYWORDS) {
      const m = regex.exec(line);
      if (!m) continue;
      const content = (m[1] ?? '').trim();
      const prefixLen = line.length - content.length;
      if (prefixLen > bestPrefixLen) {
        bestPrefixLen = prefixLen;
        best = { field, content };
      }
    }

    if (best) {
      current = best.field;
      if (best.content) buckets[current].push(best.content);
      continue;
    }

    if (current) buckets[current].push(line);
    else intro.push(line);
  }

  // Dòng đầu tiên trước mọi tiêu đề mục = chức danh; các dòng còn lại trước tiêu đề đầu tiên (nếu có)
  // ghép vào đầu phần Mô tả công việc (đoạn giới thiệu mở đầu bài Facebook thường không có tiêu đề rõ).
  const title = intro[0];
  if (intro.length > 1) buckets.description = [...intro.slice(1), ...buckets.description];

  // Dò lương trên TOÀN BỘ nội dung dán vào (không chỉ riêng phần Quyền lợi) — số tiền có thể nằm ở
  // Mô tả công việc hoặc dòng mở đầu tuỳ cách viết của từng bài đăng.
  const salary = extractSalaryFromLines(lines.map((l) => l.trim()).filter((l) => l.length > 0));

  return {
    title,
    description: wrapParagraphs(buckets.description) || undefined,
    requirements: wrapParagraphs(buckets.requirements) || undefined,
    benefits: wrapParagraphs(buckets.benefits) || undefined,
    address: buckets.address.join(', ') || undefined,
    contactNote: wrapParagraphs(buckets.contactNote) || undefined,
    salaryMin: salary.min,
    salaryMax: salary.max,
  };
}

// Form thêm tin cho công ty — 3 cách nhập nội dung (theo lựa chọn người dùng qua AskUserQuestion):
// (1) dán URL trang gốc → trích xuất tự động (best-effort, luôn xem lại trước khi lưu),
// (2) dán nhanh nội dung copy từ Facebook → tự tách mục (best-effort, xem hàm quickParseFacebookPost),
// (3) nhập tay / kiểm tra lại rồi lưu.
// Tin được lưu bằng adminApi.createJobForCompany() hiện CÔNG KHAI NGAY (không qua hàng đợi duyệt).
// Đợt 17h (25/09/2026) — theo yêu cầu người dùng ("3 giao diện phải giống hệt trang Đăng tin NTD"),
// "Cách 3" đổi từ form rút gọn tự viết (Đợt 17g) sang DÙNG CHUNG wizard 4 Bước `JobWizardSteps` y hệt
// wizard Đăng tin NTD / form Sửa tin Admin. "Cách 1" (trích xuất URL) và "Cách 2" (dán nhanh Facebook)
// giữ nguyên phía trên, chỉ đổi state đích từ `CreateJobPayload` (số) sang `JobWizardFormState` (chuỗi,
// giống 2 form kia) — quy đổi kiểu dữ liệu ngay trong handleExtract/handleQuickPaste bên dưới.
function guessProvincesFromText(text: string): { provinces: string[]; leftover?: string } {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, ''); // bỏ dấu để so khớp (giống scanJobContent() ở lib/content-moderation.ts)
  const normalizedText = normalize(text);
  // Vài cách viết tắt thường gặp khi copy từ tin tuyển dụng/Facebook.
  const aliasMap: Record<string, string> = {
    'tphcm': 'Hồ Chí Minh',
    'tp.hcm': 'Hồ Chí Minh',
    'tp hcm': 'Hồ Chí Minh',
    'hcm': 'Hồ Chí Minh',
    'sai gon': 'Hồ Chí Minh',
    'sg': 'Hồ Chí Minh',
    'hn': 'Hà Nội',
  };
  const found = new Set<string>();
  for (const p of PROVINCES) {
    if (normalizedText.includes(normalize(p))) found.add(p);
  }
  for (const [alias, province] of Object.entries(aliasMap)) {
    if (normalizedText.includes(alias)) found.add(province);
  }
  const provinces = Array.from(found);
  return provinces.length ? { provinces } : { provinces: [], leftover: text.trim() || undefined };
}

function AddJobForm({
  token,
  companyId,
  onCreated,
}: {
  token: string;
  companyId: string;
  onCreated: () => void;
}) {
  const [url, setUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractWarning, setExtractWarning] = useState('');
  const [quickPasteText, setQuickPasteText] = useState('');
  const [quickPasteDone, setQuickPasteDone] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<JobWizardFormState>(JOB_WIZARD_INITIAL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleQuickPaste() {
    if (!quickPasteText.trim()) return;
    const parsed = quickParseFacebookPost(quickPasteText);
    setForm((f) => ({
      ...f,
      title: parsed.title || f.title,
      description: parsed.description || f.description,
      requirements: parsed.requirements || f.requirements,
      benefits: parsed.benefits || f.benefits,
      address: parsed.address || f.address,
      contactNote: parsed.contactNote || f.contactNote,
      // Đợt 17d — số dò được từ text đã đúng đơn vị triệu, gán thẳng không cần quy đổi thêm.
      salaryMin: parsed.salaryMin != null ? String(parsed.salaryMin) : f.salaryMin,
      salaryMax: parsed.salaryMax != null ? String(parsed.salaryMax) : f.salaryMax,
    }));
    setQuickPasteDone(true);
  }

  async function handleExtract() {
    if (!url.trim()) return;
    setExtracting(true);
    setExtractWarning('');
    try {
      const res = await adminApi.extractJobFromUrl(token, url.trim());
      if (res.found) {
        // Đợt 17h — trang nguồn trả về "location" dạng text tự do (không có ô riêng), tự dò khớp với
        // danh mục Tỉnh/Thành best-effort; không khớp được thì để vào "Địa chỉ cụ thể" cho Admin tự sửa.
        const guess = res.data.location ? guessProvincesFromText(res.data.location) : null;
        setForm((f) => ({
          ...f,
          title: res.data.title || f.title,
          description: res.data.description || f.description,
          provinces: guess?.provinces.length ? guess.provinces : f.provinces,
          address: guess?.leftover ? guess.leftover : f.address,
          employmentType: res.data.employmentType || f.employmentType,
          salaryMin: res.data.salaryMin != null ? String(res.data.salaryMin) : f.salaryMin,
          salaryMax: res.data.salaryMax != null ? String(res.data.salaryMax) : f.salaryMax,
          // Đợt 17d — thêm "Hạn nộp" (schema.org validThrough), trước đó bỏ sót dù trang nguồn có sẵn.
          deadline: res.data.deadline || f.deadline,
        }));
        setSourceUrl(url.trim());
      } else {
        setSourceUrl(url.trim());
        setExtractWarning(res.warning ?? 'Không trích xuất được — vui lòng nhập tay bên dưới.');
      }
    } catch (err) {
      setExtractWarning(err instanceof ApiError ? err.message : 'Không tải được trang này.');
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmit() {
    if (!form.title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      // Đợt 17d — quy đổi lương ngay trước khi gửi (VD gõ nhầm 20000000 thay vì 20 → tự hiểu là 20
      // triệu). Đợt 17h — payload dựng từ JobWizardFormState, giống hệt cách 2 form kia (NTD đăng tin /
      // Admin sửa tin) đang làm — chỉ khác API gọi (createJobForCompany, hiện công khai ngay).
      const payload: CreateJobPayload = {
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
        salaryMin: form.negotiable || !form.salaryMin ? undefined : normalizeSalaryAmount(Number(form.salaryMin)),
        salaryMax: form.negotiable || !form.salaryMax ? undefined : normalizeSalaryAmount(Number(form.salaryMax)),
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
        sourceUrl,
      };
      await adminApi.createJobForCompany(token, companyId, payload);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể lưu tin');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-3 mb-4">
      <div className="text-[11px] font-bold text-ink-faint mb-1.5">Cách 1 — Dán URL trang gốc để trích xuất tự động</div>
      <div className="flex gap-2 mb-1.5">
        <input
          type="url"
          placeholder="https://..."
          className="tvl-input text-sm"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          type="button"
          disabled={extracting || !url.trim()}
          onClick={handleExtract}
          className="tvl-btn-primary !w-auto px-4 whitespace-nowrap disabled:opacity-50"
        >
          {extracting ? 'Đang lấy…' : 'Trích xuất'}
        </button>
      </div>
      {extractWarning && <div className="text-warning text-[11px] font-semibold mb-2">{extractWarning}</div>}

      {/* Đợt 17c (25/09/2026) — "Cách 2": dành riêng cho nội dung copy từ nhóm Facebook (không cào
          tự động được — xem ghi chú ở quickParseFacebookPost() phía trên). */}
      <div className="text-[11px] font-bold text-ink-faint mt-3 mb-1.5">
        Cách 2 — Dán nhanh nội dung copy từ Facebook (tự tách mục)
      </div>
      <div className="text-[11px] text-ink-faint mb-1.5">
        Copy nguyên bài đăng Facebook rồi dán vào đây — hệ thống tự nhận diện các mục thường gặp (Mô tả
        công việc / Yêu cầu / Quyền lợi / Địa điểm / Liên hệ) theo từ khoá và tự điền vào form &quot;Cách 3&quot;
        bên dưới. Đây chỉ là gợi ý tách nhanh, không phải AI đọc hiểu — <strong>luôn kiểm tra lại kỹ</strong>{' '}
        trước khi lưu. Ảnh trong bài đăng Facebook chưa hỗ trợ ở đây, xin tự upload logo/ảnh (nếu có) qua
        các nơi dán URL ảnh có sẵn.
      </div>
      <textarea
        placeholder={'Dán nguyên bài đăng Facebook vào đây...\n\nVD:\nTUYỂN NHÂN VIÊN KINH DOANH\nMô tả công việc:\n- Tìm kiếm khách hàng mới\nYêu cầu:\n- Tốt nghiệp Cao đẳng/Đại học\nQuyền lợi:\n- Lương thưởng hấp dẫn\nĐịa điểm: Quận 1, TP.HCM\nLiên hệ: 0909xxxxxx (Ms Hoa)'}
        className="tvl-input text-sm w-full"
        rows={6}
        value={quickPasteText}
        onChange={(e) => {
          setQuickPasteText(e.target.value);
          setQuickPasteDone(false);
        }}
      />
      <div className="flex items-center gap-2 mt-1.5 mb-1">
        <button
          type="button"
          disabled={!quickPasteText.trim()}
          onClick={handleQuickPaste}
          className="tvl-btn-primary !w-auto px-4 whitespace-nowrap disabled:opacity-50"
        >
          Tách nội dung ↓
        </button>
        {quickPasteDone && (
          <span className="text-success text-[11px] font-semibold">
            ✓ Đã điền vào form bên dưới — kiểm tra lại trước khi lưu.
          </span>
        )}
      </div>

      <div className="text-[11px] font-bold text-ink-faint mt-3 mb-1.5">
        Cách 3 — Kiểm tra lại/nhập tay rồi lưu (luôn xem lại nội dung trước khi đăng)
      </div>
      <JobWizardSteps
        form={form}
        setForm={setForm}
        step={step}
        setStep={setStep}
        error={error}
        submitting={busy}
        onSubmit={handleSubmit}
        submitLabel="Đăng tin (hiển thị công khai ngay) →"
        previewNote='Kiểm tra lại thông tin ở 3 bước trước — tin này do Admin tạo hộ nên hiển thị CÔNG KHAI NGAY, không qua hàng đợi chờ duyệt như tin NTD tự đăng.'
      />
    </div>
  );
}

// Đợt 12q (21/09/2026) — Batch 5 mục #3 "Biểu đồ dashboard theo thời gian": tự vẽ biểu đồ cột bằng
// div/CSS (height %) thay vì thêm thư viện chart ngoài (recharts/chart.js...) — dự án chưa có thư viện
// biểu đồ nào, thêm mới sẽ tăng bundle size chỉ cho 1 trang admin ít dùng. 4 chỉ số riêng biệt thay vì
// gộp 1 biểu đồ nhiều màu — dễ đọc hơn khi thang giá trị giữa các chỉ số chênh lệch nhiều.
const STATS_METRICS: { key: keyof AdminStatsPoint; label: string; barClass: string }[] = [
  { key: 'jobsPosted', label: 'Tin đăng mới', barClass: 'bg-primary' },
  { key: 'companiesRegistered', label: 'Công ty đăng ký mới', barClass: 'bg-info' },
  { key: 'candidatesRegistered', label: 'Ứng viên đăng ký mới', barClass: 'bg-success' },
  { key: 'applications', label: 'Đơn ứng tuyển mới', barClass: 'bg-warning' },
];

function StatsCard({ token }: { token: string }) {
  const [days, setDays] = useState(14);
  const [series, setSeries] = useState<AdminStatsPoint[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi
      .statsTimeSeries(token, days)
      .then(setSeries)
      .finally(() => setLoading(false));
  }, [token, days]);

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="font-bold text-base">Thống kê theo thời gian</h1>
        <div className="flex gap-1.5 text-xs">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg font-bold ${
                days === d ? 'bg-primary text-white' : 'bg-surface-alt text-ink-faint'
              }`}
            >
              {d} ngày
            </button>
          ))}
        </div>
      </div>
      {loading || !series ? (
        <div className="text-center text-ink-faint py-10 text-sm">Đang tải…</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {STATS_METRICS.map((m) => (
            <MetricChart key={m.key} series={series} metricKey={m.key} label={m.label} barClass={m.barClass} />
          ))}
        </div>
      )}
    </>
  );
}

function MetricChart({
  series,
  metricKey,
  label,
  barClass,
}: {
  series: AdminStatsPoint[];
  metricKey: keyof AdminStatsPoint;
  label: string;
  barClass: string;
}) {
  const values = series.map((p) => Number(p[metricKey]));
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <div className="rounded-xl bg-white border border-border p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div className="font-bold text-sm">{label}</div>
        <div className="text-xs text-ink-faint">
          Tổng: <span className="font-extrabold text-ink">{formatNumber(total)}</span>
        </div>
      </div>
      <div className="flex items-end gap-[3px] h-24">
        {series.map((p) => {
          const v = Number(p[metricKey]);
          const heightPct = v > 0 ? Math.max(4, Math.round((v / max) * 100)) : 0;
          return (
            <div key={p.date} className="flex-1 h-full flex items-end" title={`${formatDate(p.date)}: ${v}`}>
              <div className={`w-full rounded-t ${barClass}`} style={{ height: `${heightPct}%`, minHeight: v > 0 ? 2 : 0 }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-ink-faint mt-1.5">
        <span>{formatDate(series[0]?.date)}</span>
        <span>{formatDate(series[series.length - 1]?.date)}</span>
      </div>
    </div>
  );
}

// Đợt 12q (21/09/2026) — Batch 5 mục #4 "Nhật ký thao tác admin".
const AUDIT_ACTION_LABEL: Record<string, string> = {
  'job.approve': 'Duyệt tin',
  'job.reject': 'Từ chối tin',
  'job.bulk_approve': 'Duyệt hàng loạt tin',
  'job.bulk_reject': 'Từ chối hàng loạt tin',
  'company.approve': 'Duyệt công ty',
  'company.reject': 'Từ chối công ty',
  'company.bulk_approve': 'Duyệt hàng loạt công ty',
  'company.bulk_reject': 'Từ chối hàng loạt công ty',
  'company.toggle_featured': 'Bật/tắt DN yêu thích',
  'order.confirm_payment': 'Xác nhận thanh toán',
  'user.reset_password': 'Đặt lại mật khẩu',
};

function AuditLogCard({ token }: { token: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: AdminAuditLogEntry[]; page: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi
      .auditLog(token, page)
      .then(setData)
      .finally(() => setLoading(false));
  }, [token, page]);

  return (
    <>
      <h1 className="font-bold text-base mb-1">Nhật ký thao tác admin</h1>
      <div className="text-xs text-ink-faint mb-4 max-w-2xl">
        Ghi lại hành động duyệt/từ chối tin &amp; công ty (kể cả hàng loạt), đặt lại mật khẩu, xác nhận thanh
        toán, bật/tắt &ldquo;Doanh nghiệp yêu thích&rdquo; — tính từ đợt này trở đi.
      </div>
      {loading || !data ? (
        <div className="text-center text-ink-faint py-10 text-sm">Đang tải…</div>
      ) : data.items.length === 0 ? (
        <div className="text-center text-ink-faint text-sm py-16">Chưa có nhật ký nào.</div>
      ) : (
        <>
          <div className="rounded-xl bg-white border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-ink-faint bg-surface-alt">
                    <th className="py-2.5 px-4 font-semibold">Thời gian</th>
                    <th className="py-2.5 px-3 font-semibold">Admin</th>
                    <th className="py-2.5 px-3 font-semibold">Hành động</th>
                    <th className="py-2.5 px-3 font-semibold">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.id} className="border-t border-border align-top">
                      <td className="py-3 px-4 tabular-nums whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                      <td className="py-3 px-3 text-ink-faint whitespace-nowrap">{row.adminEmail}</td>
                      <td className="py-3 px-3 font-bold whitespace-nowrap">
                        {AUDIT_ACTION_LABEL[row.action] ?? row.action}
                      </td>
                      <td className="py-3 px-3 text-ink-faint">{row.description ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 mt-4 text-xs">
            {/* Đợt 13 (24/09/2026) — thêm nút "Đầu tiên"/"Cuối cùng", áp dụng nhất quán với phân
                trang ở trang /viec-lam. */}
            <button
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className="px-3 py-1.5 rounded-lg font-bold bg-surface-alt text-ink-faint disabled:opacity-40"
            >
              Đầu tiên
            </button>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg font-bold bg-surface-alt text-ink-faint disabled:opacity-40"
            >
              ← Trước
            </button>
            <span className="text-ink-faint">
              Trang {data.page}/{data.totalPages}
            </span>
            <button
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg font-bold bg-surface-alt text-ink-faint disabled:opacity-40"
            >
              Sau →
            </button>
            <button
              disabled={page >= data.totalPages}
              onClick={() => setPage(data.totalPages)}
              className="px-3 py-1.5 rounded-lg font-bold bg-surface-alt text-ink-faint disabled:opacity-40"
            >
              Cuối cùng
            </button>
          </div>
        </>
      )}
    </>
  );
}
