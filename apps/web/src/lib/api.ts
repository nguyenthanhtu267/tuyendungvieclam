const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (data && (Array.isArray(data.message) ? data.message.join(', ') : data.message)) ||
      'Đã có lỗi xảy ra, vui lòng thử lại';
    throw new ApiError(message, res.status);
  }

  return data as T;
}

// Dành cho gửi FormData (upload tệp) — không tự set Content-Type để trình duyệt tự thêm boundary.
async function requestForm<T>(path: string, token: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (data && (Array.isArray(data.message) ? data.message.join(', ') : data.message)) ||
      'Đã có lỗi xảy ra, vui lòng thử lại';
    throw new ApiError(message, res.status);
  }
  return data as T;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string; role: string };
}

export const authApi = {
  register: (payload: { email: string; password: string; fullName: string; phone?: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  registerEmployer: (payload: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    companyName: string;
    taxCode: string;
    industry?: string;
    size?: string;
    website?: string;
  }) => request<AuthResponse>('/auth/register-employer', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: (token: string) =>
    request<{ id: string; email: string; role: string; status: string }>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),
};

export type CompanyApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Company {
  id: string;
  name: string;
  taxCode: string;
  size?: string;
  industry?: string;
  website?: string;
  approvalStatus?: CompanyApprovalStatus;
  legalDocUrl?: string;
  legalDocOriginalFileName?: string;
  legalDocExternalLink?: string;
}

export type JobApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'expired';

export interface JobPosting {
  id: string;
  title: string;
  industry?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  employmentType?: string;
  level?: string;
  headcount: number;
  description?: string;
  requirements?: string;
  benefits?: string[];
  deadline?: string;
  approvalStatus?: JobApprovalStatus;
  createdAt: string;
  company: Company;
}

export interface JobListResponse {
  items: JobPosting[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface JobFacets {
  total: number;
  industries: { industry: string; count: number }[];
  locations: { location: string; count: number }[];
}

export const jobsApi = {
  list: (params: { q?: string; location?: string; industry?: string; page?: number; pageSize?: number }) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') search.set(k, String(v));
    });
    const qs = search.toString();
    return request<JobListResponse>(`/jobs${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<{ job: JobPosting; related: JobPosting[] }>(`/jobs/${id}`),
  facets: () => request<JobFacets>('/jobs/facets'),
};

export type ProfileVisibility = 'locked' | 'public' | 'urgent';

export interface CandidateProfile {
  id: string;
  userId: string;
  fullName: string;
  desiredPosition?: string;
  desiredLevel?: string;
  desiredSalaryMin?: number;
  desiredSalaryMax?: number;
  visibility: ProfileVisibility;
  completionPercent: number;
  allowJobNotifications: boolean;
  cvs?: CV[];
}

export interface CV {
  id: string;
  candidateProfileId: string;
  type: 'template' | 'upload';
  fileUrl?: string;
  originalFileName?: string;
  externalLinkUrl?: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface SavedJob {
  id: string;
  jobPostingId: string;
  createdAt: string;
  jobPosting: JobPosting;
}

export interface BlockedCompany {
  id: string;
  companyId?: string;
  companyNameText?: string;
  company?: Company;
  createdAt: string;
}

export type ApplicationStatus = 'new' | 'reviewing' | 'suitable' | 'rejected' | 'interview';

export interface Application {
  id: string;
  jobPostingId: string;
  cvId: string;
  status: ApplicationStatus;
  coverLetter?: string;
  appliedAt: string;
  jobPosting: JobPosting;
}

export const candidatesApi = {
  getProfile: (token: string) => request<CandidateProfile>('/me/profile', { headers: authHeaders(token) }),
  updateProfile: (token: string, data: Partial<CandidateProfile>) =>
    request<CandidateProfile>('/me/profile', {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),
  listCvs: (token: string) => request<CV[]>('/me/cvs', { headers: authHeaders(token) }),
  addCvLink: (token: string, externalLinkUrl: string) =>
    request<CV>('/me/cvs/link', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ externalLinkUrl }),
    }),
  uploadCv: (token: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return requestForm<CV>('/me/cvs/upload', token, form);
  },
  removeCv: (token: string, id: string) =>
    request<void>(`/me/cvs/${id}`, { method: 'DELETE', headers: authHeaders(token) }),
  setPrimaryCv: (token: string, id: string) =>
    request<CV>(`/me/cvs/${id}/primary`, { method: 'PATCH', headers: authHeaders(token) }),

  listSavedJobs: (token: string) => request<SavedJob[]>('/me/saved-jobs', { headers: authHeaders(token) }),
  saveJob: (token: string, jobId: string) =>
    request<SavedJob>(`/me/saved-jobs/${jobId}`, { method: 'POST', headers: authHeaders(token) }),
  unsaveJob: (token: string, jobId: string) =>
    request<void>(`/me/saved-jobs/${jobId}`, { method: 'DELETE', headers: authHeaders(token) }),

  listBlockedCompanies: (token: string) =>
    request<BlockedCompany[]>('/me/blocked-companies', { headers: authHeaders(token) }),
  blockCompany: (token: string, dto: { companyId?: string; companyNameText?: string }) =>
    request<BlockedCompany>('/me/blocked-companies', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  unblockCompany: (token: string, id: string) =>
    request<void>(`/me/blocked-companies/${id}`, { method: 'DELETE', headers: authHeaders(token) }),
};

export const applicationsApi = {
  apply: (token: string, jobId: string, dto: { cvId: string; coverLetter?: string }) =>
    request<Application>(`/jobs/${jobId}/apply`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  listOwn: (token: string) => request<Application[]>('/me/applications', { headers: authHeaders(token) }),
};

// ===== Nhà tuyển dụng (Employer) =====

export interface EmployerJob extends JobPosting {
  applicationCount: number;
}

export interface EmployerApplicantProfile {
  fullName: string;
  desiredPosition?: string;
  desiredLevel?: string;
}

export interface EmployerApplication {
  id: string;
  jobPostingId: string;
  status: ApplicationStatus;
  coverLetter?: string;
  appliedAt: string;
  jobPosting?: JobPosting;
  cv: {
    id: string;
    fileUrl?: string;
    originalFileName?: string;
    externalLinkUrl?: string;
    candidateProfile: EmployerApplicantProfile;
  };
}

export interface EmployerDashboard {
  jobCount: number;
  totalApplications: number;
  newApplicationsToday: number;
  recentJobs: EmployerJob[];
  recentApplications: EmployerApplication[];
}

export interface CreateJobPayload {
  title: string;
  industry?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  employmentType?: string;
  level?: string;
  headcount?: number;
  description?: string;
  requirements?: string;
  benefits?: string[];
  deadline?: string;
}

// ===== B5 — Tài khoản & Hồ sơ công ty =====

export interface UpdateCompanyPayload {
  size?: string;
  industry?: string;
  website?: string;
}

export type CompanyUserType = 'main' | 'sub';

export interface TeamMember {
  id: string;
  type: CompanyUserType;
  createdAt: string;
  user: { id: string; email: string; fullName?: string; status: string };
}

export interface CreateSubAccountPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

// ===== B4 — Gói dịch vụ & Đơn hàng =====

export interface ServicePackage {
  id: string;
  name: string;
  type: 'job_posting' | 'cv_search' | 'combo';
  quantity: number;
  durationDays: number;
  price: number;
  active: boolean;
}

export type PaymentMethod = 'vnpay' | 'momo' | 'zalopay' | 'vietqr' | 'contract_vat';
export type OrderStatus = 'pending' | 'active' | 'expired' | 'cancelled';

export interface Order {
  id: string;
  companyId: string;
  servicePackageId: string;
  servicePackage?: ServicePackage;
  company?: Company;
  quantity: number;
  remaining: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  activatedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export const employerApi = {
  getCompany: (token: string) => request<Company>('/employer/company', { headers: authHeaders(token) }),
  updateCompany: (token: string, dto: UpdateCompanyPayload) =>
    request<Company>('/employer/company', {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  uploadLegalDoc: (token: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return requestForm<Company>('/employer/company/legal-doc/upload', token, form);
  },
  addLegalDocLink: (token: string, externalLinkUrl: string) =>
    request<Company>('/employer/company/legal-doc/link', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ externalLinkUrl }),
    }),
  listTeam: (token: string) => request<TeamMember[]>('/employer/team', { headers: authHeaders(token) }),
  addSubAccount: (token: string, dto: CreateSubAccountPayload) =>
    request<TeamMember>('/employer/team', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  removeSubAccount: (token: string, id: string) =>
    request<void>(`/employer/team/${id}`, { method: 'DELETE', headers: authHeaders(token) }),
  listPackages: (token: string) =>
    request<ServicePackage[]>('/employer/packages', { headers: authHeaders(token) }),
  listOrders: (token: string) => request<Order[]>('/employer/orders', { headers: authHeaders(token) }),
  createOrder: (token: string, dto: { servicePackageId: string; paymentMethod: PaymentMethod }) =>
    request<Order>('/employer/orders', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  dashboard: (token: string) =>
    request<EmployerDashboard>('/employer/dashboard', { headers: authHeaders(token) }),
  listJobs: (token: string) => request<EmployerJob[]>('/employer/jobs', { headers: authHeaders(token) }),
  createJob: (token: string, dto: CreateJobPayload) =>
    request<JobPosting>('/employer/jobs', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  getJob: (token: string, id: string) =>
    request<JobPosting>(`/employer/jobs/${id}`, { headers: authHeaders(token) }),
  listApplicants: (token: string, jobId: string, status?: ApplicationStatus) =>
    request<EmployerApplication[]>(
      `/employer/jobs/${jobId}/applicants${status ? `?status=${status}` : ''}`,
      { headers: authHeaders(token) },
    ),
  updateApplicationStatus: (token: string, applicationId: string, status: ApplicationStatus) =>
    request<EmployerApplication>(`/employer/applications/${applicationId}/status`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ status }),
    }),
};

// ===== Admin (quản trị) =====

export interface AdminDashboard {
  employerCount: number;
  candidateCount: number;
  companyCount: number;
  jobCount: number;
  pendingJobsCount: number;
  pendingCompaniesCount: number;
  recentPendingJobs: JobPosting[];
}

export const adminApi = {
  dashboard: (token: string) => request<AdminDashboard>('/admin/dashboard', { headers: authHeaders(token) }),
  listPendingJobs: (token: string) =>
    request<JobPosting[]>('/admin/jobs/pending', { headers: authHeaders(token) }),
  approveJob: (token: string, id: string) =>
    request<JobPosting>(`/admin/jobs/${id}/approve`, { method: 'PATCH', headers: authHeaders(token) }),
  rejectJob: (token: string, id: string) =>
    request<JobPosting>(`/admin/jobs/${id}/reject`, { method: 'PATCH', headers: authHeaders(token) }),
  listPendingCompanies: (token: string) =>
    request<Company[]>('/admin/companies/pending', { headers: authHeaders(token) }),
  approveCompany: (token: string, id: string) =>
    request<Company>(`/admin/companies/${id}/approve`, { method: 'PATCH', headers: authHeaders(token) }),
  rejectCompany: (token: string, id: string) =>
    request<Company>(`/admin/companies/${id}/reject`, { method: 'PATCH', headers: authHeaders(token) }),
  listPendingOrders: (token: string) =>
    request<Order[]>('/admin/orders/pending', { headers: authHeaders(token) }),
  confirmOrderPayment: (token: string, id: string) =>
    request<Order>(`/admin/orders/${id}/confirm-payment`, { method: 'PATCH', headers: authHeaders(token) }),
};
