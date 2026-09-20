import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { JobPosting, JobApprovalStatus } from '../database/entities/job-posting.entity';
import { Company } from '../database/entities/company.entity';
import { ListJobsDto, POSTED_WITHIN_DAYS } from './dto/list-jobs.dto';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(JobPosting)
    private readonly jobRepo: Repository<JobPosting>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
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

  async findAll(query: ListJobsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const qb = this.applyFilters(this.baseQuery(), query);

    qb.orderBy('job.isUrgent', 'DESC')
      .addOrderBy('job.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();

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

    const locationQb = this.applyFilters(this.baseQuery(), { ...query, provinces: undefined, location: undefined });
    const locations = await locationQb
      .clone()
      .select('job.location', 'location')
      .addSelect('COUNT(*)', 'count')
      .andWhere('job.location IS NOT NULL')
      .groupBy('job.location')
      .orderBy('count', 'DESC')
      .getRawMany();

    const total = await this.applyFilters(this.baseQuery(), query).getCount();

    return {
      total,
      industries: industries.map((r) => ({ industry: r.industry, count: Number(r.count) })),
      locations: locations.map((r) => ({ location: r.location, count: Number(r.count) })),
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
        jobCount: await this.jobRepo.count({ where: { companyId: c.id, approvalStatus: JobApprovalStatus.APPROVED } }),
      })),
    );
    return withJobCount;
  }
}
