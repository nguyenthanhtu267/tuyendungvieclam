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
  // Đợt 12a — đổi mật khẩu khi đã đăng nhập (mọi vai trò).
  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/auth/change-password', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword }),
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
  provinces?: string[];
  district?: string;
  experienceLevel?: string;
  isUrgent?: boolean;
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
  updatedAt?: string;
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

export interface DistrictFacet {
  district: string;
  count: number;
}

export interface FeaturedEmployer {
  id: string;
  name: string;
  industry?: string;
  size?: string;
  jobCount: number;
}

// Đợt 10 — tham số tìm kiếm/lọc nâng cao (claude/06-spec-tim-kiem-nang-cao.md). Giữ `location`/
// `industry` (số ít) để tương thích ngược với các đường dẫn đợt 7 cũ.
export interface JobListParams {
  q?: string;
  location?: string;
  industry?: string;
  provinces?: string[];
  district?: string;
  industries?: string[];
  salaryTier?: number;
  level?: string;
  postedWithin?: string;
  employmentType?: string;
  experienceLevel?: string;
  urgentOnly?: boolean;
  featuredEmployerOnly?: boolean;
  page?: number;
  pageSize?: number;
}

function buildJobQuery(params: JobListParams): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === '' || v === false) return;
    if (Array.isArray(v)) {
      if (v.length > 0) qs.set(k, v.join(','));
      return;
    }
    qs.set(k, String(v));
  });
  return qs.toString();
}

