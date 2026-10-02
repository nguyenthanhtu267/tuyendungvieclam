import type { JobListParams } from './api';

// Đợt 90 — đọc bộ lọc tìm việc từ địa chỉ trang (dùng CHUNG cho máy chủ dựng sẵn và trình duyệt → hai bên luôn khớp).
function arr(v: string | null): string[] | undefined {
  if (!v) return undefined;
  const parts = v.split(',').filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

export function parseJobFilters(get: (k: string) => string | null): JobListParams {
  return {
    q: get('q') ?? undefined,
    location: get('location') ?? undefined,
    provinces: arr(get('provinces')),
    district: get('district') ?? undefined,
    industries: arr(get('industries')),
    salaryTier: get('salaryTier') ? Number(get('salaryTier')) : undefined,
    level: get('level') ?? undefined,
    postedWithin: get('postedWithin') ?? undefined,
    employmentType: get('employmentType') ?? undefined,
    experienceLevel: get('experienceLevel') ?? undefined,
    urgentOnly: get('urgentOnly') === '1' || undefined,
    featuredEmployerOnly: get('featuredEmployerOnly') === '1' || undefined,
    // Đợt 137 — mặc định tìm chung mọi kênh; ?channel=office|worker|student|intern để chọn riêng
    channel: ['office', 'worker', 'student', 'intern'].includes(get('channel') ?? '') ? (get('channel') as string) : 'all',
  };
}
export const JOB_PAGE_SIZE = 8;
