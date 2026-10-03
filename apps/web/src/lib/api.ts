import type { BgImage, BgSetting } from './bg-themes';
import { loadBoot } from './boot';
import { markSlow } from './data-saver';
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Đợt 91 — logo công ty: nhờ API thu nhỏ (WebP ≤192px) thay vì tải ảnh gốc to. Bỏ qua ảnh đã nhỏ sẵn (favicon Google, data:).
export function logoProxyUrl(src: string, boxPx: number): string | null {
  if (!/^https?:\/\//i.test(src) || src.includes('google.com/s2/favicons') || src.startsWith(API_URL)) return null;
  return `${API_URL}/public/logo?s=${Math.round(boxPx * 2)}&u=${encodeURIComponent(src)}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Đợt 90 — lớp gọi API "không treo, không lỗi vặt":
// • GET không gửi Content-Type → trình duyệt không phải "hỏi trước" (preflight) với yêu cầu không đăng nhập.
// • Giới hạn 15 giây mỗi lần; GET tự thử lại 1 lần khi mạng chập chờn / máy chủ 502-504 (máy chủ miễn phí đang thức dậy).
// • Quá 4 giây chưa xong → phát sự kiện `tvl-api-slow` để hiện "Máy chủ đang khởi động…" thay vì màn hình đứng im.
// • GET công khai giống hệt nhau gọi cùng lúc được gộp làm 1 (nhiều khối trên trang dùng chung dữ liệu).
const TIMEOUT_MS = 15_000;
const SLOW_MS = 4_000;
const inflight = new Map<string, Promise<unknown>>();
let slowCount = 0;
function slowSignal(on: boolean) {
  if (typeof window === 'undefined') return;
  slowCount = Math.max(0, slowCount + (on ? 1 : -1));
  window.dispatchEvent(new CustomEvent('tvl-api-slow', { detail: slowCount > 0 }));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Đợt 110 — số lời gọi API đang chạy (cho thanh tiến độ mỏng trên cùng).
let busyCount = 0;
function busySignal(d: number) {
  if (typeof window === 'undefined') return;
  busyCount = Math.max(0, busyCount + d);
  window.dispatchEvent(new CustomEvent('tvl-api-busy', { detail: busyCount }));
}

async function fetchOnce(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const outer = init.signal;
  if (outer) outer.addEventListener('abort', () => ctrl.abort(), { once: true });
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let slow = false;
  const s = setTimeout(() => {
    slow = true;
    markSlow();
    slowSignal(true);
  }, SLOW_MS);
  busySignal(1);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    busySignal(-1);
    clearTimeout(t);
    clearTimeout(s);
    if (slow) slowSignal(false);
  }
}

// Đợt 94 — bộ đệm biên Vercel (xem next.config.mjs): khi bật, các GET công khai (không đăng nhập) trong danh sách này đi qua `/_c`.
const EDGE_CACHE = process.env.NEXT_PUBLIC_EDGE_CACHE === '1';
const EDGE_PATHS =
  /^\/(public\/boot|jobs\/home-bundle|jobs\/facets|jobs\/district-facets|jobs\/stats\/|jobs\/featured-employers|jobs\/province-insights|public\/workers\/catalog|jobs(\?|$)|jobs\/[0-9a-f-]{36}\?(.*&)?noview=1)/i;
export function apiBaseFor(path: string, method = 'GET', authed = false): string {
  return EDGE_CACHE && typeof window !== 'undefined' && method === 'GET' && !authed && EDGE_PATHS.test(path) ? '/_c' : API_URL;
}

async function doRequest<T>(path: string, options: RequestInit): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const hasBody = options.body !== undefined && options.body !== null;
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };
  if (hasBody && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const init: RequestInit = { ...options, headers };
  const url = `${apiBaseFor(path, method, !!headers.Authorization)}${path}`;
  const canRetry = method === 'GET';
  let res: Response | null = null;
  for (let attempt = 0; attempt < (canRetry ? 2 : 1); attempt++) {
    try {
      res = await fetchOnce(url, init);
      if (canRetry && attempt === 0 && [429, 502, 503, 504].includes(res.status)) {
        // Đợt 94 — chờ theo `Retry-After` (nếu máy chủ bảo) + độ trễ NGẪU NHIÊN: hàng nghìn người cùng thử lại đúng 1,5 giây sau
        // sẽ lại đổ dồn vào máy chủ đang quá tải; ngẫu nhiên hoá giúp dàn đều.
        const ra = Number(res.headers.get('retry-after'));
        await sleep(Math.min(5000, ra > 0 ? ra * 1000 : 1500) + Math.random() * 1200);
        continue;
      }
      break;
    } catch (e) {
      if (options.signal?.aborted) throw e;
      if (!canRetry || attempt === 1) {
        throw new ApiError(
          typeof navigator !== 'undefined' && navigator.onLine === false
            ? 'Mất kết nối mạng — kiểm tra wifi/4G rồi thử lại'
            : 'Máy chủ phản hồi chậm, vui lòng thử lại sau ít giây',
          0,
        );
      }
      await sleep(1500 + Math.random() * 1500);
    }
  }
  const r = res as Response;
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const message =
      (data && (Array.isArray(data.message) ? data.message.join(', ') : data.message)) ||
      (r.status === 429 ? 'Bạn thao tác quá nhanh, vui lòng chờ vài giây rồi thử lại' : 'Đã có lỗi xảy ra, vui lòng thử lại');
    throw new ApiError(message, r.status);
  }
  return data as T;
}

// Đợt 90 — dữ liệu máy chủ đã lấy sẵn khi dựng trang: khối nào gọi đúng đường này trong 60 giây thì dùng luôn, không gọi lại.
const primed = new Map<string, { exp: number; data: unknown }>();
export function primeGet(path: string, data: unknown, ttlMs = 60_000) {
  primed.set(path, { exp: Date.now() + ttlMs, data });
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const auth = (options.headers as Record<string, string> | undefined)?.Authorization;
  if (method !== 'GET' || options.signal) return doRequest<T>(path, options);
  if (!auth) {
    const p = primed.get(path);
    if (p && p.exp > Date.now()) return p.data as T;
  }
  const key = `${auth ?? ''}|${path}`;
  const hit = inflight.get(key);
  if (hit) return hit as Promise<T>;
  const p = doRequest<T>(path, options).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// Dành cho gửi FormData (upload tệp) — không tự set Content-Type để trình duyệt tự thêm boundary.
export async function requestForm<T>(path: string, token: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  }).catch(() => {
    throw new ApiError('Mất kết nối mạng — kiểm tra wifi rồi thử lại', 0);
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

export function authHeaders(token: string): HeadersInit {
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
  createdAt?: string;
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
  // Đợt 49 — "Tổng quan công ty" theo mẫu.
  address?: string | null;
  contactPerson?: string | null;
  companyType?: string | null;
  vision?: string | null;
  mission?: string | null;
  galleryUrls?: string[] | null;
  // Đợt 17 (25/09/2026) — "Nguồn ngoài / Tin tổng hợp": true nếu Admin tạo hộ từ nguồn ngoài;
  // claimedAt có giá trị nghĩa là công ty thật đã "nhận lại" — FE hiện badge "Tin tổng hợp — chưa xác
  // thực" khi isAdminSourced && !claimedAt (xem CompanyBadge trong components/CompanyLogo.tsx).
  isAdminSourced?: boolean;
  sourceLabel?: string;
  sourceUrl?: string;
  claimedAt?: string;
  // Đợt 17 — chỉ có ở AdminApi.listSourcedCompanies() (số tin của công ty này, mọi trạng thái).
  jobCount?: number;
}

export type JobApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'expired';

export interface JobRisk {
  score: number;
  level: 'low' | 'medium' | 'high';
  reasons: string[];
}

export interface JobPosting {
  // Đợt 42 — chỉ có ở danh sách 'Duyệt tin' của Admin.
  risk?: JobRisk;
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
  screeningQuestions?: { q: string; expect?: 'yes' | 'no' | 'any' }[] | null;
  channel?: string;
  laborGroup?: string | null;
  workPlace?: LaborWorkPlace | null;
  laborPerks?: string[] | null;
  payInfo?: LaborPayInfo | null;
  laborSchedule?: string[] | null;
  laborExtra?: JobExtra | null;
  filledAt?: string | null;
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
  // Đợt 79 — kênh tin (mặc định văn phòng) + nhóm việc phổ thông
  channel?: string;
  laborGroup?: string;
}

export function buildJobQuery(params: JobListParams): string {
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
  suggest: (q: string) => request<{ suggestion: string | null; synonyms: string[] }>(`/jobs/suggest?q=${encodeURIComponent(q)}`),
  get: (id: string) => request<{ job: JobPosting; related: JobPosting[] }>(`/jobs/${id}`),
  // Đợt 110 — tải ngầm để lưu offline: KHÔNG tính lượt xem.
  getQuiet: (id: string) => request<{ job: JobPosting; related: JobPosting[] }>(`/jobs/${id}?noview=1`),
  countView: (id: string) => request<void>(`/jobs/${id}/view`, { method: 'POST' }),
  // Đợt 38 — độ phù hợp việc ↔ hồ sơ (ứng viên đăng nhập).
  match: (token: string, ids: string[]) =>
    request<{ hasProfile: boolean; scores: Record<string, { score: number; reasons: string[]; gaps: string[] }> }>(`/jobs/match?ids=${ids.join(',')}`, { headers: authHeaders(token) }),
  recommended: (token: string, limit = 6) =>
    request<{ hasProfile: boolean; items: (JobPosting & { match: { score: number; reasons: string[]; gaps: string[] } })[] }>(`/jobs/recommended?limit=${limit}`, { headers: authHeaders(token) }),
  facets: (params: JobListParams = {}) => {
    const qs = buildJobQuery(params);
    return request<JobFacets>(`/jobs/facets${qs ? `?${qs}` : ''}`);
  },
  districtFacets: (province: string, params: JobListParams = {}) => {
    const qs = buildJobQuery({ ...params, provinces: undefined } as JobListParams);
    const sep = qs ? '&' : '';
    return request<DistrictFacet[]>(`/jobs/district-facets?province=${encodeURIComponent(province)}${sep}${qs}`);
  },
  // Đợt 89 — gợi ý chi tiết theo tỉnh: khu công nghiệp, ngành nổi bật, lương trung vị, quận/huyện.
  provinceInsights: (province: string, params: JobListParams = {}) => {
    const qs = buildJobQuery({ ...params, provinces: undefined, district: undefined } as JobListParams);
    return request<ProvinceInsights | null>(`/jobs/province-insights?province=${encodeURIComponent(province)}${qs ? '&' + qs : ''}`);
  },
  featuredEmployers: () => request<FeaturedEmployer[]>('/jobs/featured-employers'),
  // Đợt 12ab (24/09/2026) — "Đánh giá mức độ tương thích" (radar chart), chỉ ứng viên đã đăng nhập.
  getCompatibility: (token: string, id: string) =>
    request<CompatibilityResult>(`/jobs/${id}/compatibility`, { headers: authHeaders(token) }),
  // Đợt 13 (24/09/2026) — "Thống kê trang chủ" thật (thay 3/4 số ảo hard-code trước đó), công khai.
  homepageStats: () => request<HomepageStats>('/jobs/stats/homepage'),
  // Đợt 27 — số liệu thị trường thật (14 ngày, hình thức, mức lương) cho bảng ở trang chủ.
  marketStats: () => request<MarketStats>('/jobs/stats/market'),
  // Đợt 29 — từ khoá được tìm nhiều nhất (khối cột phải trang tìm việc).
  salaryStats: (industry?: string, province?: string, level?: string) => {
    const q = new URLSearchParams();
    if (level) q.set('level', level);
    if (industry) q.set('industry', industry);
    if (province) q.set('province', province);
    return request<SalaryStats>(`/jobs/stats/salary?${q.toString()}`);
  },
  popularKeywords: () => request<{ keywords: string[] }>('/jobs/stats/popular-keywords'),
};

export interface MarketStats {
  updatedAt: string;
  newJobsDaily: { day: string; n: number }[];
  applicationsDaily: { day: string; n: number }[];
  employmentTypes: { label: string; count: number }[];
  salaryBands: { label: string; count: number }[];
}

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

export interface SimilarCompany { id: string; name: string; logoUrl?: string | null; jobCount: number }

export const companiesApi = {
  similar: (id: string) => request<SimilarCompany[]>(`/companies/${id}/similar`),
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
  showActivityStatus?: boolean;
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
  alertEnabled?: boolean;
  lastAlertAt?: string | null;
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
  // Đợt 48 — NTD đã mở CV/hồ sơ.
  viewedAt?: string | null;
  // Đợt 46 — hẹn lịch phỏng vấn.
  interviewSlots?: string[] | null;
  interviewAt?: string | null;
  interviewPlace?: string | null;
  interviewNote?: string | null;
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
  setSavedSearchAlert: (token: string, id: string, alertEnabled: boolean) =>
    request<SavedSearch>(`/me/saved-searches/${id}`, { method: 'PATCH', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ alertEnabled }) }),
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
  // Đợt 22 (29/09/2026) — ứng tuyển KHÔNG cần đăng nhập (khách): họ tên/SĐT/email + file CV HOẶC link CV.
  applyAsGuest: async (jobId: string, form: FormData) => {
    const res = await fetch(`${API_URL}/public/jobs/${jobId}/apply`, { method: 'POST', body: form });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        (data && (Array.isArray(data.message) ? data.message.join(', ') : data.message)) ||
        (res.status === 429
          ? 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút'
          : 'Đã có lỗi xảy ra, vui lòng thử lại');
      throw new ApiError(message, res.status);
    }
    return data as { id: string; message: string };
  },
  // Đợt 21 (27/09/2026) — 2 cách chia sẻ hồ sơ khi ứng tuyển: cvId (CV file/link có sẵn) HOẶC
  // useOnlineProfile=true (dùng thẳng "Hồ sơ trực tuyến", không cần file) — chọn đúng 1 trong 2.
  apply: (
    token: string,
    jobId: string,
    dto: { cvId?: string; useOnlineProfile?: boolean; coverLetter?: string; screeningAnswers?: string[] },
  ) =>
    request<Application>(`/jobs/${jobId}/apply`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  listOwn: (token: string) => request<Application[]>('/me/applications', { headers: authHeaders(token) }),
  chooseInterview: (token: string, applicationId: string, slot: string) =>
    request<{ interviewAt: string }>(`/me/applications/${applicationId}/interview/choose`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ slot }),
    }),
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
  // Đợt 48 — NTD đã mở CV/hồ sơ.
  viewedAt?: string | null;
  // Đợt 46 — hẹn lịch phỏng vấn.
  interviewSlots?: string[] | null;
  interviewAt?: string | null;
  interviewPlace?: string | null;
  interviewNote?: string | null;
  cv: {
    id: string;
    // Đợt 21 (27/09/2026) — 'template' = ứng viên dùng thẳng "Hồ sơ trực tuyến" (cách 2, không có
    // file) — xem employerApi.getApplicantOnlineProfile().
    type: 'template' | 'upload';
    fileUrl?: string;
    originalFileName?: string;
    externalLinkUrl?: string;
    // Đợt 22 — null với đơn của KHÁCH ứng tuyển không đăng nhập (thông tin nằm ở guest*).
    candidateProfile: EmployerApplicantProfile | null;
    guestFullName?: string | null;
    guestPhone?: string | null;
    guestEmail?: string | null;
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
  screeningQuestions?: { q: string; expect?: 'yes' | 'no' | 'any' }[];
  channel?: string;
  laborGroup?: string | null;
  workPlace?: LaborWorkPlace | null;
  laborPerks?: string[] | null;
  payInfo?: LaborPayInfo | null;
  laborSchedule?: string[] | null;
  laborExtra?: JobExtra | null;
  filledAt?: string | null;
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
  // Đợt 49
  address?: string;
  contactPerson?: string;
  companyType?: string;
  vision?: string;
  mission?: string;
  galleryUrls?: string[];
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
  // Đợt 119 — đề xuất tin do Admin tìm thấy trên Internet cho công ty này.
  listJobSuggestions: (token: string) =>
    request<{ id: string; sourceUrl: string; data: JobImportData; createdAt: string }[]>('/employer/job-suggestions', { headers: authHeaders(token) }),
  acceptJobSuggestion: (token: string, id: string) =>
    request<JobPosting>(`/employer/job-suggestions/${id}/accept`, { method: 'POST', headers: authHeaders(token) }),
  dismissJobSuggestion: (token: string, id: string) =>
    request<{ ok: boolean }>(`/employer/job-suggestions/${id}/dismiss`, { method: 'POST', headers: authHeaders(token) }),
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
  markApplicationViewed: (token: string, applicationId: string) =>
    request<{ viewedAt: string }>(`/employer/applications/${applicationId}/viewed`, { method: 'POST', headers: authHeaders(token) }),
  proposeInterview: (token: string, applicationId: string, dto: { slots: string[]; place?: string; note?: string }) =>
    request<EmployerApplication>(`/employer/applications/${applicationId}/interview`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(dto),
    }),
  setApplicationFolder: (token: string, applicationId: string, folder?: string) =>
    request<EmployerApplication>(`/employer/applications/${applicationId}/folder`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ folder }),
    }),
  // Đợt 21 (27/09/2026) — xem "Hồ sơ trực tuyến" của ứng viên ứng tuyển bằng cách 2 (không có file).
  getApplicantOnlineProfile: (token: string, applicationId: string) =>
    request<CandidateDetail>(`/employer/applications/${applicationId}/online-profile`, {
      headers: authHeaders(token),
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

export interface PromoBadgeSetting {
  enabled: boolean;
  text: string;
  url: string | null;
}

// Đợt 23 — cấu hình công khai (không cần đăng nhập) cho header.
/** Đường dẫn tuyệt đối tới tài nguyên do API phục vụ (VD ảnh nền). */
export const apiAsset = (path: string) => `${API_URL}${path}`;

export const publicSettingsApi = {
  // Đợt 93 — ưu tiên dữ liệu gộp /public/boot (1 lần gọi cho cả nền + nhãn logo + banner); thiếu thì gọi đường cũ.
  getPromoBadge: async () => {
    const b = await loadBoot();
    if (b && b.badge !== undefined) return { badge: b.badge };
    return request<{ badge: { text: string; url: string } | null }>('/public/settings/promo-badge');
  },
  // Đợt 29 — cấu hình nền giao diện toàn website.
  background: async () => {
    const b = await loadBoot();
    if (b?.background) return b.background;
    return request<BgSetting>('/public/settings/background');
  },
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
  // Đợt 73 — hoạt động ứng viên: mới truy cập / mới cập nhật hồ sơ / sắp xếp.
  seenWithin?: '1d' | '3d' | '7d' | '30d';
  updatedWithin?: '3d' | '7d' | '30d';
  sort?: 'relevance' | 'seen' | 'updated';
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
  // Đợt 73 — nhãn hoạt động (dạng thô). seenLabel chỉ có khi ứng viên cho phép hiển thị hoạt động.
  seenLabel?: string | null;
  updatedLabel?: string | null;
  recentlySeen?: boolean;
  recentlyUpdated?: boolean;
  activeSeeker?: boolean;
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

// Đợt 21 (27/09/2026) — file CV ứng viên tải lên/dán link, tách khỏi nội dung nhập liệu "Hồ sơ trực
// tuyến" (2 cách chia sẻ hồ sơ: điền mẫu trực tuyến, hoặc chỉ điền thông tin cơ bản + đính kèm file).
export interface CandidateDetailCv {
  id: string;
  originalFileName?: string;
  fileUrl?: string;
  externalLinkUrl?: string;
  isPrimary: boolean;
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
  cvs: CandidateDetailCv[];
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
  if (params.seenWithin) qs.set('seenWithin', params.seenWithin);
  if (params.updatedWithin) qs.set('updatedWithin', params.updatedWithin);
  if (params.sort && params.sort !== 'relevance') qs.set('sort', params.sort);
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
  suggest: (token: string, jobId: string) =>
    request<{ items: (CandidateSearchItem & { match: { score: number; reasons: string[]; gaps: string[] } })[] }>(
      `/employer/candidates/suggest/${jobId}`,
      { headers: authHeaders(token) },
    ),
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
  // Đợt 94 — 1 lần gọi thay 2 (ping + đếm); máy chủ trả luôn `next` = số mili-giây chờ tới lần báo kế tiếp (thưa dần khi đông/quá tải).
  // API bản cũ chưa có /presence/beat (404) → quay về ping + đếm như trước.
  beat: async (sessionId: string): Promise<{ displayed: number; next: number }> => {
    try {
      return await request<{ displayed: number; next: number }>('/presence/beat', { method: 'POST', body: JSON.stringify({ sessionId }) });
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 404) throw e;
      await request<{ success: boolean }>('/presence/ping', { method: 'POST', body: JSON.stringify({ sessionId }) }).catch(() => undefined);
      const c = await request<{ displayed: number }>('/presence/count');
      return { displayed: c.displayed, next: 45_000 };
    }
  },
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
  link?: string | null;
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

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const str = q.toString();
  return str ? `?${str}` : '';
}


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
    address?: string | null;
    contactPerson?: string | null;
    companyType?: string | null;
    vision?: string | null;
    mission?: string | null;
    galleryUrls?: string[];
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


// ============================================================================================
// Đợt 20 (27/09/2026) — Admin "Lưu trữ file": lưu file lên Google Drive của chủ web.
// ============================================================================================
export interface StorageStatus {
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
  connectedAt: string | null;
  lastError: string | null;
  migrationPaused: boolean;
  redirectUri: string | null;
  databaseBytes: number;
  quota: { limit: number | null; usage: number; usageInDrive: number; email: string | null } | null;
  categories: { category: string; label: string; dbCount: number; dbBytes: number; driveCount: number; driveBytes: number }[];
}


// ------------------------------------------------------------------ Đợt 24 — banner quảng cáo (Admin)
export interface AdCampaignInput {
  name: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  ctaText: string | null;
  url: string;
  addUtm: boolean;
  bgMode: 'generated' | 'image';
  bgPrompt: string;
  bgTheme: string | null;
  bgSeed: number;
  textColor: 'auto' | 'light' | 'dark';
  slots: string[];
  audiences: string[];
  device: 'all' | 'desktop' | 'mobile';
  weight: number;
  startsAt: string | null;
  endsAt: string | null;
  enabled: boolean;
}

export interface AdCampaignRow extends AdCampaignInput {
  id: string;
  status: 'running' | 'scheduled' | 'ended' | 'paused';
  hasImage: boolean;
  bgImageUrl: string | null;
  bgImageTone: 'light' | 'dark' | null;
  impressions?: number;
  clicks?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdStats {
  days: number;
  since: string;
  bySlot: { campaignId: string; slot: string; impressions: number; clicks: number }[];
  daily: { day: string; impressions: number; clicks: number }[];
}


export interface SalaryStats {
  count: number;
  p25: number | null;
  median: number | null;
  p75: number | null;
  avg: number | null;
  overall: { count: number; median: number | null; avg: number | null };
  industries: string[];
  provinces: string[];
}

// Đợt 63 — 11 tính năng thông minh (xem api/src/smart).
export interface JobInsights {
  hasProfile: boolean;
  score?: number;
  matchedSkills?: string[];
  missingSkills?: string[];
  tips?: string[];
  chance?: { percent: number; level: 'high' | 'medium' | 'low'; applicants: number; reasons: string[] };
  salary?: { n: number; p25: number; median: number; p75: number; scope: string; offer: number | null; expected: number | null; advice: string } | null;
  career?: { current: string | null; next: string; industry: string; skillsToLearn: string[]; nextMedianSalary: number | null; openings: number; searchQuery: string } | null;
}
export interface JobHealthItem {
  jobId: string;
  title: string;
  views: number;
  applications: number;
  severity: 'warn' | 'info';
  problem: string;
  advice: string;
  fix: string;
}
export interface QualityOverview {
  scanned: number;
  duplicates: { title: string; company: string; jobs: { id: string; createdAt: string; source: string }[] }[];
  suspicious: { id: string; title: string; company: string; score: number; reasons: string[] }[];
  lowQuality: { id: string; title: string; company: string; score: number; missing: string[] }[];
}
export const smartApi = {
  jobInsights: (token: string, jobId: string) => request<JobInsights>(`/jobs/${jobId}/insights`, { headers: authHeaders(token) }),
  applicantScores: (token: string, jobId: string) =>
    request<{ scores: Record<string, ApplicantScoreInfo> }>(`/employer/applicant-scores?jobId=${jobId}`, { headers: authHeaders(token) }),
  jobHealth: (token: string) => request<{ items: JobHealthItem[] }>('/employer/job-health', { headers: authHeaders(token) }),
  qualityOverview: (token: string) => request<QualityOverview>('/admin/quality/overview', { headers: authHeaders(token) }),
};

// Đợt 64
export interface CompanyResponseStats {
  enough: boolean;
  total: number;
  responseRate?: number;
  interviewRate?: number;
  medianHours?: number | null;
  medianLabel?: string | null;
  level?: 'good' | 'fair' | 'poor';
}
export interface JobForecast {
  enough: boolean;
  scope?: string;
  sample?: number;
  medianApplications21d?: number;
  shareReaching10?: number;
  daysTo10?: number | null;
  salary?: { p25: number; median: number; p75: number; scope: string } | null;
  advice?: string[];
  bestTime?: { hours: number[]; days: string[]; sample: number; scope: string } | null;
  competitors?: { title: string; company: string; salaryMin: number | null; salaryMax: number | null; benefitCount: number; deadline: string | null }[];
}
export interface SystemHealth {
  metrics: { pendingJobs: number; pendingCompanies: number; users24h: number; jobs24h: number; apps24h: number; rejected7d: number };
  alerts: { level: 'warn' | 'info'; text: string }[];
  spam: { burst: { who: string; count: number }[]; sameLetter: { who: string; count: number; sample: string }[] };
}
export const smartApi2 = {
  responseStats: (companyId: string) => request<CompanyResponseStats>(`/companies/${companyId}/response-stats`),
  forecast: (token: string, p: { industry?: string; level?: string; province?: string; salaryMin?: number; salaryMax?: number }) => {
    const qs = new URLSearchParams();
    if (p.province) qs.set('province', p.province);
    if (p.industry) qs.set('industry', p.industry);
    if (p.level) qs.set('level', p.level);
    if (p.salaryMin) qs.set('salaryMin', String(p.salaryMin));
    if (p.salaryMax) qs.set('salaryMax', String(p.salaryMax));
    return request<JobForecast>(`/employer/job-forecast?${qs.toString()}`, { headers: authHeaders(token) });
  },
  systemHealth: (token: string) => request<SystemHealth>('/admin/quality/system', { headers: authHeaders(token) }),
  autofill: (token: string, parsed: unknown) =>
    request<{ filled: string[] }>('/me/profile/autofill', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(parsed) }),
  updateStatusWithMessage: (token: string, applicationId: string, status: string, message?: string) =>
    request<unknown>(`/employer/applications/${applicationId}/status`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ status, message }),
    }),
};

// Đợt 65
export interface ApplicantScoreInfo {
  score: number;
  reasons: string[];
  gaps: string[];
  parts?: { key: string; label: string; score: number; weight: number }[];
  bonus?: number;
  hot?: string;
}
export interface WeeklyReport {
  metrics: { key: string; label: string; cur: number; prev: number; changePct: number }[];
  notes: string[];
}
export interface AdTargeting {
  items: { area: string; slot: string; total: number; candidate: number; employer: number; guest: number; audience: string; suggestion: string }[];
  since: number;
}
export interface ReportGroup {
  jobId: string;
  title: string;
  company: string;
  count: number;
  categories: string[];
  priority: 'high' | 'normal';
  lastAt: string;
  notes: string[];
}
export interface AppEta {
  enough: boolean;
  sample?: number;
  interviewRate?: number;
  medianDays?: number | null;
  pending?: number;
  expectedInterviews?: number;
  applicationsForOne?: number | null;
}
export interface SharedProfile {
  fullName: string;
  title: string | null;
  province: string | null;
  yearsOfExperience: number | null;
  desiredLevel: string | null;
  skills: string[];
  experiences: { position: string; company: string | null; from: string | null; to: string | null }[];
  educations: { school: string | null; major: string | null; degree: string | null }[];
}
export const smartApi3 = {
  certificates: (token: string, jobId: string) => request<{ items: { name: string; jobs: number; percent: number }[]; total: number; industry?: string | null }>(`/jobs/${jobId}/certificates`, { headers: authHeaders(token) }),
  eta: (token: string) => request<AppEta>('/me/applications-eta', { headers: authHeaders(token) }),
  share: (token: string) => request<{ token: string; days: number }>('/me/profile-share', { method: 'POST', headers: authHeaders(token) }),
  shared: (t: string) => request<SharedProfile>(`/public/profile-share/${encodeURIComponent(t)}`),
  reinvite: (token: string, jobId: string) =>
    request<{ items: { profileId: string; name: string; title: string | null; score: number; reasons: string[]; oldJob: string; oldStatus: string }[] }>(`/employer/reinvite?jobId=${jobId}`, { headers: authHeaders(token) }),
  invite: (token: string, profileId: string, jobPostingId: string) =>
    request<unknown>(`/cv-search/${profileId}/invite`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ jobPostingId }) }),
  report: (token: string, jobId: string, reason: string, note?: string) =>
    request<{ ok: boolean }>(`/jobs/${jobId}/report`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ reason, note }) }),
  reports: (token: string) => request<{ items: ReportGroup[] }>('/admin/quality/reports', { headers: authHeaders(token) }),
  resolveReports: (token: string, jobId: string) => request<{ ok: boolean }>(`/admin/quality/reports/${jobId}/resolve`, { method: 'POST', headers: authHeaders(token) }),
  weekly: (token: string) => request<WeeklyReport>('/admin/quality/weekly', { headers: authHeaders(token) }),
  adTargeting: (token: string) => request<AdTargeting>('/admin/quality/ad-targeting', { headers: authHeaders(token) }),
};

// Đợt 75 — tính năng thông minh mới (ứng viên / nhà tuyển dụng / admin).
export interface CvTailor { hasProfile: boolean; score?: number; keywords?: string[]; matched?: string[]; inText?: string[]; missing?: string[]; tips?: string[] }
export interface SalaryPosition { hasProfile: boolean; expected?: number | null; scope?: string; sample?: number; p25?: number; median?: number; p75?: number; percent?: number; advice?: string }
export interface JobGoalData { hasProfile: boolean; thisWeek?: number; weeks?: number[]; streak?: number }
export const smartApi4 = {
  cvTailor: (token: string, jobId: string) => request<CvTailor>(`/jobs/${jobId}/cv-tailor`, { headers: authHeaders(token) }),
  applyCheck: (token: string, jobId: string) => request<{ similar: { jobId: string; title: string; appliedAt: string; status: string }[] }>(`/jobs/${jobId}/apply-check`, { headers: authHeaders(token) }),
  freshness: (token: string) => request<{ hasProfile: boolean; days?: number; stale?: boolean }>('/me/profile-freshness', { headers: authHeaders(token) }),
  salaryPosition: (token: string) => request<SalaryPosition>('/me/salary-position', { headers: authHeaders(token) }),
  jobGoal: (token: string) => request<JobGoalData>('/me/job-goal', { headers: authHeaders(token) }),
};

export interface PendingApps { days: number; total: number; items: { id: string; name: string; jobId: string; jobTitle: string; waitDays: number }[] }
export interface JobPerf { id: string; title: string; views: number; applications: number; rate: number; daysLeft: number | null; advice: string; level: 'good' | 'warn' | 'bad' }
export interface TitleTestData { test: null | { id: string; status: string; winner: string | null; a: { title: string; views: number; clicks: number; ctr: number }; b: { title: string; views: number; clicks: number; ctr: number }; enough: boolean; leader: 'a' | 'b' | null } }
export interface VerifyCheck { score: number; level: 'high' | 'medium' | 'low'; checks: { key: string; ok: boolean | null; label: string }[]; duplicates: { id: string; name: string; why: string }[] }
const jsonPost = (token: string, body: unknown) => ({ method: 'POST', headers: authHeaders(token), body: JSON.stringify(body) });
export const smartApi5 = {
  pending: (token: string, days = 3) => request<PendingApps>(`/employer/pending-applications?days=${days}`, { headers: authHeaders(token) }),
  performance: (token: string) => request<{ items: JobPerf[] }>('/employer/job-performance', { headers: authHeaders(token) }),
  extend: (token: string, jobId: string, days: number) => request<{ deadline: string }>(`/employer/jobs/${jobId}/extend`, jsonPost(token, { days })),
  titleTest: (token: string, jobId: string) => request<TitleTestData>(`/employer/jobs/${jobId}/title-test`, { headers: authHeaders(token) }),
  startTitleTest: (token: string, jobId: string, titleB: string) => request<TitleTestData>(`/employer/jobs/${jobId}/title-test`, jsonPost(token, { titleB })),
  finishTitleTest: (token: string, jobId: string, apply: boolean) => request<TitleTestData>(`/employer/jobs/${jobId}/title-test/finish`, jsonPost(token, { apply })),
  bulkInvite: (token: string, jobId: string, profileIds: string[]) => request<{ sent: number; skipped: number }>(`/employer/jobs/${jobId}/bulk-invite`, jsonPost(token, { profileIds })),
  verifyCheck: (token: string, companyId: string) => request<VerifyCheck>(`/admin/companies/${companyId}/verify-check`, { headers: authHeaders(token) }),
  publicTests: (ids: string[]) => request<{ items: { testId: string; jobId: string; a: string; b: string }[] }>(`/public/title-tests?ids=${ids.join(',')}`),
  testEvent: (testId: string, variant: 'a' | 'b', type: 'view' | 'click') =>
    request<{ ok: boolean }>('/public/title-tests/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ testId, variant, type }) }),
};

// Đợt 78
export interface SkillPremium { hasProfile: boolean; industry?: string | null; baseMedian?: number; items?: { tag: string; jobs: number; median: number; uplift: number }[] }
export interface WeeklyDigest { hasProfile: boolean; scope?: string; newJobs?: number; prevJobs?: number; change?: number | null; medianSalary?: number | null; salaryChange?: number | null; latest?: { id: string; title: string; company: string }[] }
export interface ProfileBenchmark { hasProfile: boolean; enough?: boolean; scope?: string; sample?: number; rows?: { key: string; label: string; peers: number; mine: boolean }[]; skills?: { peers: number; mine: number }; experiences?: { peers: number; mine: number }; gaps?: string[] }
export interface ApplicantFlags { flags: Record<string, string[]>; screening: Record<string, number>; hasScreening: boolean }
export interface SuspiciousAccount { companyId: string; name: string; score: number; reasons: string[] }
export const smartApi6 = {
  skillPremium: (token: string) => request<SkillPremium>('/me/skill-premium', { headers: authHeaders(token) }),
  weeklyDigest: (token: string) => request<WeeklyDigest>('/me/weekly-digest', { headers: authHeaders(token) }),
  benchmark: (token: string) => request<ProfileBenchmark>('/me/profile-benchmark', { headers: authHeaders(token) }),
  applicantFlags: (token: string, jobId: string) => request<ApplicantFlags>(`/employer/applicant-flags?jobId=${jobId}`, { headers: authHeaders(token) }),
  suspicious: (token: string) => request<{ items: SuspiciousAccount[] }>('/admin/quality/suspicious-accounts', { headers: authHeaders(token) }),
};

// Đợt 79 — lao động phổ thông (công nhân / sinh viên / thực tập sinh)
export type WorkerKind = 'worker' | 'student' | 'intern';
// Đợt 84 — trường mở rộng riêng từng nhóm (khớp apps/api/src/workers/labor-extra.ts)
export interface ProfileExtra { ready?: string; experience?: string; hasBike?: boolean; hasHealth?: boolean; certs?: string[]; hours?: 'lt15' | '15-25' | 'gt25'; year?: number; months?: number; sessions?: number; startDate?: string; mandatory?: 'school' | 'free' }
export interface JobExtra { months?: number; allowance?: number; sessions?: number; year?: number; majors?: string; hourlyPay?: number; hours?: number; ageMin?: number; ageMax?: number; docs?: string; health?: boolean; bike?: boolean; certs?: string[]; experience?: string }
export interface FitResult { ok: string[]; missing: string[]; hint: string[]; percent: number | null; minorUnsafe?: string | null }
export interface WorkerProfileView {
  id: string; kind: WorkerKind; fullName: string; phone: string; relativePhone: string | null; gender: string; birthDate: string; birthYear?: number | null; isSourced?: boolean;
  province: string; addressMode: 'old' | 'new'; oldDistrict: string | null; oldWard: string | null; newWardCode: string | null; newWard: string | null;
  addressDetail: string | null; lat: number | null; lon: number | null; radiusKm: number | null; desiredJobs: string[]; shifts: string[];
  availability: string[]; school: string | null; major: string | null; needsHousing: boolean; needsShuttle: boolean; isSeeking: boolean; refreshedAt: string; createdAt: string;
  examUntil?: string | null; examMode?: string | null; extra?: ProfileExtra | null; warnings?: string[];
}
export interface WorkerInput {
  kind: WorkerKind; fullName: string; phone: string; relativePhone?: string; gender: string; birthDate: string; province: string;
  addressMode: 'old' | 'new'; oldDistrict?: string; oldWard?: string; newWardCode?: string; addressDetail?: string; lat?: number | null; lon?: number | null;
  radiusKm?: number | null; desiredJobs: string[]; shifts: string[]; availability?: string[]; school?: string; major?: string; needsHousing: boolean; needsShuttle: boolean;
  isSeeking: boolean; consent?: boolean; verifyBirthDate?: string; extra?: ProfileExtra | null;
}
export interface LaborWorkPlace { province: string; mode: 'old' | 'new'; oldDistrict?: string | null; oldWard?: string | null; newWardCode?: string | null; newWard?: string | null; lat?: number | null; lon?: number | null }
export interface LaborPayInfo { base: number; otHours?: number; nightHours?: number; allowance?: number }
export interface LaborIncome { base: number; ot: number; night: number; allowance: number; gross: number; insurance: number; net: number; otHours: number; nightHours: number }
export interface Proximity { km: number; label: string; exact: boolean }
export interface WorkerJobCard {
  id: string; title: string; laborGroup: string | null; channel: string; provinces: string[]; salaryMin: number | null; salaryMax: number | null;
  isUrgent: boolean; deadline: string | null; createdAt: string; company: { id: string; name: string; logoUrl: string | null } | null; matched?: boolean;
  workPlaceText?: string | null; perks?: string[]; income?: LaborIncome | null; schedule?: string[]; shiftTags?: string[]; headcount?: number; hired?: number; filled?: boolean;
  distance?: Proximity | null; scheduleFit?: boolean | null; warnings?: string[]; ageDays?: number; closed?: boolean; trust?: TrustInfo | null;
  laborExtra?: JobExtra | null; hourly?: { hourly: number; belowMin: boolean; min: number; region: number; monthEstimate: number | null } | null; minorUnsafe?: string | null; minorBlocked?: boolean; fit?: FitResult | null;
}
export interface TrustInfo { score: number | null; label: string; callRate: number | null; avgHours: number | null; reports: number; applications: number }
export interface ApplyResult { ok: boolean; already: boolean; missing?: string[]; groupCode?: string | null; groupSize?: number; joinedGroup?: boolean }
export interface WorkerNoteView { id: string; kind: string; text: string; createdAt: string; mine: boolean }
export interface WorkerSearchItem extends WorkerProfileView {
  /** Đợt 136 — hồ sơ nguồn tổng hợp: số bị che tới khi bấm "Xem số"; "mine" = hồ sơ công ty tự nhập */
  phoneMasked?: boolean; mine?: boolean; sourceLabel?: string | null;
  age: number; distance: Proximity | null; outOfRadius: boolean; notes: WorkerNoteView[]; refreshedAfterHired: boolean; stale: boolean;
  myStatus: { status: string; jobId: string | null; updatedAt: string } | null; competition: number;
  match?: { score: number; reasons: string[] } | null; minor?: boolean; readyNow?: boolean;
}
export interface DropoutRow { group: string; hired: number; noShow: number; rate: number; extraPct: number }
export interface MyApplication { id: string; jobId: string; title: string; company: string | null; createdAt: string; status: string; seen: boolean; filled: boolean; groupCode: string | null; interviewAt?: string | null; interviewPlace?: string | null; startedAt?: string | null; certRequestedAt?: string | null; workPlace?: string | null; laborGroup?: string | null; channel?: string | null }
export interface ProvinceBalance { province: string; seekers: number; slots: number; jobs: number; label: string; gap: number }
export interface EmployerLaborJob { id: string; title: string; headcount: number; hired: number; filled: boolean; channel: string; ageDays?: number; deadline?: string | null; needExtend?: boolean; forecast?: { days: number; samples: number; scope: string } | null }
export interface DupJobGroup { key: string; reason: string; jobs: { id: string; title: string; company: string | null; province: string | null; createdAt: string; status: string }[] }
export interface AdminTodo { openReports: number; suspicious: number; duplicates: number; pendingTotal: number; riskyPending: { id: string; title: string; score: number; reasons: string[] }[]; imbalance: ProvinceBalance[] }
export interface SupplyRow { district: string; total: number; worker: number; student: number; intern: number; housing: number; shuttle: number }
export interface SuspiciousWorkerGroup { key: string; reason: string; score: number; profiles: { id: string; fullName: string; phone: string; kind: WorkerKind; province: string; createdAt: string; isHidden: boolean }[] }
export interface WorkerAppRow { certRequestedAt?: string | null; birthDate?: string; extra?: ProfileExtra | null; interviewAt?: string | null; interviewPlace?: string | null; startedAt?: string | null; id: string; createdAt: string; seenAt: string | null; status: string; groupCode: string | null; groupSize: number; jobId: string; jobTitle: string; profileId: string; fullName: string; phone: string; province: string; newWard: string | null; oldDistrict: string | null; kind: WorkerKind; desiredJobs: string | null }
const qsOf = (params: Record<string, string | undefined>) => new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '') as [string, string][]).toString();
const post = (body: unknown, token?: string): RequestInit => ({ method: 'POST', body: JSON.stringify(body), headers: token ? authHeaders(token) : undefined });
type WorkersCatalog = { groups: Record<WorkerKind, string[]>; shifts: string[]; radii: number[]; provinces: string[] };
let wcatMem: { at: number; v: WorkersCatalog } | null = null;
let wcatInflight: Promise<WorkersCatalog> | null = null;
function workersCatalog(): Promise<WorkersCatalog> {
  const DAY = 24 * 3600_000;
  if (wcatMem && Date.now() - wcatMem.at < DAY) return Promise.resolve(wcatMem.v);
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('tvl_wcat') : null;
    if (raw) {
      const o = JSON.parse(raw) as { at: number; v: WorkersCatalog };
      if (o && Date.now() - o.at < DAY && Array.isArray(o.v?.provinces)) {
        wcatMem = o;
        return Promise.resolve(o.v);
      }
    }
  } catch {
    /* bỏ qua */
  }
  if (!wcatInflight) {
    wcatInflight = request<WorkersCatalog>('/public/workers/catalog')
      .then((v) => {
        wcatMem = { at: Date.now(), v };
        try {
          localStorage.setItem('tvl_wcat', JSON.stringify(wcatMem));
        } catch {
          /* bỏ qua */
        }
        return v;
      })
      .finally(() => {
        wcatInflight = null;
      });
  }
  return wcatInflight;
}

// Đợt 136 — thu thập hồ sơ lao động (dán bài / dán bảng / kho của NTD)
export interface ParsedWorker {
  fullName: string | null; phone: string | null; birthYear: number | null; birthDate: string | null; gender: 'male' | 'female' | 'other' | null;
  province: string | null; oldDistrict: string | null; kind: WorkerKind; desiredJobs: string[]; shifts: string[]; experience: 'none' | 'lt1' | 'gte1' | null;
  needsHousing: boolean; needsShuttle: boolean; note: string | null; missing: string[];
}
export type SourcedRowStatus = 'ok' | 'missing' | 'duplicate' | 'repeat';
export interface SourcedPreviewRow extends ParsedWorker { row: number; raw: string; status: SourcedRowStatus; existing: { id: string; isSourced: boolean; fullName: string } | null }
export interface SourcedTablePreview { rows: SourcedPreviewRow[]; headerDetected: boolean; columns: Record<string, number>; summary: { total: number; ok: number; missing: number; duplicate: number; repeat: number } }
export interface SourcedPostPreview { parsed: ParsedWorker; existing: { id: string; isSourced: boolean; fullName: string } | null }
export interface SourcedSaveResult { created: number; skipped: { phone: string | null; name: string | null; reason: string }[] }
export interface SourcingApi {
  previewPost: (text: string) => Promise<SourcedPostPreview>;
  previewTable: (text: string) => Promise<SourcedTablePreview>;
  save: (rows: ParsedWorker[], label?: string) => Promise<SourcedSaveResult>;
}
export interface ShareQueueRow { id: string; fullName: string; phone: string; kind: WorkerKind; province: string; oldDistrict: string | null; desiredJobs: string[]; createdAt: string; sharedAt: string | null; shareStatus: string; company: string | null; companyId: string | null; dup: number }
export interface PhoneViewRow { id: string; viewedAt: string; company: string | null; companyId: string | null; profileId: string | null; fullName: string | null; phone: string | null; sourceLabel: string | null; userEmail: string | null }
export interface StockRow { id: string; fullName: string; phone: string; kind: WorkerKind; province: string; oldDistrict: string | null; desiredJobs: string[]; shifts: string[]; birthYear: number | null; shareStatus: string; createdAt: string; isSeeking: boolean }
export interface AdminWorkerRow {
  isSourced?: boolean; sourceLabel?: string | null; shareStatus?: string | null; ownerCompany?: string | null;
  id: string; kind: WorkerKind; fullName: string; phone: string; gender: string; age: number; province: string; place: string;
  desiredJobs: string[]; shifts: string[]; isSeeking: boolean; isHidden: boolean; hasAccount: boolean; refreshedAt: string; createdAt: string;
  tags: string[]; note: string | null; applications: number; calls: number;
}
export interface AdminWorkerDetail {
  profile: WorkerProfileView & { isSourced?: boolean; sourceLabel?: string | null; shareStatus?: string | null; isHidden: boolean; hasAccount: boolean; tags: string[]; note: string | null };
  applications: { id: string; status: string; createdAt: string; jobId: string; title: string; company: string | null }[];
  calls: { status: string; updatedAt: string; company: string | null; jobTitle: string | null }[];
  notes: { kind: string; text: string; createdAt: string }[];
}
export const workersApi = {
  // Đợt 93 — danh mục (nhóm nghề, ca, bán kính, tỉnh) gần như không đổi (API cũng lưu đệm 24 giờ): nhớ trong RAM + ở máy người xem
  // 24 giờ và gộp các lần gọi trùng → mở các trang lao động phổ thông lần 2 trở đi không gọi API; lần đầu vẫn lấy như cũ.
  catalog: () => workersCatalog(),
  districts: (province: string) => request<{ items: string[] }>(`/public/workers/geo/districts?province=${encodeURIComponent(province)}`),
  wards: (province: string, district: string) => request<{ items: string[] }>(`/public/workers/geo/wards?province=${encodeURIComponent(province)}&district=${encodeURIComponent(district)}`),
  newWards: (province: string) => request<{ items: { code: string; name: string }[] }>(`/public/workers/geo/new-wards?province=${encodeURIComponent(province)}`),
  check: (phone: string) => request<{ valid: boolean; exists: boolean; sourced?: boolean; refreshedAt: string | null }>('/public/workers/check', post({ phone })),
  verify: (phone: string, birthDate: string) => request<WorkerProfileView>('/public/workers/verify', post({ phone, birthDate })),
  refresh: (phone: string, birthDate: string) => request<WorkerProfileView>('/public/workers/refresh', post({ phone, birthDate })),
  save: (b: WorkerInput) => request<{ updated: boolean; profile: WorkerProfileView }>('/public/workers/profile', post(b)),
  jobs: (params: Record<string, string | undefined>) => request<WorkerJobCard[]>(`/public/workers/jobs?${qsOf(params)}`),
  browse: (params: Record<string, string | undefined>) => request<{ items: WorkerJobCard[]; total: number; page: number; totalPages: number }>(`/public/workers/browse?${qsOf(params)}`),
  salaryStats: (kind: string, group?: string, province?: string) =>
    request<{ scope: string | null; count: number; p25: number | null; median: number | null; p75: number | null }>(`/public/workers/salary-stats?${qsOf({ kind, group, province })}`),
  progress: (jobId: string) => request<{ headcount: number; hired: number; filled: boolean; income: LaborIncome | null }>(`/public/workers/jobs/${jobId}/progress`),
  groupInfo: (jobId: string, code: string) => request<{ valid: boolean; size: number; leader: string | null }>(`/public/workers/jobs/${jobId}/group/${encodeURIComponent(code)}`),
  quickApply: (jobId: string, phone: string, birthDate: string, group?: string) => request<ApplyResult>(`/public/workers/jobs/${jobId}/apply`, post({ phone, birthDate, group })),
  cards: (ids: string[]) => request<{ items: WorkerJobCard[] }>(`/public/workers/jobs-by-ids?ids=${ids.join(',')}`),
  myApplications: (phone: string, birthDate: string) => request<{ isSeeking: boolean; examMode?: string | null; examUntil?: string | null; kind?: WorkerKind; items: MyApplication[] }>('/public/workers/applications', post({ phone, birthDate })),
  setSeeking: (phone: string, birthDate: string, seeking: boolean) => request<{ ok: boolean; isSeeking: boolean }>('/public/workers/seeking', post({ phone, birthDate, seeking })),
  reportJob: (jobId: string, reason: string, note?: string) => request<{ ok: boolean }>(`/public/workers/jobs/${jobId}/report`, post({ reason, note })),
  minWage: (province: string) => request<{ region: number; month: number; hour: number; known: boolean }>(`/public/workers/min-wage?province=${encodeURIComponent(province)}`),
  similar: (jobId: string) => request<{ items: WorkerJobCard[] }>(`/public/workers/jobs/${jobId}/similar`),
  setExam: (phone: string, birthDate: string, mode: string, until?: string) => request<{ ok: boolean; examMode: string | null; examUntil: string | null }>('/public/workers/exam', post({ phone, birthDate, mode, until })),
  setExamMine: (token: string, mode: string, until?: string) => request<{ ok: boolean; examMode: string | null; examUntil: string | null }>('/me/worker-profile/exam', { method: 'PATCH', body: JSON.stringify({ mode, until }), headers: authHeaders(token) }),
  setInterview: (token: string, ids: string[], at: string, place?: string) => request<{ ok: boolean; updated: number }>('/employer/worker-applications/interview', { method: 'PATCH', body: JSON.stringify({ ids, at, place }), headers: authHeaders(token) }),
  attendance: (token: string, id: string, attended: boolean) => request<{ ok: boolean; status: string }>(`/employer/worker-applications/${id}/attendance`, { method: 'PATCH', body: JSON.stringify({ attended }), headers: authHeaders(token) }),
  fit: (jobId: string, phone: string, birthDate: string) => request<FitResult>(`/public/workers/jobs/${jobId}/fit`, post({ phone, birthDate })),
  fitMine: (token: string, jobId: string) => request<FitResult>(`/me/worker-fit/${jobId}`, { headers: authHeaders(token) }),
  requestCert: (phone: string, birthDate: string, appId: string) => request<{ ok: boolean; certRequestedAt: string }>(`/public/workers/applications/${appId}/cert`, post({ phone, birthDate })),
  requestCertMine: (token: string, appId: string) => request<{ ok: boolean; certRequestedAt: string }>(`/me/worker-applications/${appId}/cert`, post({}, token)),
  adminDuplicateJobs: (token: string) => request<{ items: DupJobGroup[] }>('/admin/workers/duplicate-jobs', { headers: authHeaders(token) }),
  adminTodo: (token: string) => request<AdminTodo>('/admin/workers/todo', { headers: authHeaders(token) }),
  // ứng viên có tài khoản
  myApplicationsMine: (token: string) => request<{ isSeeking: boolean; examMode?: string | null; examUntil?: string | null; kind?: WorkerKind; items: MyApplication[] }>('/me/worker-applications', { headers: authHeaders(token) }),
  setSeekingMine: (token: string, seeking: boolean) => request<{ ok: boolean; isSeeking: boolean }>('/me/worker-profile/seeking', { method: 'PATCH', body: JSON.stringify({ seeking }), headers: authHeaders(token) }),
  mine: (token: string) => request<WorkerProfileView | null>('/me/worker-profile', { headers: authHeaders(token) }),
  saveMine: (token: string, b: WorkerInput) => request<{ updated: boolean; profile: WorkerProfileView }>('/me/worker-profile', post(b, token)),
  refreshMine: (token: string) => request<WorkerProfileView>('/me/worker-profile/refresh', post({}, token)),
  applyMine: (token: string, jobId: string, group?: string) => request<ApplyResult>(`/me/worker-apply/${jobId}`, post({ group }, token)),
  // nhà tuyển dụng
  search: (token: string, params: Record<string, string | undefined>) => {
    return request<{ items: WorkerSearchItem[]; total: number; page: number; totalPages: number; origin: { province: string } | null }>(`/employer/workers?${qsOf(params)}`, { headers: authHeaders(token) });
  },
  origin: (token: string) => request<{ province: string | null; address: string | null }>('/employer/workers/origin', { headers: authHeaders(token) }),
  addNote: (token: string, id: string, kind: 'hired' | 'note', text?: string) => request<WorkerNoteView>(`/employer/workers/${id}/notes`, post({ kind, text }, token)),
  delNote: (token: string, noteId: string) => request<{ ok: boolean }>(`/employer/workers/notes/${noteId}`, { method: 'DELETE', headers: authHeaders(token) }),
  applications: (token: string) =>
    request<{ items: WorkerAppRow[]; jobs: EmployerLaborJob[]; trust?: TrustInfo | null }>('/employer/worker-applications', { headers: authHeaders(token) }),
  setContact: (token: string, id: string, status: string, jobId?: string | null) =>
    request<{ status: string | null; jobId?: string | null; updatedAt?: string }>(`/employer/workers/${id}/contact`, { method: 'PUT', body: JSON.stringify({ status, jobId }), headers: authHeaders(token) }),
  appStatus: (token: string, id: string, status: string) => request<{ ok: boolean }>(`/employer/worker-applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }), headers: authHeaders(token) }),
  extendJob: (token: string, jobId: string) => request<{ ok: boolean; deadline: string }>(`/employer/jobs/${jobId}/extend`, { method: 'PATCH', headers: authHeaders(token) }),
  setFilled: (token: string, jobId: string, filled: boolean) => request<{ ok: boolean }>(`/employer/jobs/${jobId}/filled`, { method: 'PATCH', body: JSON.stringify({ filled }), headers: authHeaders(token) }),
  supply: (token: string, params: Record<string, string | undefined>) =>
    request<{ origin: { province: string } | null; totalInProvince?: number; districts: SupplyRow[]; provinces: { province: string; total: number; km: number }[]; hours?: number[]; bestHours?: { h: number; n: number }[]; dropout?: DropoutRow[] }>(`/employer/workers/supply?${qsOf(params)}`, { headers: authHeaders(token) }),
  adminStats: (token: string) => request<{ items: { kind: WorkerKind; n: number; fresh: number; hidden: number }[]; apps: number; contacts: number; provinces?: ProvinceBalance[] }>('/admin/workers/stats', { headers: authHeaders(token) }),
  adminSuspicious: (token: string) => request<{ items: SuspiciousWorkerGroup[] }>('/admin/workers/suspicious', { headers: authHeaders(token) }),
  // Đợt 135 — Admin quản lý hồ sơ lao động phổ thông
  adminList: (token: string, params: Record<string, string | undefined>) => request<{ items: AdminWorkerRow[]; total: number; page: number; totalPages: number; counts: Record<string, number>; sourceCounts?: Record<string, number> }>(`/admin/workers/list?${qsOf(params)}`, { headers: authHeaders(token) }),
  adminTags: (token: string) => request<{ tag: string; count: number }[]>('/admin/workers/tags', { headers: authHeaders(token) }),
  adminDetail: (token: string, id: string) => request<AdminWorkerDetail>(`/admin/workers/${id}/detail`, { headers: authHeaders(token) }),
  adminMeta: (token: string, id: string, b: { tags?: string[]; note?: string | null }) => request<{ ok: boolean; tags: string[]; note: string | null }>(`/admin/workers/${id}/meta`, { method: 'PATCH', body: JSON.stringify(b), headers: authHeaders(token) }),
  adminSuggest: (token: string, id: string) => request<{ id: string; title: string; company: string; distance: string | null; salaryMin: number | null; salaryMax: number | null; matched: boolean; applied: boolean }[]>(`/admin/workers/${id}/suggested-jobs`, { headers: authHeaders(token) }),
  adminInvite: (token: string, id: string, jobId: string) => request<{ ok: boolean; via: 'notification' | 'phone'; phone?: string; message?: string }>(`/admin/workers/${id}/invite`, { method: 'POST', body: JSON.stringify({ jobId }), headers: authHeaders(token) }),
  adminHide: (token: string, id: string, hidden: boolean) => request<{ ok: boolean }>(`/admin/workers/${id}/hide`, { method: 'PATCH', body: JSON.stringify({ hidden }), headers: authHeaders(token) }),
  // Đợt 136 — thu thập hồ sơ
  adminSourcing: (token: string): SourcingApi => ({
    previewPost: (text) => request<SourcedPostPreview>('/admin/workers/sourced/preview-post', post({ text }, token)),
    previewTable: (text) => request<SourcedTablePreview>('/admin/workers/sourced/preview-table', post({ text }, token)),
    save: (rows, label) => request<SourcedSaveResult>('/admin/workers/sourced/save', post({ rows, label }, token)),
  }),
  employerSourcing: (token: string): SourcingApi => ({
    previewPost: (text) => request<SourcedPostPreview>('/employer/worker-stock/preview-post', post({ text }, token)),
    previewTable: (text) => request<SourcedTablePreview>('/employer/worker-stock/preview-table', post({ text }, token)),
    save: (rows) => request<SourcedSaveResult>('/employer/worker-stock/save', post({ rows }, token)),
  }),
  adminDeleteSourced: (token: string, id: string) => request<{ ok: boolean }>(`/admin/workers/sourced/${id}`, { method: 'DELETE', headers: authHeaders(token) }),
  adminQueue: (token: string, params: Record<string, string | undefined>) =>
    request<{ items: ShareQueueRow[]; total: number; counts: { pending: number; shared: number; dismissed: number }; page: number; totalPages: number; auto: { enabled: boolean; enabledAt: string | null; minutes: number } }>(`/admin/workers/share-queue?${qsOf(params)}`, { headers: authHeaders(token) }),
  adminQueueAct: (token: string, ids: string[], action: 'share' | 'dismiss' | 'requeue') => request<{ changed: number }>('/admin/workers/share-queue/act', post({ ids, action }, token)),
  adminQueueAuto: (token: string, enabled: boolean) => request<{ enabled: boolean; enabledAt: string | null; minutes: number }>('/admin/workers/share-queue/auto', { method: 'PUT', body: JSON.stringify({ enabled }), headers: authHeaders(token) }),
  adminPhoneViews: (token: string, params: Record<string, string | undefined>) =>
    request<{ items: PhoneViewRow[]; total: number; page: number; totalPages: number; last24h: { company: string | null; companyId: string | null; n: number }[]; limit: number }>(`/admin/workers/phone-views?${qsOf(params)}`, { headers: authHeaders(token) }),
  myStock: (token: string, params: Record<string, string | undefined>) => request<{ items: StockRow[]; total: number; page: number; totalPages: number }>(`/employer/worker-stock?${qsOf(params)}`, { headers: authHeaders(token) }),
  deleteStock: (token: string, id: string) => request<{ ok: boolean }>(`/employer/worker-stock/${id}`, { method: 'DELETE', headers: authHeaders(token) }),
  revealPhone: (token: string, id: string) => request<{ phone: string; used: number | null; limit: number; logged: boolean }>(`/employer/workers/${id}/reveal-phone`, post({}, token)),
  phoneQuota: (token: string) => request<{ used: number; limit: number }>('/employer/workers/phone-quota', { headers: authHeaders(token) }),
  sourcedRequest: (phone: string, birth: string, type: 'remove' | 'claim') =>
    request<{ done?: 'removed' | 'claimed'; needsAdmin?: boolean; message: string }>('/public/workers/sourced/request', post({ phone, birth, type })),
  seen: (token: string, id: string) => request<{ ok: boolean }>(`/employer/worker-applications/${id}/seen`, { method: 'PATCH', headers: authHeaders(token) }),
};

