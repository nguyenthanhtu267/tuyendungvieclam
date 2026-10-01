// Đợt 93 — các nhóm API CHỈ Admin dùng, tách khỏi lib/api.ts để khách/ứng viên/nhà tuyển dụng không phải tải mã này.
import { API_URL, ApiError, qs, request, requestForm, authHeaders } from './api';
import type { MailScanStatus, JobImportRow, AdCampaignInput, AdCampaignRow, AdStats, AdminAuditLogResponse, AdminCandidateDetail, AdminCandidateQuery, AdminCandidateRow, AdminDashboard, AdminPersonDetail, AdminPersonRow, AdminStatsPoint, AnalyticsBehavior, AnalyticsContent, AnalyticsHeatmap, AnalyticsOverview, AnalyticsRealtime, BulkActionResult, CandidateDraft, ClaimCompanyPayload, Company, CompanyClaimRequestRow, CompanyClaimRequestStatus, CreateDraftCompanyPayload, CreateJobPayload, CvCardDraftResponse, CvQueueResponse, CvShareStatus, DraftAccountInfo, ExtractJobUrlResult, ImpersonateResult, JobPosting, Order, ProfileRequestRow, ProfileVisibility, PromoBadgeSetting, SourcedProfileRow, StorageStatus, SuggestedJob } from './api';
import type { BgImage, BgSetting } from './bg-themes';
export const adminApi = {
  getBackground: (token: string) => request<BgSetting>('/admin/settings/background', { headers: authHeaders(token) }),
  setBackground: (token: string, body: Omit<BgSetting, 'images'>) =>
    request<BgSetting>('/admin/settings/background', { method: 'PATCH', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  // Đợt 30b — ảnh nền tải lên (trình duyệt đã thu nhỏ + đổi sang WEBP/JPEG trước khi gửi).
  uploadBgImage: (token: string, blob: Blob, meta: { name: string; overlay: number; width: number; height: number }) => {
    const form = new FormData();
    form.append('file', blob, `nen.${blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'}`);
    form.append('name', meta.name);
    form.append('overlay', String(meta.overlay));
    form.append('width', String(meta.width));
    form.append('height', String(meta.height));
    return requestForm<BgImage>('/admin/settings/background/images', token, form);
  },
  updateBgImage: (token: string, id: string, body: { overlay?: number; name?: string }) =>
    request<BgImage>(`/admin/settings/background/images/${id}`, { method: 'PUT', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  deleteBgImage: (token: string, id: string) =>
    request<BgSetting>(`/admin/settings/background/images/${id}`, { method: 'DELETE', headers: authHeaders(token) }),
  dashboard: (token: string) => request<AdminDashboard>('/admin/dashboard', { headers: authHeaders(token) }),
  listPendingJobs: (token: string) =>
    request<JobPosting[]>('/admin/jobs/pending', { headers: authHeaders(token) }),
  // Đợt 12i — xem trước đúng nội dung tin (kể cả tin CHƯA duyệt) trước khi Duyệt/Từ chối.
  getJobForReview: (token: string, id: string) =>
    request<JobPosting>(`/admin/jobs/${id}`, { headers: authHeaders(token) }),
  approveJob: (token: string, id: string) =>
    request<JobPosting>(`/admin/jobs/${id}/approve`, { method: 'PATCH', headers: authHeaders(token) }),
  // Đợt 15 (25/09/2026) — "Tự động duyệt tin": công tắc chung + nút "Tin đã kiểm tra" cho tin đã
  // được tự động duyệt (còn hiện trong danh sách /admin/jobs/pending chờ Admin kiểm tra lần 2).
  getAutoApproveSetting: (token: string) =>
    request<{ enabled: boolean }>('/admin/settings/auto-approve', { headers: authHeaders(token) }),
  setAutoApproveSetting: (token: string, enabled: boolean) =>
    request<{ enabled: boolean }>('/admin/settings/auto-approve', {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ enabled }),
    }),
  // Đợt 23 (29/09/2026) — nhãn quảng bá cạnh logo: Admin bật/tắt + sửa chữ + link (mở tab mới).
  getPromoBadge: (token: string) =>
    request<PromoBadgeSetting>('/admin/settings/promo-badge', { headers: authHeaders(token) }),
  setPromoBadge: (token: string, dto: { enabled: boolean; text: string; url: string }) =>
    request<PromoBadgeSetting>('/admin/settings/promo-badge', {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  markJobReviewed: (token: string, id: string) =>
    request<JobPosting>(`/admin/jobs/${id}/mark-reviewed`, { method: 'PATCH', headers: authHeaders(token) }),
  // Đợt 12x (21/09/2026) — "Bắt buộc nhập lý do khi Từ chối": nay cần body { reasons, note? }.
  rejectJob: (token: string, id: string, dto: { reasons: string[]; note?: string }) =>
    request<JobPosting>(`/admin/jobs/${id}/reject`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  // Đợt 12x (21/09/2026) — "Sửa tin trước khi duyệt": Admin sửa toàn bộ trường như form NTD, không
  // đổi approvalStatus (dùng chung kiểu payload với employerApi.updateJob).
  updateJob: (token: string, id: string, dto: Partial<CreateJobPayload>) =>
    request<JobPosting>(`/admin/jobs/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  listJobsByStatus: (token: string, status: 'approved' | 'rejected', q = '') =>
    request<{ items: JobPosting[]; total: number }>(`/admin/jobs/by-status?status=${status}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`, { headers: authHeaders(token) }),
  revokeJob: (token: string, id: string) =>
    request<JobPosting>(`/admin/jobs/${id}/revoke`, { method: 'PATCH', headers: authHeaders(token) }),
  logoSuggestions: (token: string, id: string) =>
    request<{ items: { url: string; source: string }[] }>(`/admin/companies/${id}/logo-suggestions`, { headers: authHeaders(token) }),
  listPendingCompanies: (token: string) =>
    request<Company[]>('/admin/companies/pending', { headers: authHeaders(token) }),
  listCompaniesByStatus: (token: string, status: 'pending' | 'approved' | 'rejected', q = '') =>
    request<{ items: Company[]; total: number }>(`/admin/companies/by-status?status=${status}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`, { headers: authHeaders(token) }),
  revokeCompany: (token: string, id: string) =>
    request<Company>(`/admin/companies/${id}/revoke`, { method: 'PATCH', headers: authHeaders(token) }),
  approveCompany: (token: string, id: string) =>
    request<Company>(`/admin/companies/${id}/approve`, { method: 'PATCH', headers: authHeaders(token) }),
  rejectCompany: (token: string, id: string) =>
    request<Company>(`/admin/companies/${id}/reject`, { method: 'PATCH', headers: authHeaders(token) }),
  listPendingOrders: (token: string) =>
    request<Order[]>('/admin/orders/pending', { headers: authHeaders(token) }),
  confirmOrderPayment: (token: string, id: string) =>
    request<Order>(`/admin/orders/${id}/confirm-payment`, { method: 'PATCH', headers: authHeaders(token) }),
  // Đợt 12a — Admin tra cứu tài khoản theo email + đặt lại mật khẩu tạm (thay cho "quên mật khẩu"
  // tự phục vụ qua email, vì Giai đoạn 1 không có email/SMS).
  findUserByEmail: (token: string, email: string) =>
    request<{ id: string; email: string; fullName?: string; role: string; status: string }>(
      `/admin/users?email=${encodeURIComponent(email)}`,
      { headers: authHeaders(token) },
    ),
  resetUserPassword: (token: string, id: string) =>
    request<{ email: string; tempPassword: string }>(`/admin/users/${id}/reset-password`, {
      method: 'PATCH',
      headers: authHeaders(token),
    }),

  // Đợt 12q (21/09/2026) — Batch 5 mục #2: duyệt/từ chối hàng loạt.
  bulkApproveJobs: (token: string, ids: string[]) =>
    request<BulkActionResult>('/admin/jobs/bulk-approve', {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ ids }),
    }),
  bulkRejectJobs: (token: string, ids: string[]) =>
    request<BulkActionResult>('/admin/jobs/bulk-reject', {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ ids }),
    }),
  bulkApproveCompanies: (token: string, ids: string[]) =>
    request<BulkActionResult>('/admin/companies/bulk-approve', {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ ids }),
    }),
  bulkRejectCompanies: (token: string, ids: string[]) =>
    request<BulkActionResult>('/admin/companies/bulk-reject', {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ ids }),
    }),

  // Đợt 12q (21/09/2026) — Batch 5 mục #1: tìm công ty + bật/tắt "Doanh nghiệp yêu thích".
  companyDirectory: (token: string, o: { q?: string; status?: string; featured?: boolean; noLogo?: boolean; attention?: boolean; hasWebsite?: boolean }) => {
    const qs = new URLSearchParams();
    if (o.q?.trim()) qs.set('q', o.q.trim());
    if (o.status) qs.set('status', o.status);
    if (o.featured) qs.set('featured', '1');
    if (o.noLogo) qs.set('noLogo', '1');
    if (o.attention) qs.set('attention', '1');
    if (o.hasWebsite) qs.set('hasWebsite', '1');
    return request<{ items: Company[]; total: number; featuredTotal: number; noLogoTotal: number; all: number; attentionTotal: number }>(`/admin/companies/directory?${qs.toString()}`, { headers: authHeaders(token) });
  },
  logoScan: (token: string) =>
    request<{ checked: number; found: number }>('/admin/companies/logo-scan?limit=100', { method: 'POST', headers: authHeaders(token) }),
  bulkSetFeatured: (token: string, ids: string[], featured: boolean) =>
    request<{ updated: number }>('/admin/companies/bulk-featured', { method: 'PATCH', headers: authHeaders(token), body: JSON.stringify({ ids, featured }) }),
  searchCompanies: (token: string, q: string) =>
    request<Company[]>(`/admin/companies?q=${encodeURIComponent(q)}`, { headers: authHeaders(token) }),
  toggleFeaturedEmployer: (token: string, id: string) =>
    request<Company>(`/admin/companies/${id}/toggle-featured`, { method: 'PATCH', headers: authHeaders(token) }),
  // Đợt 16 (25/09/2026) — mục 22b: công cụ Admin tìm & gán logo công ty thủ công.
  updateCompanyLogo: (token: string, id: string, logoUrl: string) =>
    request<Company>(`/admin/companies/${id}/logo`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ logoUrl }),
    }),

  // Đợt 12q (21/09/2026) — Batch 5 mục #3: chuỗi thời gian cho biểu đồ dashboard.
  statsTimeSeries: (token: string, days = 14) =>
    request<AdminStatsPoint[]>(`/admin/stats/timeseries?days=${days}`, { headers: authHeaders(token) }),

  // Đợt 12q (21/09/2026) — Batch 5 mục #4: nhật ký thao tác admin.
  auditLog: (token: string, page = 1) =>
    request<AdminAuditLogResponse>(`/admin/audit-log?page=${page}`, { headers: authHeaders(token) }),

  // ===== Đợt 17 (25/09/2026) — "Nguồn ngoài / Tin tổng hợp" =====
  createDraftCompany: (token: string, dto: CreateDraftCompanyPayload) =>
    request<{ company: Company; draftAccount: DraftAccountInfo }>('/admin/companies/draft', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  listSourcedCompanies: (token: string, q?: string, claimed?: boolean) => {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (claimed !== undefined) qs.set('claimed', String(claimed));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<Company[]>(`/admin/companies/sourced${suffix}`, { headers: authHeaders(token) });
  },
  // Đợt 17k (25/09/2026) — mỗi tin kèm `applicationCount` để FE cảnh báo trước khi xoá (xem deleteJob).
  getSourcedCompanyDetail: (token: string, id: string) =>
    request<{ company: Company; jobs: (JobPosting & { applicationCount: number })[] }>(
      `/admin/companies/${id}/sourced-detail`,
      { headers: authHeaders(token) },
    ),
  createJobForCompany: (token: string, companyId: string, dto: CreateJobPayload) =>
    request<JobPosting>(`/admin/companies/${companyId}/jobs`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  claimCompany: (token: string, companyId: string, dto: ClaimCompanyPayload) =>
    request<{ company: Company; account: DraftAccountInfo }>(`/admin/companies/${companyId}/claim`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  // Đợt 120 — tự đọc email thông báo việc làm.
  mailScanStatus: (token: string) => request<MailScanStatus>('/admin/mail-scan', { headers: authHeaders(token) }),
  mailScanNow: (token: string, days?: number) => request<{ started: boolean; reason?: string }>('/admin/mail-scan', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ days }) }),
  mailScanLabels: (token: string, account = 1) => request<{ items: { path: string; selected: boolean }[]; error?: string }>(`/admin/mail-scan/labels?account=${account}`, { headers: authHeaders(token) }),
  publishManyImports: (token: string, ids: string[]) => request<{ ok: number; failed: { id: string; message: string }[] }>('/admin/imports/publish-many', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ ids }) }),
  mergeImportDuplicates: (token: string) => request<{ merged: number }>('/admin/imports/merge-duplicates', { method: 'POST', headers: authHeaders(token) }),
  mailScanSetLabels: (token: string, labels: string[], account = 1) =>
    request<MailScanStatus>('/admin/mail-scan/labels', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ labels, account }) }),
  mailScanEnabled: (token: string, enabled: boolean) =>
    request<MailScanStatus>('/admin/mail-scan/enabled', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ enabled }) }),
  // Đợt 119 — Hộp nhập tin từ link.
  addImportLinks: (token: string, urls: string[]) =>
    request<{ results: { url: string; result: 'new' | 'duplicate' | 'failed'; id?: string; message?: string }[] }>('/admin/imports', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ urls }) }),
  listImports: (token: string, status?: string) =>
    request<{ items: JobImportRow[]; counts: Record<string, number> }>(`/admin/imports${status ? `?status=${status}` : ''}`, { headers: authHeaders(token) }),
  publishImport: (token: string, id: string, edit: Record<string, unknown>) =>
    request<{ job: JobPosting; company: Company }>(`/admin/imports/${id}/publish`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify(edit) }),
  notifyImportOwner: (token: string, id: string) =>
    request<unknown>(`/admin/imports/${id}/notify-owner`, { method: 'POST', headers: authHeaders(token) }),
  reopenImport: (token: string, id: string) =>
    request<unknown>(`/admin/imports/${id}/reopen`, { method: 'POST', headers: authHeaders(token) }),
  skipImport: (token: string, id: string) =>
    request<unknown>(`/admin/imports/${id}/skip`, { method: 'POST', headers: authHeaders(token) }),
  extractJobFromUrl: (token: string, url: string) =>
    request<ExtractJobUrlResult>('/admin/extract-job-url', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ url }),
    }),
  // Đợt 17k (25/09/2026) — "xoá tin đăng" (theo yêu cầu người dùng, màn "Quản lý" công ty nguồn ngoài).
  deleteJob: (token: string, id: string) =>
    request<{ success: true }>(`/admin/jobs/${id}`, { method: 'DELETE', headers: authHeaders(token) }),
  listClaimRequests: (token: string, status?: CompanyClaimRequestStatus) =>
    request<CompanyClaimRequestRow[]>(`/admin/claim-requests${status ? `?status=${status}` : ''}`, {
      headers: authHeaders(token),
    }),
  approveClaimRequest: (token: string, id: string, dto: { adminNote?: string; taxCode?: string } = {}) =>
    request<{ request: CompanyClaimRequestRow; account: DraftAccountInfo }>(`/admin/claim-requests/${id}/approve`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  rejectClaimRequest: (token: string, id: string, dto: { adminNote?: string } = {}) =>
    request<CompanyClaimRequestRow>(`/admin/claim-requests/${id}/reject`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
};

export const adminSourcingApi = {
  summary: (token: string) =>
    request<{ pending: number; sourced: number; requests: number; sharedLast7Days: number }>('/admin/cv-sourcing/summary', {
      headers: authHeaders(token),
    }),
  getAutoShare: (token: string) =>
    request<{ enabled: boolean; enabledAt: string | null }>('/admin/cv-sourcing/settings/auto-share', { headers: authHeaders(token) }),
  setAutoShare: (token: string, enabled: boolean) =>
    request<{ enabled: boolean; enabledAt: string | null }>('/admin/cv-sourcing/settings/auto-share', {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ enabled }),
    }),
  queue: (token: string, params: { status?: CvShareStatus; q?: string; page?: number; pageSize?: number }) =>
    request<CvQueueResponse>(`/admin/cv-sourcing/queue${qs(params)}`, { headers: authHeaders(token) }),
  draft: (token: string, id: string) =>
    request<CvCardDraftResponse>(`/admin/cv-sourcing/queue/${id}/draft`, { headers: authHeaders(token) }),
  share: (token: string, id: string, draft?: CandidateDraft) =>
    request<{ status: 'shared' | 'already_public'; profileId: string | null }>(`/admin/cv-sourcing/queue/${id}/share`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(draft ? { draft } : {}),
    }),
  dismiss: (token: string, id: string) =>
    request<{ dismissed: number }>(`/admin/cv-sourcing/queue/${id}/dismiss`, { method: 'POST', headers: authHeaders(token) }),
  requeue: (token: string, id: string) =>
    request<{ success: true }>(`/admin/cv-sourcing/queue/${id}/requeue`, { method: 'POST', headers: authHeaders(token) }),
  bulkShare: (token: string, ids: string[]) =>
    request<{ shared: number; alreadyPublic: number; failed: number }>('/admin/cv-sourcing/queue/bulk-share', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ ids }),
    }),
  bulkDismiss: (token: string, ids: string[]) =>
    request<{ dismissed: number }>('/admin/cv-sourcing/queue/bulk-dismiss', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ ids }),
    }),
  downloadEntryFile: async (token: string, entryId: string): Promise<Blob> => {
    const res = await fetch(`${API_URL}/admin/cv-sourcing/entries/${entryId}/file`, { headers: authHeaders(token) });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new ApiError((data && data.message) || 'Không tải được tệp CV', res.status);
    }
    return res.blob();
  },
  profiles: (token: string, params: { q?: string; page?: number; pageSize?: number }) =>
    request<{ items: SourcedProfileRow[]; total: number; page: number; pageSize: number }>(
      `/admin/cv-sourcing/profiles${qs(params)}`,
      { headers: authHeaders(token) },
    ),
  createProfile: (token: string, draft: CandidateDraft, file?: File | null) => {
    const form = new FormData();
    form.append('payload', JSON.stringify(draft));
    if (file) form.append('file', file);
    return requestForm<{ id: string }>('/admin/cv-sourcing/profiles', token, form);
  },
  deleteProfile: (token: string, id: string) =>
    request<{ success: true }>(`/admin/cv-sourcing/profiles/${id}`, { method: 'DELETE', headers: authHeaders(token) }),
  requests: (token: string, status: 'pending' | 'resolved' | 'rejected' = 'pending') =>
    request<ProfileRequestRow[]>(`/admin/cv-sourcing/requests?status=${status}`, { headers: authHeaders(token) }),
  resolveRemove: (token: string, id: string, profileId: string, adminNote?: string) =>
    request<{ success: true }>(`/admin/cv-sourcing/requests/${id}/remove`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ profileId, adminNote }),
    }),
  resolveClaim: (token: string, id: string, profileId: string, adminNote?: string) =>
    request<{ email: string; tempPassword: string }>(`/admin/cv-sourcing/requests/${id}/claim`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ profileId, adminNote }),
    }),
  reject: (token: string, id: string, adminNote?: string) =>
    request<{ success: true }>(`/admin/cv-sourcing/requests/${id}/reject`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ adminNote }),
    }),
};

export const adminPeopleApi = {
  list: (
    token: string,
    params: { q?: string; role?: 'candidate' | 'employer' | 'admin'; status?: string; page?: number; pageSize?: number },
  ) =>
    request<{ items: AdminPersonRow[]; total: number; page: number; pageSize: number }>(`/admin/people${qs(params)}`, {
      headers: authHeaders(token),
    }),
  detail: (token: string, userId: string) => request<AdminPersonDetail>(`/admin/people/${userId}`, { headers: authHeaders(token) }),
  updateUser: (
    token: string,
    userId: string,
    payload: { fullName?: string; email?: string; phone?: string; status?: string; role?: string },
  ) =>
    request<AdminPersonDetail>(`/admin/people/${userId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    }),
  updateCompany: (
    token: string,
    companyId: string,
    payload: { name?: string; taxCode?: string; industry?: string; size?: string; website?: string; logoUrl?: string; description?: string; address?: string; contactPerson?: string; companyType?: string; vision?: string; mission?: string; galleryUrls?: string[] },
  ) =>
    request<{ success: true }>(`/admin/people/companies/${companyId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    }),
  updateCandidate: (
    token: string,
    profileId: string,
    payload: {
      fullName?: string;
      profileTitle?: string;
      phone?: string;
      contactEmail?: string;
      province?: string;
      desiredPosition?: string;
      visibility?: ProfileVisibility;
      hideContactInfo?: boolean;
    },
  ) =>
    request<{ success: true }>(`/admin/people/candidates/${profileId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    }),
  impersonate: (token: string, userId: string) =>
    request<ImpersonateResult>(`/admin/people/${userId}/impersonate`, { method: 'POST', headers: authHeaders(token) }),
};

export const adminCandidatesApi = {
  list: (token: string, params: AdminCandidateQuery) =>
    request<{ items: AdminCandidateRow[]; total: number; page: number; pageSize: number }>(
      `/admin/candidates${qs({ ...params })}`,
      { headers: authHeaders(token) },
    ),
  tags: (token: string) => request<{ tag: string; count: number }[]>('/admin/candidates/tags', { headers: authHeaders(token) }),
  detail: (token: string, id: string) => request<AdminCandidateDetail>(`/admin/candidates/${id}`, { headers: authHeaders(token) }),
  setNote: (token: string, id: string, payload: { tags?: string[]; note?: string }) =>
    request<{ tags: string[]; note: string | null }>(`/admin/candidates/${id}/note`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    }),
  suggestedJobs: (token: string, id: string) =>
    request<SuggestedJob[]>(`/admin/candidates/${id}/suggested-jobs`, { headers: authHeaders(token) }),
  invite: (token: string, id: string, jobPostingId: string) =>
    request<{ success: true }>(`/admin/candidates/${id}/invite`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ jobPostingId }),
    }),
  toSourced: (token: string, id: string) =>
    request<{ status: 'shared' | 'already_public'; profileId: string | null }>(`/admin/candidates/${id}/to-sourced`, {
      method: 'POST',
      headers: authHeaders(token),
    }),
};

export const adminAnalyticsApi = {
  realtime: (token: string) => request<AnalyticsRealtime>('/admin/analytics/realtime', { headers: authHeaders(token) }),
  overview: (token: string, from: string, to: string) =>
    request<AnalyticsOverview>(`/admin/analytics/overview${qs({ from, to })}`, { headers: authHeaders(token) }),
  content: (token: string, from: string, to: string) =>
    request<AnalyticsContent>(`/admin/analytics/content${qs({ from, to })}`, { headers: authHeaders(token) }),
  behavior: (token: string, from: string, to: string) =>
    request<AnalyticsBehavior>(`/admin/analytics/behavior${qs({ from, to })}`, { headers: authHeaders(token) }),
  // Đợt 93 — tốc độ THẬT của người xem (Web Vitals, p75) theo trang + thiết bị.
  vitals: (token: string, days = 7) =>
    request<{ days: number; note: string; items: { path: string; device: 'mobile' | 'desktop'; samples: number; lcpMs: number | null; cls: number | null; inpMs: number | null; ttfbMs: number | null }[] }>(
      `/admin/analytics/vitals${qs({ days })}`,
      { headers: authHeaders(token) },
    ),
  heatmapPages: (token: string, from: string, to: string) =>
    request<{ range: { from: string; to: string }; pages: { route: string; device: string; clicks: number }[] }>(
      `/admin/analytics/heatmap/pages${qs({ from, to })}`,
      { headers: authHeaders(token) },
    ),
  heatmap: (token: string, params: { route: string; device: string; from: string; to: string; path?: string }) =>
    request<AnalyticsHeatmap>(`/admin/analytics/heatmap${qs(params)}`, { headers: authHeaders(token) }),
};

export const adminStorageApi = {
  status: (token: string) => request<StorageStatus>('/admin/storage/status', { headers: authHeaders(token) }),
  connectUrl: (token: string, returnTo: string) =>
    request<{ url: string }>(`/admin/storage/google/connect-url${qs({ returnTo })}`, { headers: authHeaders(token) }),
  disconnect: (token: string) =>
    request<StorageStatus>('/admin/storage/google/disconnect', { method: 'POST', headers: authHeaders(token) }),
  setMigrationPaused: (token: string, paused: boolean) =>
    request<StorageStatus>('/admin/storage/migration', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ paused }) }),
  migrateNow: (token: string) => request<{ moved: number }>('/admin/storage/migrate-now', { method: 'POST', headers: authHeaders(token) }),
};

