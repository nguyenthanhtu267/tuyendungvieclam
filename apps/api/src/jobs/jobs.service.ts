import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository, SelectQueryBuilder } from 'typeorm';
import { JobPosting, JobApprovalStatus } from '../database/entities/job-posting.entity';
import { Company, CompanyApprovalStatus } from '../database/entities/company.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CandidateSkill } from '../database/entities/candidate-sections.entity';
import { Application } from '../database/entities/application.entity';
import { ListJobsDto, POSTED_WITHIN_DAYS } from './dto/list-jobs.dto';
import { resolveCompanyLogoUrl } from '../common/company-logo.util';

// Đợt 12ab (24/09/2026) — "Đánh giá mức độ tương thích" (radar chart, theo mẫu careerviet.vn): thứ
// tự PHẢI khớp EXPERIENCE_LEVELS ở apps/web/src/lib/catalogs.ts (backend không import được catalogs
// FE nên khai lại ở đây — nếu đổi 1 bên nhớ đổi bên kia).
const EXPERIENCE_LEVEL_YEARS: { label: string; min: number; max: number }[] = [
  { label: 'Không yêu cầu kinh nghiệm', min: 0, max: Infinity },
  { label: 'Chưa có kinh nghiệm', min: 0, max: 0 },
  { label: 'Đến dưới 1 năm', min: 0, max: 1 },
  { label: 'Từ 1 đến 4 năm', min: 1, max: 4 },
  { label: 'Từ 5 đến 7 năm', min: 5, max: 7 },
  { label: 'Từ 7 đến 10 năm', min: 7, max: 10 },
  { label: 'Từ 11 năm', min: 11, max: Infinity },
];

// Phải khớp LEVELS ở catalogs.ts — chỉ số càng gần nhau thì cấp bậc càng tương thích.
const LEVEL_ORDER: string[] = [
  'Sinh viên / Thực tập sinh',
  'Mới tốt nghiệp',
  'Nhân viên',
  'Trưởng nhóm / Giám sát',
  'Quản lý',
  'Quản lý cấp cao',
  'Điều hành cấp cao',
];