// Đợt 87 — điểm đáng ứng tuyển, phễu, ngân sách, báo cáo của tôi, sức khoẻ web
export interface WorthScore { score: number; label: string; level: 'good' | 'fair' | 'poor'; parts: { key: string; label: string; score: number; weight: number; note: string }[] }
export interface FunnelJob { id: string; title: string; steps: { key: string; label: string; n: number }[]; worst: { from: string; to: string; lostPct: number; advice: string } | null }
export interface BudgetItem { id: string; name: string; type: string; quantity: number; remaining: number; daysLeft: number | null; warns: string[]; estApplications: number | null }
export interface MyReport { id: string; jobId: string; title: string; reason: string; createdAt: string; stage: string; done: boolean }
export interface WebHealthItem { key: string; label: string; n: number; hint: string; level: 'ok' | 'warn' }
export const smartApi7 = {
  worth: (jobId: string) => request<WorthScore>(`/public/jobs/${jobId}/worth`),
  funnel: (token: string) => request<{ items: FunnelJob[] }>('/employer/funnel', { headers: authHeaders(token) }),
  budget: (token: string) => request<{ items: BudgetItem[]; avgApplicationsPerJob: number | null }>('/employer/budget', { headers: authHeaders(token) }),
  myReports: (token: string) => request<{ items: MyReport[] }>('/me/reports', { headers: authHeaders(token) }),
  health: (token: string) => request<{ items: WebHealthItem[]; warnCount: number }>('/admin/quality/health', { headers: authHeaders(token) }),
};