export const adminAdsApi = {
  list: (token: string) => request<AdCampaignRow[]>('/admin/ads', { headers: authHeaders(token) }),
  settings: (token: string) =>
    request<{ enabled: boolean; disabledSlots: string[] }>('/admin/ads/settings', { headers: authHeaders(token) }),
  setSettings: (token: string, dto: { enabled: boolean; disabledSlots: string[] }) =>
    request<{ enabled: boolean; disabledSlots: string[] }>('/admin/ads/settings', {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  stats: (token: string, days = 30) => request<AdStats>(`/admin/ads/stats?days=${days}`, { headers: authHeaders(token) }),
  create: (token: string, dto: AdCampaignInput) =>
    request<AdCampaignRow>('/admin/ads', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(dto) }),
  update: (token: string, id: string, dto: AdCampaignInput) =>
    request<AdCampaignRow>(`/admin/ads/${id}`, { method: 'PUT', headers: authHeaders(token), body: JSON.stringify(dto) }),
  setEnabled: (token: string, id: string, enabled: boolean) =>
    request<AdCampaignRow>(`/admin/ads/${id}/enabled`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ enabled }),
    }),
  duplicate: (token: string, id: string) =>
    request<AdCampaignRow>(`/admin/ads/${id}/duplicate`, { method: 'POST', headers: authHeaders(token) }),
  remove: (token: string, id: string) =>
    request<{ ok: boolean }>(`/admin/ads/${id}`, { method: 'DELETE', headers: authHeaders(token) }),
  uploadImage: (token: string, id: string, file: File, tone: 'light' | 'dark') => {
    const form = new FormData();
    form.append('file', file);
    form.append('tone', tone);
    return requestForm<AdCampaignRow>(`/admin/ads/${id}/image`, token, form);
  },
  removeImage: (token: string, id: string) =>
    request<AdCampaignRow>(`/admin/ads/${id}/image`, { method: 'DELETE', headers: authHeaders(token) }),
};