export const jobsApi = {
  list: (params: JobListParams) => {
    const qs = buildJobQuery(params);
    return request<JobListResponse>(`/jobs${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<{ job: JobPosting; related: JobPosting[] }>(`/jobs/${id}`),
  facets: (params: JobListParams = {}) => {
    const qs = buildJobQuery(params);
    return request<JobFacets>(`/jobs/facets${qs ? `?${qs}` : ''}`);
  },
  districtFacets: (province: string, params: JobListParams = {}) => {
    const qs = buildJobQuery({ ...params, provinces: undefined } as JobListParams);
    const sep = qs ? '&' : '';
    return request<DistrictFacet[]>(`/jobs/district-facets?province=${encodeURIComponent(province)}${sep}${qs}`);
  },
  featuredEmployers: () => request<FeaturedEmployer[]>('/jobs/featured-employers'),
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

// ===== Đợt 8 — Hồ sơ trực tuyến 13 mục =====

export type SectionKey =
  | 'experiences'
  | 'educations'
  | 'certificates'
  | 'languages'
  | 'skills'
  | 'achievements'
  | 'activities'
  | 'references';

export type LanguageLevel = 'native' | 'excellent' | 'good' | 'fair' | 'beginner';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type Gender = 'male' | 'female' | 'other';
export type MaritalStatus = 'single' | 'married' | 'other';

export interface FullProfile {
  id: string;
  userId: string;
  fullName: string;
  profileTitle?: string;
  lastName?: string;
  firstName?: string;
  dateOfBirth?: string;
  gender?: Gender;
  phone?: string;
  contactEmail?: string;
  nationality?: string;
  maritalStatus?: MaritalStatus;
  country?: string;
  province?: string;
  district?: string;
  address?: string;
  avatarMimeType?: string;
  careerObjective?: string;
  desiredPosition?: string;
  desiredLevel?: string;
  desiredSalaryMin?: number;
  desiredSalaryMax?: number;
  salaryCurrency?: string;
  desiredIndustries?: string[];
  desiredLocations?: string[];
  desiredJobTypes?: string[];
  yearsOfExperience?: number;
  currentLevel?: string;
  highestDegree?: string;
  hideContactInfo: boolean;
  visibility: ProfileVisibility;
  completionPercent: number;
  allowJobNotifications: boolean;
}

export interface ExperienceItem {
  id: string;
  position: string;
  companyName?: string;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
  description?: string;
}
export interface EducationItem {
  id: string;
  schoolName?: string;
  degree?: string;
  major?: string;
  startDate?: string;
  endDate?: string;
}
export interface CertificateItem {
  id: string;
  name: string;
  issuer?: string;
  issueDate?: string;
}
export interface LanguageItem {
  id: string;
  language: string;
  level: LanguageLevel;
}
export interface SkillItem {
  id: string;
  skillName: string;
  level: SkillLevel;
}
export interface AchievementItem {
  id: string;
  title: string;
  description?: string;
  date?: string;
}
export interface ActivityItem {
  id: string;
  title: string;
  organizationName?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}
export interface ReferenceItem {
  id: string;
  fullName: string;
  position?: string;
  company?: string;
  phone?: string;
  email?: string;
}

export interface ProfileSections {
  experiences: ExperienceItem[];
  educations: EducationItem[];
  certificates: CertificateItem[];
  languages: LanguageItem[];
  skills: SkillItem[];
  achievements: AchievementItem[];
  activities: ActivityItem[];
  references: ReferenceItem[];
}

export interface FullProfileResponse {
  profile: FullProfile;
  sections: ProfileSections;
  status: Record<string, 'completed' | 'incomplete' | 'optional'>;
}

export const profileApi = {
  getFull: (token: string) => request<FullProfileResponse>('/me/profile/full', { headers: authHeaders(token) }),
  updateBasic: (token: string, data: { fullName?: string }) =>
    request<CandidateProfile>('/me/profile', { method: 'PATCH', headers: authHeaders(token), body: JSON.stringify(data) }),
  updatePersonal: (token: string, data: Partial<FullProfile>) =>
    request<FullProfile>('/me/profile/personal', { method: 'PATCH', headers: authHeaders(token), body: JSON.stringify(data) }),
  updateCareer: (token: string, data: Partial<FullProfile>) =>
    request<FullProfile>('/me/profile/career', { method: 'PATCH', headers: authHeaders(token), body: JSON.stringify(data) }),
  updateQuick: (
    token: string,
    data: {
      fullName?: string;
      desiredPosition?: string;
      desiredLevel?: string;
      desiredSalaryMin?: number;
      desiredSalaryMax?: number;
      visibility?: ProfileVisibility;
      allowJobNotifications?: boolean;
    },
  ) => request<FullProfile>('/me/profile/quick', { method: 'PATCH', headers: authHeaders(token), body: JSON.stringify(data) }),
  uploadAvatar: (token: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return requestForm<{ avatarUrl: string }>('/me/profile/avatar', token, form);
  },
  removeAvatar: (token: string) => request<void>('/me/profile/avatar', { method: 'DELETE', headers: authHeaders(token) }),
  addItem: (token: string, section: SectionKey, data: unknown) =>
    request<any>(`/me/profile/sections/${section}`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify(data) }),
  updateItem: (token: string, section: SectionKey, id: string, data: unknown) =>
    request<any>(`/me/profile/sections/${section}/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),
  removeItem: (token: string, section: SectionKey, id: string) =>
    request<void>(`/me/profile/sections/${section}/${id}`, { method: 'DELETE', headers: authHeaders(token) }),
  avatarUrl: (profileId: string) => `${API_URL}/files/avatar/${profileId}`,
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

// Đợt 11b — Mục #4 ATS: 4 trạng thái tin tự quản lý (tính từ approvalStatus + isPaused + deadline
// ở backend, xem computeEmployerStatus() trong employer.service.ts).
export type EmployerJobStatus = 'dang_dang' | 'cho_dang' | 'tam_ngung' | 'het_han' | 'khac';

export interface EmployerJob extends JobPosting {
  applicationCount: number;
  employerStatus?: EmployerJobStatus;
}

export interface EmployerJobStatusCounts {
  dang_dang: number;
  cho_dang: number;
  tam_ngung: number;
  het_han: number;
  khac: number;
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
  // Đợt 11b — Mục #4 ATS: đánh giá sao, thư mục, thùng rác.
  rating?: number;
  folder?: string;
  deletedAt?: string;
  cv: {
    id: string;
    fileUrl?: string;
    originalFileName?: string;
    externalLinkUrl?: string;
    candidateProfile: EmployerApplicantProfile;
  };
}

// Bộ lọc nâng cao cho danh sách ứng viên theo tin (mục #4 ATS).
export interface ApplicantFilters {
  status?: ApplicationStatus;
  folder?: string;
  ratingMin?: number;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
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
  provinces?: string[];
  district?: string;
  experienceLevel?: string;
  isUrgent?: boolean;
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
  listJobs: (token: string, status?: EmployerJobStatus) =>
    request<EmployerJob[]>(`/employer/jobs${status ? `?status=${status}` : ''}`, { headers: authHeaders(token) }),
  getJobStatusCounts: (token: string) =>
    request<EmployerJobStatusCounts>('/employer/jobs/status-counts', { headers: authHeaders(token) }),
  createJob: (token: string, dto: CreateJobPayload) =>
    request<JobPosting>('/employer/jobs', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  getJob: (token: string, id: string) =>
    request<JobPosting>(`/employer/jobs/${id}`, { headers: authHeaders(token) }),
  pauseJob: (token: string, id: string) =>
    request<EmployerJob>(`/employer/jobs/${id}/pause`, { method: 'PATCH', headers: authHeaders(token) }),
  resumeJob: (token: string, id: string) =>
    request<EmployerJob>(`/employer/jobs/${id}/resume`, { method: 'PATCH', headers: authHeaders(token) }),
  duplicateJob: (token: string, id: string) =>
    request<EmployerJob>(`/employer/jobs/${id}/duplicate`, { method: 'POST', headers: authHeaders(token) }),
  listApplicants: (token: string, jobId: string, filters: ApplicantFilters = {}) => {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<EmployerApplication[]>(`/employer/jobs/${jobId}/applicants${suffix}`, {
      headers: authHeaders(token),
    });
  },
  listTrashedApplicants: (token: string, jobId: string) =>
    request<EmployerApplication[]>(`/employer/jobs/${jobId}/applicants/trash`, { headers: authHeaders(token) }),
  listFolders: (token: string) => request<string[]>('/employer/folders', { headers: authHeaders(token) }),
  updateApplicationStatus: (token: string, applicationId: string, status: ApplicationStatus) =>
    request<EmployerApplication>(`/employer/applications/${applicationId}/status`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ status }),
    }),
  rateApplication: (token: string, applicationId: string, rating: number) =>
    request<EmployerApplication>(`/employer/applications/${applicationId}/rating`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ rating }),
    }),
  setApplicationFolder: (token: string, applicationId: string, folder?: string) =>
    request<EmployerApplication>(`/employer/applications/${applicationId}/folder`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ folder }),
    }),
  trashApplication: (token: string, applicationId: string) =>
    request<{ success: boolean }>(`/employer/applications/${applicationId}/trash`, {
      method: 'POST',
      headers: authHeaders(token),
    }),
  restoreApplication: (token: string, applicationId: string) =>
    request<{ success: boolean }>(`/employer/applications/${applicationId}/restore`, {
      method: 'POST',
      headers: authHeaders(token),
    }),
  permanentlyDeleteApplication: (token: string, applicationId: string) =>
    request<{ success: boolean }>(`/employer/applications/${applicationId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
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
};

// ===== Đợt 9 — Tìm kiếm hồ sơ ứng viên cho nhà tuyển dụng =====

export interface CandidateSearchParams {
  q?: string;
  industries?: string[];
  locations?: string[];
  skills?: string[];
  desiredLevel?: string;
  highestDegree?: string;
  experienceMin?: number;
  experienceMax?: number;
  salaryMin?: number;
  salaryMax?: number;
  urgentOnly?: boolean;
  unlockedOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CandidateSkillSummary {
  skillName: string;
  level: SkillLevel;
}
export interface CandidateLanguageSummary {
  language: string;
  level: LanguageLevel;
}

export interface CandidateSearchItem {
  id: string;
  fullName: string;
  profileTitle?: string;
  desiredPosition?: string;
  desiredLevel?: string;
  desiredSalaryMin?: number;
  desiredSalaryMax?: number;
  salaryCurrency?: string;
  yearsOfExperience?: number;
  highestDegree?: string;
  province?: string;
  visibility: ProfileVisibility;
  completionPercent: number;
  skills: CandidateSkillSummary[];
  languages: CandidateLanguageSummary[];
  latestExperience: { position: string; companyName?: string; isCurrent: boolean } | null;
  unlocked: boolean;
}

export interface CandidateSearchResult {
  items: CandidateSearchItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CandidateCredits {
  remaining: number;
  nearestExpiresAt: string | null;
  orders: Order[];
}

export interface CandidateDetailExperience {
  id: string;
  position: string;
  companyName?: string;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
  description?: string;
}
export interface CandidateDetailEducation {
  id: string;
  schoolName?: string;
  degree?: string;
  major?: string;
  startDate?: string;
  endDate?: string;
}

export interface CandidateDetail {
  id: string;
  fullName: string;
  profileTitle?: string;
  dateOfBirth?: string;
  gender?: Gender;
  phone?: string;
  contactEmail?: string;
  address?: string;
  nationality?: string;
  maritalStatus?: MaritalStatus;
  country?: string;
  province?: string;
  district?: string;
  careerObjective?: string;
  desiredPosition?: string;
  desiredLevel?: string;
  desiredSalaryMin?: number;
  desiredSalaryMax?: number;
  salaryCurrency?: string;
  desiredIndustries?: string[];
  desiredLocations?: string[];
  desiredJobTypes?: string[];
  yearsOfExperience?: number;
  currentLevel?: string;
  highestDegree?: string;
  hideContactInfo: boolean;
  visibility: ProfileVisibility;
  avatarUrl: string | null;
  experiences: CandidateDetailExperience[];
  educations: CandidateDetailEducation[];
  certificates: CertificateItem[];
  languages: LanguageItem[];
  skills: SkillItem[];
  achievements: AchievementItem[];
  activities: (ActivityItem & { organizationName?: string })[];
  unlocked: boolean;
  contactHiddenByCandidate: boolean;
}

export interface UnlockedProfileRow {
  unlockedAt: string;
  profile: CandidateSearchItem;
}

function buildSearchQuery(params: CandidateSearchParams): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.industries?.length) qs.set('industries', params.industries.join(','));
  if (params.locations?.length) qs.set('locations', params.locations.join(','));
  if (params.skills?.length) qs.set('skills', params.skills.join(','));
  if (params.desiredLevel) qs.set('desiredLevel', params.desiredLevel);
  if (params.highestDegree) qs.set('highestDegree', params.highestDegree);
  if (params.experienceMin != null) qs.set('experienceMin', String(params.experienceMin));
  if (params.experienceMax != null) qs.set('experienceMax', String(params.experienceMax));
  if (params.salaryMin != null) qs.set('salaryMin', String(params.salaryMin));
  if (params.salaryMax != null) qs.set('salaryMax', String(params.salaryMax));
  if (params.urgentOnly) qs.set('urgentOnly', 'true');
  if (params.unlockedOnly) qs.set('unlockedOnly', 'true');
  qs.set('page', String(params.page ?? 1));
  qs.set('pageSize', String(params.pageSize ?? 10));
  return qs.toString();
}

export const cvSearchApi = {
  search: (token: string, params: CandidateSearchParams) =>
    request<CandidateSearchResult>(`/employer/candidates?${buildSearchQuery(params)}`, { headers: authHeaders(token) }),
  getCredits: (token: string) => request<CandidateCredits>('/employer/candidates/credits', { headers: authHeaders(token) }),
  listUnlocked: (token: string) =>
    request<UnlockedProfileRow[]>('/employer/candidates/unlocked', { headers: authHeaders(token) }),
  getDetail: (token: string, id: string) =>
    request<CandidateDetail>(`/employer/candidates/${id}`, { headers: authHeaders(token) }),
  unlock: (token: string, id: string) =>
    request<CandidateDetail>(`/employer/candidates/${id}/unlock`, { method: 'POST', headers: authHeaders(token) }),
};

// Đợt 12d (21/09/2026) — banner "X người đang truy cập" ở trang chủ, gọi PresenceModule (đợt 12a).
export const presenceApi = {
  ping: (sessionId: string) =>
    request<{ success: boolean }>('/presence/ping', { method: 'POST', body: JSON.stringify({ sessionId }) }),
  getCount: () => request<{ displayed: number }>('/presence/count'),
};