export interface ProvinceInsights {
  province: string;
  total: number;
  medianSalary: number | null;
  industries: { industry: string; count: number }[];
  zones: { name: string; count: number; q: string }[];
  districts: DistrictFacet[];
}

// Đợt 119 — mục trong "Hộp nhập tin từ link" (Admin) và đề xuất tin cho nhà tuyển dụng.
export interface JobImportData {
  title?: string;
  deletedWarning?: string;
  companyName?: string;
  companyWebsite?: string;
  companyLogo?: string;
  industry?: string;
  description?: string;
  location?: string;
  employmentType?: string;
  salaryMin?: number;
  salaryMax?: number;
  deadline?: string;
  requirements?: string;
  benefits?: string;
  experienceLevel?: string;
  level?: string;
  headcount?: number;
  gender?: string;
  ageRange?: string;
  workSchedule?: string;
  address?: string;
  tags?: string[];
  isUrgent?: boolean;
  enriched?: boolean;
  channel?: string;
  laborGroup?: string;
  laborPerks?: string[];
}
export interface JobImportRow {
  id: string;
  sourceUrl: string;
  status: 'pending' | 'published' | 'owner_review' | 'owner_notified' | 'accepted' | 'skipped' | 'failed';
  data: JobImportData;
  matchedCompanyId?: string | null;
  matchKind?: string | null;
  jobId?: string | null;
  companyHasOwner: boolean;
  matchedCompany?: { id?: string; name?: string; isAdminSourced?: boolean } | null;
  note?: string | null;
  createdAt: string;
}

