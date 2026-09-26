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
  // Đợt 12q (21/09/2026) — Batch 5 mục #1: cờ "Doanh nghiệp yêu thích", bật/tắt qua Admin Console.
  isFeaturedEmployer?: boolean;
  // Đợt 12ab (24/09/2026) — logo qua link ảnh (URL) + số lượt "Theo dõi công ty".
  logoUrl?: string;
  followersCount?: number;
  // Đợt 12ac (24/09/2026) — "Giới thiệu công ty" cho tab Tổng quan công ty (trang chi tiết tin).
  description?: string;
  // Đợt 17 (25/09/2026) — "Nguồn ngoài / Tin tổng hợp": true nếu Admin tạo hộ từ nguồn ngoài;
  // claimedAt có giá trị nghĩa là công ty thật đã "nhận lại" — FE hiện badge "Tin tổng hợp — chưa xác
  // thực" khi isAdminSourced && !claimedAt (xem CompanyBadge trong components/CompanyLogo.tsx).
  isAdminSourced?: boolean;
  sourceLabel?: string;
  claimedAt?: string;
  // Đợt 17 — chỉ có ở AdminApi.listSourcedCompanies() (số tin của công ty này, mọi trạng thái).
  jobCount?: number;
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
  // Đợt 14 (25/09/2026) — mục 15: đổi từ mảng chip sang rich text tự do (HTML), giống
  // description/requirements — xem job-posting.entity.ts.
  benefits?: string;
  deadline?: string;
  // Đợt 12k (21/09/2026) — khối "Địa điểm làm việc" (địa chỉ chi tiết) và "Thông tin khác".
  address?: string;
  gender?: string;
  ageRange?: string;
  workSchedule?: string;
  // Đợt 12v (21/09/2026) — "JOB TAGS / SKILLS": thẻ từ khoá/kỹ năng NTD tự nhập, hiển thị dạng chip
  // dưới khối "Thông tin khác" ở trang chi tiết tin (theo ảnh mẫu người dùng gửi).
  tags?: string[];
  // Đợt 12x (21/09/2026) — "Bắt buộc nhập lý do khi Từ chối": lý do Admin chọn (danh mục cố định,
  // xem JOB_REJECTION_REASONS ở catalogs.ts) + ghi chú tự do, NTD xem lại được để biết cần sửa gì.
  rejectionReasons?: string[];
  rejectionNote?: string;
  // Đợt 12aa (24/09/2026) — "Thông tin liên hệ" (không bắt buộc), theo mẫu careerviet.vn.
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  // Đợt 14 (25/09/2026) — mục 15: khung mô tả thêm tự do cạnh 3 trường liên hệ ở trên.
  contactNote?: string;
  approvalStatus?: JobApprovalStatus;
  // Đợt 15 (25/09/2026) — "Tự động duyệt tin": true nếu tin này được hệ thống tự động duyệt (khác
  // Admin duyệt tay) sau 15 phút chờ; adminReviewed = false nghĩa là Admin CHƯA bấm "Tin đã kiểm
  // tra" nên tin vẫn còn hiện trong danh sách "Duyệt tin" (xem admin/dashboard/page.tsx).
  autoApproved?: boolean;
  adminReviewed?: boolean;
  // Đợt 12l (21/09/2026) — dùng ở trang Xem trước NTD để hiện đúng trạng thái "Tạm ngưng".
  isPaused?: boolean;
  // Đợt 12p (21/09/2026) — lượt xem trang chi tiết công khai, dùng cho thống kê "Tỷ lệ chuyển đổi"
  // (hồ sơ/lượt xem) ở trang Tin đăng NTD.
  viewCount?: number;
  // Đợt 17 (25/09/2026) — "Nguồn ngoài / Tin tổng hợp": link gốc (chỉ Admin dùng nội bộ, không hiện
  // công khai ở FE — xem ghi chú ở job-posting.entity.ts).
  sourceUrl?: string;
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
  logoUrl?: string;
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
  // Đợt 12ab (24/09/2026) — "Đánh giá mức độ tương thích" (radar chart), chỉ ứng viên đã đăng nhập.
  getCompatibility: (token: string, id: string) =>
    request<CompatibilityResult>(`/jobs/${id}/compatibility`, { headers: authHeaders(token) }),
  // Đợt 13 (24/09/2026) — "Thống kê trang chủ" thật (thay 3/4 số ảo hard-code trước đó), công khai.
  homepageStats: () => request<HomepageStats>('/jobs/stats/homepage'),
};

export interface HomepageStats {
  memberCount: number;
  companyCount: number;
  openJobCount: number;
  profilesUpdatedToday: number;
  applicationsToday: number;
}

export interface CompatibilityCriterion {
  key: string;
  label: string;
  score: number;
  weight: number;
}