function stripHtml(html?: string): string {
  return (html ?? '').replace(/<[^>]*>/g, ' ');
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(JobPosting)
    private readonly jobRepo: Repository<JobPosting>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(CandidateProfile)
    private readonly candidateProfileRepo: Repository<CandidateProfile>,
    @InjectRepository(CandidateSkill)
    private readonly candidateSkillRepo: Repository<CandidateSkill>,
    // Đợt 13 (24/09/2026) — "Thống kê trang chủ" (mục 7): cần đếm lượt ứng tuyển thật.
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
  ) {}

  // Dùng chung cho findAll() và facets() để 2 nơi luôn lọc giống hệt nhau (đợt 10, tránh lệch số
  // liệu giữa danh sách và bộ đếm facet như đã rút kinh nghiệm ở đợt 9 cv-search).
  private baseQuery(): SelectQueryBuilder<JobPosting> {
    return this.jobRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.company', 'company')
      .where('job.approvalStatus = :status', { status: JobApprovalStatus.APPROVED })
      // Đợt 11b — NTD tự tạm ngưng tin (mục #4 ATS) thì không hiện trong tìm kiếm công khai nữa,
      // dù vẫn ở approvalStatus = APPROVED (Admin không cần duyệt lại khi đăng lại).
      .andWhere('job.isPaused = false');
  }

  private applyFilters(qb: SelectQueryBuilder<JobPosting>, query: ListJobsDto) {
    if (query.q) {
      qb.andWhere('(job.title ILIKE :q OR company.name ILIKE :q)', { q: `%${query.q}%` });
    }
    // provinces (đợt 10) khớp bất kỳ; location (đợt 7, tương thích ngược) khớp chuỗi con.
    if (query.provinces?.length) {
      qb.andWhere(
        `(${query.provinces.map((_, i) => `job.provinces ILIKE :prov${i}`).join(' OR ')})`,
        Object.fromEntries(query.provinces.map((v, i) => [`prov${i}`, `%${v}%`])),
      );
    } else if (query.location) {
      qb.andWhere('(job.location ILIKE :location OR job.provinces ILIKE :location)', {
        location: `%${query.location}%`,
      });
    }
    if (query.district) {
      qb.andWhere('job.district = :district', { district: query.district });
    }
    if (query.industries?.length) {
      qb.andWhere('job.industry IN (:...industries)', { industries: query.industries });
    } else if (query.industry) {
      qb.andWhere('job.industry ILIKE :industry', { industry: `%${query.industry}%` });
    }
    if (query.salaryTier != null) {
      qb.andWhere('(job.salaryMax >= :tier OR job.salaryMin >= :tier)', { tier: query.salaryTier });
    }
    if (query.level) qb.andWhere('job.level = :level', { level: query.level });
    if (query.employmentType) qb.andWhere('job.employmentType = :employmentType', { employmentType: query.employmentType });
    if (query.experienceLevel) qb.andWhere('job.experienceLevel = :experienceLevel', { experienceLevel: query.experienceLevel });
    if (query.urgentOnly) qb.andWhere('job.isUrgent = true');
    if (query.featuredEmployerOnly) qb.andWhere('company.isFeaturedEmployer = true');
    if (query.postedWithin) {
      const days = POSTED_WITHIN_DAYS[query.postedWithin];
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      qb.andWhere('job.createdAt >= :since', { since });
    }
    return qb;
  }

  // Đợt 16 (25/09/2026) — mục 22a danh sách lỗi: áp dụng favicon tự động (resolveCompanyLogoUrl) cho
  // mọi tin trả về có kèm `company` — công ty nào đã dán logoUrl thủ công thì giữ nguyên, chỉ công
  // ty CHƯA có logoUrl mới được gán favicon theo website làm ảnh tạm. Sửa thẳng trên entity đã fetch
  // (an toàn vì không ghi lại vào CSDL, chỉ ảnh hưởng dữ liệu trả về cho client).
  private applyLogoFallback(jobs: JobPosting[]) {
    for (const job of jobs) {
      if (job.company) job.company.logoUrl = resolveCompanyLogoUrl(job.company);
    }
    return jobs;
  }

  async findAll(query: ListJobsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const qb = this.applyFilters(this.baseQuery(), query);

    qb.orderBy('job.isUrgent', 'DESC')
      .addOrderBy('job.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    this.applyLogoFallback(items);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(id: string) {
    const job = await this.jobRepo.findOne({ where: { id }, relations: { company: true } });
    if (!job || job.approvalStatus !== JobApprovalStatus.APPROVED || job.isPaused) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }

    const related = await this.jobRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.company', 'company')
      .where('job.approvalStatus = :status', { status: JobApprovalStatus.APPROVED })
      .andWhere('job.isPaused = false')
      .andWhere('job.id != :id', { id })
      .andWhere('job.industry = :industry', { industry: job.industry ?? '' })
      .orderBy('job.createdAt', 'DESC')
      .take(3)
      .getMany();
    this.applyLogoFallback([job, ...related]);

    // Đợt 12p (21/09/2026) — mỗi lượt xem trang chi tiết công khai +1 view_count (dùng cho thống kê
    // "Lượt xem"/"Tỷ lệ chuyển đổi" của NTD). Không await trước khi trả kết quả để không làm chậm
    // phản hồi trang chi tiết — lỗi tăng đếm (nếu có) không nên chặn người dùng xem tin.
    this.jobRepo.increment({ id }, 'viewCount', 1).catch(() => {});
    job.viewCount = (job.viewCount ?? 0) + 1;

    return { job, related };
  }

  // query tùy chọn: khi có provinces/industries.. đang chọn, facet ngành/địa điểm tính trên phần dữ
  // liệu ĐÃ lọc theo các tiêu chí còn lại (không tính chính chiều đang hỏi) — cho cảm giác lọc mượt
  // giống careerviet.vn thay vì facet cố định trên toàn bộ dữ liệu.
  async facets(query: ListJobsDto = {}) {
    const industryQb = this.applyFilters(this.baseQuery(), { ...query, industries: undefined, industry: undefined });
    const industries = await industryQb
      .clone()
      .select('job.industry', 'industry')
      .addSelect('COUNT(*)', 'count')
      .andWhere('job.industry IS NOT NULL')
      .groupBy('job.industry')
      .orderBy('count', 'DESC')
      .getRawMany();

    // Đợt 12i (21/09/2026) — sửa lỗi thống kê "Địa điểm phổ biến": trước đây GROUP BY thẳng cột
    // `location` (chuỗi hiển thị, có thể là "Hà Nội | Hồ Chí Minh" khi 1 tin đăng ở nhiều tỉnh),
    // khiến tổ hợp nhiều tỉnh bị đếm gộp thành 1 mục riêng thay vì cộng vào từng tỉnh. Nay lấy cột
    // `provinces` (mỗi tin lưu danh sách tỉnh/thành riêng biệt) của các tin khớp bộ lọc, tách và
    // đếm từng tỉnh trong Node — 1 tin đăng ở N tỉnh sẽ cộng +1 cho cả N tỉnh đó, không tạo mục tổ
    // hợp. Tin cũ (đợt 7, chưa có `provinces`) vẫn dùng lại `location` để không mất số liệu.
    const locationQb = this.applyFilters(this.baseQuery(), { ...query, provinces: undefined, location: undefined });
    const locationRows: Array<{ provinces: string | null; location: string | null }> = await locationQb
      .clone()
      .select('job.provinces', 'provinces')
      .addSelect('job.location', 'location')
      .getRawMany();

    const locationCounts = new Map<string, number>();
    for (const row of locationRows) {
      const raw = row.provinces
        ? row.provinces.split(',')
        : row.location
          ? row.location.split('|')
          : [];
      const provinces = Array.from(new Set(raw.map((p) => p.trim()).filter(Boolean)));
      for (const p of provinces) {
        locationCounts.set(p, (locationCounts.get(p) ?? 0) + 1);
      }
    }
    const locations = Array.from(locationCounts.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count);

    const total = await this.applyFilters(this.baseQuery(), query).getCount();

    return {
      total,
      industries: industries.map((r) => ({ industry: r.industry, count: Number(r.count) })),
      locations,
    };
  }

  // Chip quận/huyện kèm số lượng (mục 3 đặc tả) — chỉ có ý nghĩa khi đã chọn 1 tỉnh/thành cụ thể.
  async districtFacets(province: string, query: ListJobsDto = {}) {
    if (!province) return [];
    const qb = this.applyFilters(this.baseQuery(), { ...query, provinces: [province], district: undefined });
    const rows = await qb
      .select('job.district', 'district')
      .addSelect('COUNT(*)', 'count')
      .andWhere('job.district IS NOT NULL')
      .groupBy('job.district')
      .orderBy('count', 'DESC')
      .getRawMany();
    return rows.map((r) => ({ district: r.district, count: Number(r.count) }));
  }

  async featuredEmployers() {
    const companies = await this.companyRepo.find({
      where: { isFeaturedEmployer: true },
      order: { name: 'ASC' },
      take: 12,
    });
    const withJobCount = await Promise.all(
      companies.map(async (c) => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        size: c.size,
        logoUrl: resolveCompanyLogoUrl(c),
        jobCount: await this.jobRepo.count({ where: { companyId: c.id, approvalStatus: JobApprovalStatus.APPROVED } }),
      })),
    );
    return withJobCount;
  }

  // ===== Đợt 12ab (24/09/2026) — "Đánh giá mức độ tương thích" (radar chart, theo mẫu careerviet.vn) =====
  // Chấm điểm 6 tiêu chí (0-100 mỗi tiêu chí) rồi cộng có trọng số ra % tổng. Chỉ dùng dữ liệu hồ sơ
  // ứng viên đã có sẵn (không cần thêm bảng/cột mới) — nếu thiếu dữ liệu ở tiêu chí nào thì chấm điểm
  // trung tính (không cộng cũng không trừ mạnh) thay vì 0, tránh hồ sơ chưa điền đầy đủ bị đánh giá
  // sai là "không phù hợp".
  async getCompatibility(userId: string, jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId }, relations: { company: true } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');

    const profile = await this.candidateProfileRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');

    const skills = await this.candidateSkillRepo.find({ where: { candidateProfileId: profile.id } });
    const skillNames = skills.map((s) => s.skillName.toLowerCase().trim()).filter(Boolean);

    // 1) Kỹ năng — bao nhiêu % kỹ năng của ứng viên xuất hiện trong tags/tiêu đề/yêu cầu công việc.
    const jobText = [
      ...(job.tags ?? []),
      job.title,
      stripHtml(job.requirements),
      stripHtml(job.description),
    ]
      .join(' ')
      .toLowerCase();
    const matchedSkills = skillNames.filter((s) => jobText.includes(s));
    const skillScore = skillNames.length ? clamp(Math.round((matchedSkills.length / skillNames.length) * 100)) : 40;

    // 2) Kinh nghiệm — số năm kinh nghiệm ứng viên so với khoảng yêu cầu của tin.
    let experienceScore = 60;
    const bucket = EXPERIENCE_LEVEL_YEARS.find((b) => b.label === job.experienceLevel);
    if (bucket && profile.yearsOfExperience != null) {
      const y = profile.yearsOfExperience;
      if (y >= bucket.min && y <= bucket.max) experienceScore = 100;
      else if (y < bucket.min) experienceScore = clamp(100 - (bucket.min - y) * 20);
      else experienceScore = clamp(100 - (y - bucket.max) * 5, 40);
    } else if (bucket && bucket.min === 0 && bucket.max === Infinity) {
      experienceScore = 100; // "Không yêu cầu kinh nghiệm" — luôn phù hợp dù hồ sơ chưa điền số năm.
    }

    // 3) Cấp bậc — khoảng cách giữa cấp bậc mong muốn của ứng viên và cấp bậc tin tuyển dụng.
    let levelScore = 50;
    const candidateLevelIdx = LEVEL_ORDER.indexOf(profile.desiredLevel ?? profile.currentLevel ?? '');
    const jobLevelIdx = LEVEL_ORDER.indexOf(job.level ?? '');
    if (candidateLevelIdx >= 0 && jobLevelIdx >= 0) {
      levelScore = clamp(100 - Math.abs(candidateLevelIdx - jobLevelIdx) * 25);
    }

    // 4) Mức lương — job trả thấp hơn mức mong muốn mới bị trừ điểm; trả bằng/cao hơn luôn tối đa.
    let salaryScore = 60;
    if (profile.desiredSalaryMin != null && job.salaryMax != null) {
      salaryScore = job.salaryMax >= profile.desiredSalaryMin ? 100 : clamp(100 - (profile.desiredSalaryMin - job.salaryMax) * 5);
    } else if (profile.desiredSalaryMin == null && job.salaryMax == null) {
      salaryScore = 60;
    } else {
      salaryScore = 70;
    }

    // 5) Địa điểm — tỉnh/thành ứng viên mong muốn (hoặc nơi ở) có khớp nơi làm việc của tin không.
    let locationScore = 60;
    const candidateLocations = [profile.province, ...(profile.desiredLocations ?? [])]
      .filter(Boolean)
      .map((v) => (v as string).toLowerCase());
    const jobLocations = [job.location, ...(job.provinces ?? [])].filter(Boolean).map((v) => (v as string).toLowerCase());
    if (candidateLocations.length && jobLocations.length) {
      const match = candidateLocations.some((cl) => jobLocations.some((jl) => jl.includes(cl) || cl.includes(jl)));
      locationScore = match ? 100 : 25;
    }

    // 6) Ngành nghề — ngành ứng viên mong muốn có khớp ngành của tin không.
    let industryScore = 60;
    if (profile.desiredIndustries?.length && job.industry) {
      const jobIndustry = job.industry.toLowerCase();
      const match = profile.desiredIndustries.some((i) => i.toLowerCase() === jobIndustry);
      industryScore = match ? 100 : 30;
    }

    const criteria = [
      { key: 'skills', label: 'Kỹ năng', score: skillScore, weight: 30 },
      { key: 'experience', label: 'Kinh nghiệm', score: experienceScore, weight: 20 },
      { key: 'level', label: 'Cấp bậc', score: levelScore, weight: 15 },
      { key: 'salary', label: 'Mức lương', score: salaryScore, weight: 15 },
      { key: 'location', label: 'Địa điểm', score: locationScore, weight: 10 },
      { key: 'industry', label: 'Ngành nghề', score: industryScore, weight: 10 },
    ];
    const overall = Math.round(criteria.reduce((sum, c) => sum + c.score * c.weight, 0) / 100);

    // Đợt 13 (24/09/2026) — "TIÊU CHÍ ĐÁNH GIÁ" dạng checklist chia nhóm (theo mẫu careerviet.vn,
    // người dùng nhớ đã yêu cầu ở Đợt 12ab nhưng lúc đó chỉ ra được biểu đồ radar). Người dùng chọn
    // GIỮ CẢ 2 dạng — `criteria` ở trên giữ NGUYÊN không đổi (radar vẫn dùng đúng mảng này), khối
    // dưới đây là dữ liệu BỔ SUNG dành riêng cho checklist, không ảnh hưởng cách tính `overall`.
    // Ngưỡng "khớp" (matched) dùng chung mốc score >= 70 cho các tiêu chí đã có sẵn score ở trên.
    const MATCH_THRESHOLD = 70;

    // "Chức danh" — so khớp chức danh tin với vị trí mong muốn/tiêu đề hồ sơ ứng viên (chưa có sẵn
    // trong 6 tiêu chí ở trên, thêm mới theo ảnh mẫu). Chỉ mang tính tham khảo — KHÔNG cộng vào
    // `overall` để không phá vỡ thang điểm đã có người dùng quen dùng.
    const candidateTitleText = [profile.desiredPosition, profile.profileTitle]
      .filter(Boolean)
      .map((v) => (v as string).toLowerCase())
      .join(' ');
    const jobTitleLower = job.title.toLowerCase();
    const titleMatched =
      !!candidateTitleText &&
      (jobTitleLower.includes(candidateTitleText) ||
        candidateTitleText.split(/\s+/).some((w) => w.length > 2 && jobTitleLower.includes(w)));

    // "Trình độ học vấn" — dữ liệu tin tuyển dụng hiện KHÔNG có trường yêu cầu bằng cấp riêng (chỉ
    // hồ sơ ứng viên có `highestDegree`), nên chỉ hiện mang tính thông tin, không có gì để so khớp
    // thật sự — theo đúng cách careerviet.vn cũng hiện mục này ở trạng thái "chưa xác nhận khớp"
    // ngay cả khi ứng viên đã điền trình độ.
    const hasDegree = !!profile.highestDegree;

    // "Kỹ năng bạn còn thiếu" — job.tags (Đợt 12v, NTD tự nhập) là danh sách kỹ năng/từ khoá có cấu
    // trúc DUY NHẤT hiện có ở phía tin tuyển dụng, dùng làm nguồn để tính phần bù còn thiếu.
    const missingSkills = (job.tags ?? []).filter((t) => !skillNames.includes(t.toLowerCase().trim()));

    const checklist = [
      {
        group: 'overview' as const,
        key: 'location',
        label: 'Địa điểm làm việc',
        detail: jobLocations.length ? jobLocations.join(', ') : 'Chưa rõ địa điểm',
        matched: locationScore >= MATCH_THRESHOLD,
      },
      {
        group: 'overview' as const,
        key: 'salary',
        label: 'Mức lương',
        detail: job.salaryMin || job.salaryMax ? `${job.salaryMin ?? '?'} – ${job.salaryMax ?? '?'} triệu` : 'Thoả thuận',
        matched: salaryScore >= MATCH_THRESHOLD,
      },
      {
        group: 'overview' as const,
        key: 'industry',
        label: 'Ngành nghề',
        detail: job.industry ?? 'Chưa rõ',
        matched: industryScore >= MATCH_THRESHOLD,
      },
      {
        group: 'overview' as const,
        key: 'level',
        label: 'Cấp bậc',
        detail: job.level ?? 'Chưa rõ',
        matched: levelScore >= MATCH_THRESHOLD,
      },
      {
        group: 'overview' as const,
        key: 'jobTitle',
        label: 'Chức danh',
        detail: job.title,
        matched: titleMatched,
      },
      {
        group: 'experience' as const,
        key: 'experienceYears',
        label: 'Số năm kinh nghiệm',
        detail: `${profile.yearsOfExperience ?? '—'} năm (yêu cầu: ${job.experienceLevel ?? 'Không yêu cầu'})`,
        matched: experienceScore >= MATCH_THRESHOLD,
      },
      {
        group: 'education' as const,
        key: 'degree',
        label: 'Trình độ học vấn',
        detail: profile.highestDegree ?? 'Chưa cập nhật',
        matched: hasDegree,
      },
      {
        group: 'skills' as const,
        key: 'skillsSummary',
        label: 'Kỹ năng',
        detail: skillNames.length ? `${matchedSkills.length}/${skillNames.length} kỹ năng khớp với tin` : 'Chưa cập nhật kỹ năng',
        matched: skillScore >= MATCH_THRESHOLD,
      },
    ];

    return { overall, criteria, checklist, missingSkills };
  }

  // Đợt 13 (24/09/2026) — "Thống kê trang chủ" (mục 7 danh sách lỗi): trước đó 3/4 số liệu ở khối 4
  // thẻ trang chủ là số cứng (hard-code), không đổi theo dữ liệu thật. Endpoint công khai (không cần
  // đăng nhập) này trả về số liệu thật để FE thay thế toàn bộ khối đó — theo lựa chọn của người dùng
  // ("hiện đúng số thật"), không đặt ngưỡng/làm tròn giả.
  async getHomepageStats() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      memberCount,
      companyCount,
      openJobCount,
      profilesUpdatedToday,
      applicationsToday,
    ] = await Promise.all([
      this.candidateProfileRepo.count(),
      this.companyRepo.count({ where: { approvalStatus: CompanyApprovalStatus.APPROVED } }),
      this.jobRepo.count({ where: { approvalStatus: JobApprovalStatus.APPROVED, isPaused: false } }),
      this.candidateProfileRepo.count({ where: { updatedAt: MoreThanOrEqual(since24h) } }),
      this.applicationRepo.count({ where: { appliedAt: MoreThanOrEqual(since24h) } }),
    ]);

    return {
      memberCount,
      companyCount,
      openJobCount,
      profilesUpdatedToday,
      applicationsToday,
    };
  }
}