// Đợt 120 — trạng thái "Tự đọc email thông báo việc làm".
export interface MailScanStatus {
  configured: boolean;
  cronKeySet: boolean;
  autoPublishMinutes?: number;
  accounts: { idx: number; user: string; labels: string[] }[];
  senders: string[];
  enabled: boolean;
  running: boolean;
  lastAt: string | null;
  last: { at: string; mails: number; links: number; added: number; duplicates: number; skipped: number; error?: string } | null;
}

// Đợt 147 — Nguồn theo dõi (công ty / ngành nghề / từ khoá của trang tuyển dụng).
export interface JobSourceRow {
  id: string; kind: 'company' | 'category' | 'keyword' | 'list'; site: string; label: string; url: string; originalUrl?: string | null;
  enabled: boolean; autoPublish: boolean; maxPages: number; cursorPage: number; manualPage?: number; cyclesDone: number; siteTotal?: number | null;
  totalFound: number; totalAdded: number; lastAdded: number; lastScanAt?: string | null; discoveredAt?: string | null; lastError?: string | null;
  createdAt: string; queued?: number;
}
export interface JobSourceList { running: boolean; runningId: string | null; cronKeySet: boolean; items: JobSourceRow[] }
export interface JobSourcePreview {
  site: string; siteName: string; kind: JobSourceRow['kind']; listingUrl: string; label: string; found: number; total: number | null;
  lastPage: number | null; sample: string[]; trusted: boolean; warning?: string;
}

// Đợt 150 — Hộp thư (admin)
export interface MailStatus { address: string | null; imapReady: boolean; smtpReady: boolean; fresh: number; total: number; syncing: boolean }
export interface MailMsgRow { id: string; fromName?: string | null; fromEmail: string; subject: string; preview: string; status: 'new' | 'replied' | 'closed'; receivedAt: string; repliedAt?: string | null }
export interface MailMsgFull { id: string; fromName?: string | null; fromEmail: string; subject: string; body: string; status: string; receivedAt: string; replies: { id: string; subject: string; body: string; at: string }[] }
export interface MailTemplate { id: string; kind: 'reply' | 'system' | 'promo'; name: string; subject: string; body: string; updatedAt: string }
export interface MailContact { id: string; email: string; name?: string | null; company?: string | null; source: string; status: 'active' | 'unsubscribed'; createdAt: string }
export interface MailCampaign { id: string; name: string; subject: string; body: string; sourceFilter?: string | null; status: 'draft' | 'approved' | 'sent'; sentCount: number; remaining: number; createdAt: string; lastSentAt?: string | null }