// Đợt 13 (24/09/2026) — "TIÊU CHÍ ĐÁNH GIÁ" dạng checklist chia nhóm (theo mẫu careerviet.vn),
// bổ sung cho biểu đồ radar hiện có (không thay thế — người dùng chọn giữ cả 2).
export interface CompatibilityChecklistItem {
  group: 'overview' | 'experience' | 'education' | 'skills';
  key: string;
  label: string;
  detail: string;
  matched: boolean;
}

export interface CompatibilityResult {
  overall: number;
  criteria: CompatibilityCriterion[];
  checklist: CompatibilityChecklistItem[];
  missingSkills: string[];
}

// Đợt 12k (21/09/2026) — trang công ty công khai /cong-ty/[id]: thông tin công ty + toàn bộ tin
// đang tuyển khác của công ty đó, bấm vào từ tên công ty trong trang chi tiết tin tuyển dụng.
export interface CompanyProfileResponse {
  company: Company;
  jobs: JobPosting[];
  totalJobs: number;
}

// Đợt 17 (25/09/2026) — "Đây là công ty của bạn?", form công khai ở trang /cong-ty/[id].
export interface ClaimRequestPayload {
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  note?: string;
}

export const companiesApi = {
  getProfile: (id: string) => request<CompanyProfileResponse>(`/companies/${id}`),
  submitClaimRequest: (id: string, dto: ClaimRequestPayload) =>
    request<{ success: true; id: string }>(`/companies/${id}/claim-request`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
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
  // Đợt 12p (21/09/2026) — GET /me/profile thật ra trả về toàn bộ CandidateProfile (entity backend
  // có sẵn các trường này từ đợt 8), chỉ là type FE trước đây khai báo thiếu. Bổ sung để trang
  // ho-so/page.tsx dùng được cho gợi ý việc làm đa tiêu chí (getRecommendedJobs).
  province?: string;
  desiredIndustries?: string[];
  desiredLocations?: string[];
  desiredJobTypes?: string[];
  // Đợt 12ab (24/09/2026) — "Làm mới hồ sơ" cần biết lần cập nhật gần nhất để tính giãn cách 24h.
  updatedAt?: string;
}

// Đợt 12ab (24/09/2026) — "Nhà tuyển dụng của tôi": công ty đã xem hồ sơ (qua UnlockedProfile có
// sẵn) + công ty đang theo dõi (CompanyFollow mới).
export interface ViewedByCompanyRow {
  viewedAt: string;
  company: { id: string; name: string; industry?: string; size?: string; logoUrl?: string };
}

export interface FollowedCompany {
  id: string;
  companyId: string;
  company: Company;
  createdAt: string;
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

// Đợt 12m (21/09/2026) — "Tìm kiếm đã lưu" (Job alert): lưu nguyên bộ lọc /viec-lam hiện tại, dùng
// làm tiêu chí so khớp khi có tin mới được Admin duyệt (xem notifyJobAlertMatches() backend).
export interface SavedSearch {
  id: string;
  ownerType: string;
  ownerId: string;
  criteria: Record<string, unknown>;
  resultCount: number;
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

  // Đợt 12m (21/09/2026) — "Tìm kiếm đã lưu" (Job alert).
  listSavedSearches: (token: string) =>
    request<SavedSearch[]>('/me/saved-searches', { headers: authHeaders(token) }),
  saveSearch: (token: string, dto: { criteria: Record<string, unknown>; resultCount?: number }) =>
    request<SavedSearch>('/me/saved-searches', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  removeSavedSearch: (token: string, id: string) =>
    request<void>(`/me/saved-searches/${id}`, { method: 'DELETE', headers: authHeaders(token) }),

  // Đợt 12p (21/09/2026) — gợi ý việc làm chấm điểm theo ngành/địa điểm/hình thức/cấp bậc/kỹ năng.
  getJobRecommendations: (token: string) =>
    request<JobPosting[]>('/me/job-recommendations', { headers: authHeaders(token) }),

  // Đợt 12ab (24/09/2026) — "Làm mới hồ sơ" + "Nhà tuyển dụng của tôi".
  refreshProfile: (token: string) =>
    request<CandidateProfile>('/me/profile/refresh', { method: 'POST', headers: authHeaders(token) }),
  listViewedByCompanies: (token: string) =>
    request<ViewedByCompanyRow[]>('/me/viewed-by-companies', { headers: authHeaders(token) }),
  listFollowedCompanies: (token: string) =>
    request<FollowedCompany[]>('/me/followed-companies', { headers: authHeaders(token) }),
  followCompany: (token: string, companyId: string) =>
    request<FollowedCompany>(`/me/followed-companies/${companyId}`, { method: 'POST', headers: authHeaders(token) }),
  unfollowCompany: (token: string, companyId: string) =>
    request<void>(`/me/followed-companies/${companyId}`, { method: 'DELETE', headers: authHeaders(token) }),
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

// Đợt 12o (21/09/2026) — "Nhật ký trạng thái ứng tuyển": mỗi dòng ghi 1 lần trạng thái đơn thay đổi.
export interface ApplicationStatusHistoryItem {
  id: string;
  applicationId: string;
  status: ApplicationStatus;
  createdAt: string;
}

export const applicationsApi = {
  apply: (token: string, jobId: string, dto: { cvId: string; coverLetter?: string }) =>
    request<Application>(`/jobs/${jobId}/apply`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  listOwn: (token: string) => request<Application[]>('/me/applications', { headers: authHeaders(token) }),
  getHistory: (token: string, applicationId: string) =>
    request<ApplicationStatusHistoryItem[]>(`/me/applications/${applicationId}/history`, {
      headers: authHeaders(token),
    }),
};

// ===== Nhà tuyển dụng (Employer) =====

// Đợt 11b — Mục #4 ATS: trạng thái tin tự quản lý (tính từ approvalStatus + isPaused + deadline ở
// backend, xem computeEmployerStatus() trong employer.service.ts). Đợt 12x — tách 'bi_tu_choi'.
export type EmployerJobStatus = 'dang_dang' | 'cho_dang' | 'tam_ngung' | 'het_han' | 'bi_tu_choi' | 'khac';

export interface EmployerJob extends JobPosting {
  applicationCount: number;
  employerStatus?: EmployerJobStatus;
}

export interface EmployerJobStatusCounts {
  dang_dang: number;
  cho_dang: number;
  tam_ngung: number;
  het_han: number;
  bi_tu_choi: number;
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
  // Đợt 12l (21/09/2026) — `null` cho phép trang Sửa tin XOÁ mức lương cũ khi bật lại "Thoả thuận"
  // (updateJob() ở backend chỉ ghi đè trường có mặt trong body — gửi null nghĩa là xoá).
  salaryMin?: number | null;
  salaryMax?: number | null;
  employmentType?: string;
  level?: string;
  headcount?: number;
  description?: string;
  requirements?: string;
  // Đợt 14 (25/09/2026) — mục 15: đổi từ mảng chip sang rich text tự do (HTML).
  benefits?: string;
  deadline?: string;
  // Đợt 12k (21/09/2026) — khối "Địa điểm làm việc" (địa chỉ chi tiết) và "Thông tin khác".
  address?: string;
  gender?: string;
  ageRange?: string;
  workSchedule?: string;
  tags?: string[];
  // Đợt 12aa (24/09/2026) — "Thông tin liên hệ" (không bắt buộc), theo mẫu careerviet.vn.
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  // Đợt 14 (25/09/2026) — mục 15: khung mô tả thêm tự do cạnh 3 trường liên hệ ở trên.
  contactNote?: string;
  // Đợt 17 (25/09/2026) — chỉ dùng khi Admin đăng tin hộ (adminApi.createJobForCompany).
  sourceUrl?: string;
}

// ===== B5 — Tài khoản & Hồ sơ công ty =====

export interface UpdateCompanyPayload {
  size?: string;
  industry?: string;
  website?: string;
  // Đợt 12ab (24/09/2026) — logo công ty qua link ảnh (URL).
  logoUrl?: string;
  // Đợt 12ac (24/09/2026) — "Giới thiệu công ty" cho tab Tổng quan công ty.
  description?: string;
}

// Đợt 12ac (24/09/2026) — "Quản lý địa điểm làm việc" (chọn nhanh khi đăng tin).
export interface WorkLocation {
  id: string;
  companyId: string;
  label: string;
  province: string;
  district?: string;
  address?: string;
  createdAt: string;
}

export interface CreateWorkLocationPayload {
  label: string;
  province: string;
  district?: string;
  address?: string;
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
  // Đợt 12ac (24/09/2026) — Quản lý địa điểm làm việc.
  listWorkLocations: (token: string) =>
    request<WorkLocation[]>('/employer/work-locations', { headers: authHeaders(token) }),
  createWorkLocation: (token: string, dto: CreateWorkLocationPayload) =>
    request<WorkLocation>('/employer/work-locations', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  updateWorkLocation: (token: string, id: string, dto: Partial<CreateWorkLocationPayload>) =>
    request<WorkLocation>(`/employer/work-locations/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  deleteWorkLocation: (token: string, id: string) =>
    request<{ success: true }>(`/employer/work-locations/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
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
  // Đợt 12l (21/09/2026) — sửa tin đã đăng. Chỉ gửi trường thay đổi; backend luôn đưa tin về PENDING
  // chờ Admin duyệt lại sau khi lưu.
  updateJob: (token: string, id: string, dto: Partial<CreateJobPayload>) =>
    request<JobPosting>(`/employer/jobs/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
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

// Đợt 12q (21/09/2026) — Batch 5.
export interface AdminStatsPoint {
  date: string;
  jobsPosted: number;
  companiesRegistered: number;
  candidatesRegistered: number;
  applications: number;
}

export interface AdminAuditLogEntry {
  id: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId?: string;
  description?: string;
  createdAt: string;
}

export interface AdminAuditLogResponse {
  items: AdminAuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BulkActionResult {
  succeeded: number;
  failed: string[];
}

export const adminApi = {
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

// Đợt 17 (25/09/2026) — "Nguồn ngoài / Tin tổng hợp": type cho form tạo công ty nháp, tài khoản tạm
// trả về sau khi tạo/claim, chuyển giao thủ công, trích xuất URL, và yêu cầu "nhận lại" công khai.
export interface CreateDraftCompanyPayload {
  name: string;
  industry?: string;
  size?: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  sourceLabel?: string;
}

export interface DraftAccountInfo {
  email: string;
  tempPassword: string;
  note?: string;
}

export interface ClaimCompanyPayload {
  email: string;
  fullName?: string;
  phone?: string;
  taxCode?: string;
}

export interface ExtractedJobData {
  title?: string;
  companyName?: string;
  description?: string;
  location?: string;
  employmentType?: string;
  salaryMin?: number;
  salaryMax?: number;
  // Đợt 17d (25/09/2026) — schema.org `validThrough` (hạn nộp hồ sơ), trước đó bỏ sót.
  deadline?: string;
}

export interface ExtractJobUrlResult {
  found: boolean;
  data: ExtractedJobData;
  warning?: string;
}

export type CompanyClaimRequestStatus = 'pending' | 'approved' | 'rejected';

export interface CompanyClaimRequestRow {
  id: string;
  companyId: string;
  company?: Company;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  note?: string;
  status: CompanyClaimRequestStatus;
  adminNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

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
  // Đợt 12ac (24/09/2026) — xem lại đúng các hồ sơ NTD đã tự ẩn (để có thể bỏ ẩn).
  hiddenOnly?: boolean;
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
  // Đợt 12ac (24/09/2026) — icon hành động: ghi chú riêng + đã ẩn (chỉ công ty đang xem thấy).
  note?: string;
  hidden: boolean;
  // Đợt 18c (26/09/2026) — hồ sơ "Nguồn tổng hợp" do đội ngũ web tổng hợp (ứng viên chưa tự quản lý).
  isAdminSourced?: boolean;
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
  // Đợt 12ac (24/09/2026) — ghi chú riêng + trạng thái ẩn (chỉ công ty đang xem thấy).
  note?: string;
  hidden: boolean;
  isAdminSourced?: boolean;
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
  if (params.hiddenOnly) qs.set('hiddenOnly', 'true');
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
  // Đợt 12ac (24/09/2026) — icon hành động: ghi chú riêng, ẩn khỏi danh sách, mời ứng tuyển.
  setNote: (token: string, id: string, dto: { note?: string; hidden?: boolean }) =>
    request<{ note?: string; hidden: boolean }>(`/employer/candidates/${id}/note`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  invite: (token: string, id: string, jobPostingId: string) =>
    request<{ success: true }>(`/employer/candidates/${id}/invite`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ jobPostingId }),
    }),
};

// Đợt 12d (21/09/2026) — banner "X người đang truy cập" ở trang chủ, gọi PresenceModule (đợt 12a).
export const presenceApi = {
  ping: (sessionId: string) =>
    request<{ success: boolean }>('/presence/ping', { method: 'POST', body: JSON.stringify({ sessionId }) }),
  getCount: () => request<{ displayed: number }>('/presence/count'),
};

// Đợt 12m (21/09/2026) — chuông thông báo hoạt động thật (dùng chung ứng viên/NTD/admin).
export type NotificationType =
  | 'profile_viewed'
  | 'interview_invite'
  | 'application_status'
  | 'job_approved'
  | 'job_rejected'
  | 'company_approved'
  | 'company_rejected'
  | 'job_alert_match'
  | string;

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export const notificationsApi = {
  list: (token: string) => request<AppNotification[]>('/notifications', { headers: authHeaders(token) }),
  unreadCount: (token: string) => request<number>('/notifications/unread-count', { headers: authHeaders(token) }),
  markRead: (token: string, id: string) =>
    request<AppNotification>(`/notifications/${id}/read`, { method: 'PATCH', headers: authHeaders(token) }),
  markAllRead: (token: string) =>
    request<{ success: true }>('/notifications/read-all', { method: 'PATCH', headers: authHeaders(token) }),
};

// ===== Đợt 18a (26/09/2026) — "Kho CV" của nhà tuyển dụng =====
// Mỗi lần ứng viên ứng tuyển, backend tự chụp lại TOÀN BỘ hồ sơ 13 mục + bản sao file CV vào kho riêng
// của công ty — vẫn còn kể cả khi ứng viên xoá tài khoản. 1 thẻ = 1 người (gộp nhiều lần ứng tuyển).

export interface CvArchiveSnapshot {
  accountEmail?: string | null;
  fullName: string;
  profileTitle?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  phone?: string | null;
  contactEmail?: string | null;
  nationality?: string | null;
  maritalStatus?: string | null;
  country?: string | null;
  province?: string | null;
  district?: string | null;
  address?: string | null;
  careerObjective?: string | null;
  desiredPosition?: string | null;
  desiredLevel?: string | null;
  desiredSalaryMin?: number | null;
  desiredSalaryMax?: number | null;
  salaryCurrency?: string | null;
  desiredIndustries?: string[] | null;
  desiredLocations?: string[] | null;
  desiredJobTypes?: string[] | null;
  yearsOfExperience?: number | null;
  currentLevel?: string | null;
  highestDegree?: string | null;
  experiences: {
    position: string;
    companyName?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    isCurrent: boolean;
    description?: string | null;
  }[];
  educations: {
    schoolName?: string | null;
    degree?: string | null;
    major?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }[];
  certificates: { name: string; issuer?: string | null; issueDate?: string | null }[];
  languages: { language: string; level: string }[];
  skills: { skillName: string; level: string }[];
  achievements: { title: string; description?: string | null; date?: string | null }[];
  activities: {
    title: string;
    organizationName?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    description?: string | null;
  }[];
  references: {
    fullName: string;
    position?: string | null;
    company?: string | null;
    phone?: string | null;
    email?: string | null;
  }[];
}

export interface CvArchiveCard {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  province: string | null;
  headline: string | null;
  yearsOfExperience: number | null;
  skills: string[];
  applicationCount: number;
  lastAppliedAt: string;
  inTrash: boolean;
  // Ứng viên đã xoá tài khoản — dữ liệu trong kho vẫn còn đủ.
  accountDeleted: boolean;
}

export interface CvArchiveListItem extends CvArchiveCard {
  positions: {
    entryId: string;
    jobPostingId: string | null;
    jobTitle: string;
    appliedAt: string;
    entrySource?: 'application' | 'employer_import';
  }[];
}

export interface CvArchiveListResponse {
  items: CvArchiveListItem[];
  total: number;
  page: number;
  pageSize: number;
  activeCount: number;
  trashCount: number;
}

export interface CvArchiveEntryDetail {
  id: string;
  applicationId: string | null;
  jobPostingId: string | null;
  jobTitle: string;
  appliedAt: string;
  coverLetter: string | null;
  cvType: string | null;
  cvFileName: string | null;
  cvHasFile: boolean;
  cvExternalLink: string | null;
  snapshot: CvArchiveSnapshot;
  // Đợt 18b/18d (26/09/2026) — nội dung đọc từ file CV + nguồn của lần nộp.
  entrySource?: 'application' | 'employer_import';
  cvTextStatus?: 'ok' | 'empty' | 'unsupported' | 'error' | null;
  cvParsed?: ParsedCv | null;
  cvText?: string | null;
}

export interface CvArchiveDetail extends CvArchiveCard {
  entries: CvArchiveEntryDetail[];
}

export interface CvArchiveJobOption {
  jobId: string;
  jobTitle: string;
  count: number;
}

export interface CvArchiveListParams {
  q?: string;
  jobId?: string;
  trash?: boolean;
  page?: number;
  pageSize?: number;
}

export const cvArchiveApi = {
  list: (token: string, params: CvArchiveListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.jobId) qs.set('jobId', params.jobId);
    if (params.trash) qs.set('trash', 'true');
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<CvArchiveListResponse>(`/employer/cv-archive${suffix}`, { headers: authHeaders(token) });
  },
  listJobs: (token: string) =>
    request<CvArchiveJobOption[]>('/employer/cv-archive/jobs', { headers: authHeaders(token) }),
  getDetail: (token: string, id: string) =>
    request<CvArchiveDetail>(`/employer/cv-archive/${id}`, { headers: authHeaders(token) }),
  trash: (token: string, id: string) =>
    request<{ success: true }>(`/employer/cv-archive/${id}/trash`, { method: 'POST', headers: authHeaders(token) }),
  restore: (token: string, id: string) =>
    request<{ success: true }>(`/employer/cv-archive/${id}/restore`, { method: 'POST', headers: authHeaders(token) }),
  // Đợt 18d — NTD tự thêm CV từ nguồn ngoài (đã xem lại trên form) vào Kho CV.
  importCv: (token: string, draft: CandidateDraft, file?: File | null) => {
    const form = new FormData();
    form.append('payload', JSON.stringify(draft));
    if (file) form.append('file', file);
    return requestForm<{ id: string }>('/employer/cv-archive/import', token, form);
  },
  // Tệp CV trong kho bắt buộc đăng nhập mới tải được → tải về dạng Blob kèm token rồi mở bằng URL tạm.
  downloadFile: async (token: string, entryId: string): Promise<Blob> => {
    const res = await fetch(`${API_URL}/employer/cv-archive/entries/${entryId}/file`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new ApiError((data && data.message) || 'Không tải được tệp CV', res.status);
    }
    return res.blob();
  },
};

// ===================================================================================================
// Đợt 18b–18f (26/09/2026) — đọc/tách CV, nguồn CV tổng hợp, quản lý người dùng & ứng viên (Admin)
// ===================================================================================================

export interface ParsedCv {
  fullName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  address?: string;
  province?: string;
  headline?: string;
  careerObjective?: string;
  yearsOfExperience?: number;
  experiences: DraftExperience[];
  educations: DraftEducation[];
  skills: string[];
  languages: { language: string; level?: string }[];
  certificates: string[];
  sections: { key: string; title: string; content: string }[];
}

export interface DraftExperience {
  position: string;
  companyName?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
}

export interface DraftEducation {
  schoolName?: string;
  degree?: string;
  major?: string;
  startDate?: string;
  endDate?: string;
}

// Bản nháp hồ sơ ứng viên dùng chung cho form "Thêm CV" (NTD) và "Tạo hồ sơ nguồn tổng hợp" (Admin).
export interface CandidateDraft {
  fullName: string;
  profileTitle?: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  province?: string;
  address?: string;
  desiredPosition?: string;
  desiredLevel?: string;
  desiredSalaryMin?: number;
  desiredSalaryMax?: number;
  yearsOfExperience?: number;
  highestDegree?: string;
  careerObjective?: string;
  desiredIndustries?: string[];
  desiredLocations?: string[];
  experiences?: DraftExperience[];
  educations?: DraftEducation[];
  skills?: string[];
  languages?: { language: string; level?: string }[];
  certificates?: string[];
  rawText?: string;
  sourceLabel?: string;
  sourceUrl?: string;
  jobPostingId?: string;
}

export interface CvParseResult {
  status: 'ok' | 'empty' | 'unsupported' | 'error';
  text: string;
  parsed: ParsedCv | null;
  warning?: string;
  draft: Partial<CandidateDraft>;
}

export const cvParseApi = {
  text: (token: string, text: string) =>
    request<CvParseResult>('/cv-parse/text', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ text }) }),
  file: (token: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return requestForm<CvParseResult>('/cv-parse/file', token, form);
  },
  url: (token: string, url: string) =>
    request<CvParseResult>('/cv-parse/url', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ url }) }),
};

export type CvShareStatus = 'pending' | 'shared' | 'already_public' | 'dismissed';
export type RealProfileState = 'none' | 'deleted' | 'public' | 'locked' | 'not_searchable';

export interface CvQueueItem {
  id: string;
  companyId: string;
  companyName: string;
  fullName: string;
  headline: string | null;
  phone: string | null;
  email: string | null;
  province: string | null;
  yearsOfExperience: number | null;
  skills: string[];
  lastAppliedAt: string;
  positions: string[];
  fromImport: boolean;
  realProfileState: RealProfileState;
  shareStatus: CvShareStatus;
  sharedProfileId: string | null;
  shareDecidedAt: string | null;
}

export interface CvQueueResponse {
  items: CvQueueItem[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<CvShareStatus, number>;
}

export interface CvCardDraftResponse {
  card: CvArchiveDetail;
  companyName: string;
  realProfileState: RealProfileState;
  draft: CandidateDraft | null;
  shareStatus: CvShareStatus;
}

export interface SourcedProfileRow {
  id: string;
  userId: string;
  fullName: string;
  profileTitle: string | null;
  phone: string | null;
  email: string | null;
  province: string | null;
  sourceLabel: string | null;
  completionPercent: number;
  unlockCount: number;
  createdAt: string;
}

export interface ProfileRequestRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  requestType: 'remove' | 'claim';
  note: string | null;
  status: 'pending' | 'resolved' | 'rejected';
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  matches: { id: string; fullName: string; profileTitle: string | null; phone: string | null; email: string | null; sourceLabel: string | null }[];
}

function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const str = q.toString();
  return str ? `?${str}` : '';
}

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

export const publicProfileRequestApi = {
  create: (payload: { fullName: string; email: string; phone?: string; requestType: 'remove' | 'claim'; note?: string }) =>
    request<{ id: string; success: true }>('/public/candidate-profile-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// ---------- 18e — Người dùng ----------

export interface AdminPersonRow {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  status: string;
  createdAt: string;
  companyId: string | null;
  companyName: string | null;
  companyUserType: string | null;
  profileId: string | null;
  isAdminSourced: boolean;
}

export interface AdminPersonDetail {
  user: { id: string; email: string; fullName: string | null; phone: string | null; role: string; status: string; createdAt: string };
  company: {
    id: string;
    name: string;
    taxCode: string;
    industry: string | null;
    size: string | null;
    website: string | null;
    logoUrl: string | null;
    description: string | null;
    approvalStatus: string;
    companyUserType: string | null;
  } | null;
  profile: {
    id: string;
    fullName: string;
    profileTitle: string | null;
    phone: string | null;
    contactEmail: string | null;
    province: string | null;
    desiredPosition: string | null;
    visibility: ProfileVisibility;
    hideContactInfo: boolean;
    completionPercent: number;
    isAdminSourced: boolean;
    sourceLabel: string | null;
  } | null;
}

export interface ImpersonateResult {
  accessToken: string;
  user: { id: string; email: string; role: string; fullName?: string | null };
  expiresInMinutes: number;
}

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
    payload: { name?: string; taxCode?: string; industry?: string; size?: string; website?: string; logoUrl?: string; description?: string },
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

// ---------- 18f — Ứng viên ----------

export interface AdminCandidateRow {
  id: string;
  userId: string;
  fullName: string;
  email: string | null;
  userStatus: string;
  phone: string | null;
  contactEmail: string | null;
  profileTitle: string | null;
  desiredPosition: string | null;
  province: string | null;
  visibility: ProfileVisibility;
  completionPercent: number;
  yearsOfExperience: number | null;
  isAdminSourced: boolean;
  updatedAt: string;
  tags: string[];
  note: string | null;
  applicationCount: number;
  lastAppliedAt: string | null;
}

export interface AdminCandidateDetail {
  id: string;
  userId: string;
  email: string | null;
  userStatus: string | null;
  visibility: ProfileVisibility;
  hideContactInfo: boolean;
  completionPercent: number;
  isAdminSourced: boolean;
  sourceLabel: string | null;
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
  snapshot: CvArchiveSnapshot | null;
  tags: string[];
  note: string | null;
  noteUpdatedBy: string | null;
  applications: { id: string; jobId: string; jobTitle: string; companyName: string; appliedAt: string; status: string }[];
  archiveCards: { id: string; companyName: string; shareStatus: CvShareStatus; sharedProfileId: string | null }[];
}

export interface SuggestedJob {
  id: string;
  title: string;
  companyName: string;
  provinces: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  score: number;
  reasons: string[];
}

export interface AdminCandidateQuery {
  q?: string;
  applied?: 'none' | 'any';
  visibility?: ProfileVisibility;
  completionMin?: number;
  province?: string;
  skill?: string;
  tag?: string;
  sourced?: 'only' | 'exclude';
  page?: number;
  pageSize?: number;
}

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

// ============================================================================================
// Đợt 19 (26/09/2026) — Admin "Phân tích truy cập": 100% dữ liệu thật (bộ ghi truy cập + CSDL).
// ============================================================================================
export interface AnalyticsRangeInfo {
  from: string;
  to: string;
  days: number;
  mode: 'raw' | 'daily';
  retentionStart: string;
  clamped?: boolean;
}
export interface AnalyticsKpis {
  views: number;
  visitors: number;
  visitorsApprox: boolean;
  sessions: number;
  clicks: number;
  avgPageTimeMs: number;
  avgSessionTimeMs: number;
  bounceRate: number;
  pagesPerSession: number;
  newVisitorRate: number;
  loggedInRate: number;
  clicksPerView: number;
}
export interface AnalyticsDimRow {
  key: string;
  sessions: number;
  visitors: number;
  views: number;
  avgSessionTimeMs: number;
  bounceRate: number;
  conversions: number;
  conversionRate: number;
}
export interface AnalyticsPageRow {
  route: string;
  views: number;
  visitors: number;
  avgTimeMs: number;
  avgScroll: number;
  entries: number;
  exits: number;
  exitRate: number;
}
export interface AnalyticsOverview {
  range: AnalyticsRangeInfo;
  prevRange: { from: string; to: string };
  kpis: AnalyticsKpis;
  prevKpis: AnalyticsKpis;
  daily: { day: string; views: number; visitors: number; sessions: number }[];
  hours: { hour: number; views: number }[];
  weekHour: number[][] | null;
  topPages: AnalyticsPageRow[];
  dims: Partial<Record<'source' | 'channel' | 'device' | 'browser' | 'os' | 'city' | 'role' | 'campaign', AnalyticsDimRow[]>>;
  bots: { bot: string; hits: number }[];
}
export interface AnalyticsRealtime {
  online: {
    sessions: number;
    visitors: number;
    byRole: { candidate: number; employer: number; guest: number };
    byDevice: { desktop: number; mobile: number; tablet: number };
  };
  homepageBanner: { real: number; displayed: number; virtual: number };
  activePages: { route: string; path: string; count: number }[];
  perMinute: { minute: string; views: number }[];
  recentActions: {
    type: string;
    route: string;
    path: string | null;
    label: string | null;
    role: string;
    device: string;
    at: string;
    meta: Record<string, unknown> | null;
    jobTitle: string | null;
    companyName: string | null;
  }[];
  today: { views: number; visitors: number };
  at: string;
}
export interface AnalyticsJobRow {
  id: string;
  title: string;
  status: string | null;
  industry: string | null;
  companyId: string | null;
  companyName: string | null;
  views: number;
  visitors: number;
  avgTimeMs: number;
  avgScroll: number;
  applyClicks: number;
  applyClickVisitors: number;
  applications: number;
  saves: number;
  contacts: number;
  clickRate: number;
  conversionRate: number;
}
export interface AnalyticsContent {
  range: AnalyticsRangeInfo;
  funnel: {
    siteVisitors: number;
    searches: number;
    jobViews: number;
    jobVisitors: number;
    applyClicks: number;
    applyClickVisitors: number;
    applySubmitsTracked: number;
    applicationsDb: number;
  };
  jobs: AnalyticsJobRow[];
  industries: { industry: string; views: number; visitors: number; applications: number; jobs: number }[];
  companies: {
    id: string;
    name: string;
    pageViews: number;
    pageVisitors: number;
    avgTimeMs: number;
    jobViews: number;
    jobVisitors: number;
    follows: number;
    applications: number;
  }[];
  searches: { q: string; count: number; visitors: number; zero: number }[];
  zeroSearches: { q: string; count: number; zero: number }[];
  cvSearches: { q: string; count: number; visitors: number; zero: number }[];
  events: { type: string; count: number; visitors: number }[];
}
export interface AnalyticsBehavior {
  range: AnalyticsRangeInfo;
  dailyRoles: { day: string; candidate: number; employer: number; guest: number }[];
  returning: { visitors: number; returningVisitors: number; returningRate: number; multiSessionVisitors: number };
  frequency: { bucket: string; count: number }[];
  depth: { bucket: string; count: number }[];
  sessionLength: { bucket: string; count: number }[];
  paths: { from: string; to: string; count: number }[];
  entryPages: { route: string; count: number; views: number }[];
  exitPages: { route: string; count: number; views: number; exitRate: number }[];
  employer: { active: number; routes: { route: string; views: number; visitors: number }[]; cvSearches: number; cvUnlocks: number; jobsPosted: number };
  candidate: {
    active: number;
    routes: { route: string; views: number; visitors: number }[];
    applications: number;
    applicants: number;
    searches: number;
    saves: number;
    follows: number;
    contacts: number;
  };
  registrations: { candidates: number; employers: number };
  loggedInSessionRate: number;
  topUsers: { userId: string; email: string; role: string; views: number; sessions: number; totalTimeMs: number; lastSeen: string }[];
}
export interface AnalyticsHeatmap {
  range: { from: string; to: string };
  route: string;
  device: 'desktop' | 'mobile';
  path: string | null;
  clicks: number;
  visitors: number;
  docHeight: number;
  points: { x: number; y: number; n: number }[];
  elements: { label: string; count: number; visitors: number }[];
  pageviews: number;
  avgTimeMs: number;
  scrollReach: { depth: number; rate: number }[];
  samplePaths: { path: string; views: number }[];
}

export const adminAnalyticsApi = {
  realtime: (token: string) => request<AnalyticsRealtime>('/admin/analytics/realtime', { headers: authHeaders(token) }),
  overview: (token: string, from: string, to: string) =>
    request<AnalyticsOverview>(`/admin/analytics/overview${qs({ from, to })}`, { headers: authHeaders(token) }),
  content: (token: string, from: string, to: string) =>
    request<AnalyticsContent>(`/admin/analytics/content${qs({ from, to })}`, { headers: authHeaders(token) }),
  behavior: (token: string, from: string, to: string) =>
    request<AnalyticsBehavior>(`/admin/analytics/behavior${qs({ from, to })}`, { headers: authHeaders(token) }),
  heatmapPages: (token: string, from: string, to: string) =>
    request<{ range: { from: string; to: string }; pages: { route: string; device: string; clicks: number }[] }>(
      `/admin/analytics/heatmap/pages${qs({ from, to })}`,
      { headers: authHeaders(token) },
    ),
  heatmap: (token: string, params: { route: string; device: string; from: string; to: string; path?: string }) =>
    request<AnalyticsHeatmap>(`/admin/analytics/heatmap${qs(params)}`, { headers: authHeaders(token) }),
};
