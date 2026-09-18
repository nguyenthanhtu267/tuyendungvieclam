import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobPosting, JobApprovalStatus } from '../database/entities/job-posting.entity';
import { ListJobsDto } from './dto/list-jobs.dto';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(JobPosting)
    private readonly jobRepo: Repository<JobPosting>,
  ) {}

  async findAll(query: ListJobsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const qb = this.jobRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.company', 'company')
      .where('job.approvalStatus = :status', { status: JobApprovalStatus.APPROVED });

    if (query.q) {
      qb.andWhere('(job.title ILIKE :q OR company.name ILIKE :q)', { q: `%${query.q}%` });
    }
    if (query.location) {
      qb.andWhere('job.location ILIKE :location', { location: `%${query.location}%` });
    }
    if (query.industry) {
      qb.andWhere('job.industry ILIKE :industry', { industry: `%${query.industry}%` });
    }

    qb.orderBy('job.createdAt', 'DESC')
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
    if (!job || job.approvalStatus !== JobApprovalStatus.APPROVED) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }

    const related = await this.jobRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.company', 'company')
      .where('job.approvalStatus = :status', { status: JobApprovalStatus.APPROVED })
      .andWhere('job.id != :id', { id })
      .andWhere('job.industry = :industry', { industry: job.industry ?? '' })
      .orderBy('job.createdAt', 'DESC')
      .take(3)
      .getMany();

    return { job, related };
  }

  async facets() {
    const industries = await this.jobRepo
      .createQueryBuilder('job')
      .select('job.industry', 'industry')
      .addSelect('COUNT(*)', 'count')
      .where('job.approvalStatus = :status', { status: JobApprovalStatus.APPROVED })
      .andWhere('job.industry IS NOT NULL')
      .groupBy('job.industry')
      .orderBy('count', 'DESC')
      .getRawMany();

    const locations = await this.jobRepo
      .createQueryBuilder('job')
      .select('job.location', 'location')
      .addSelect('COUNT(*)', 'count')
      .where('job.approvalStatus = :status', { status: JobApprovalStatus.APPROVED })
      .andWhere('job.location IS NOT NULL')
      .groupBy('job.location')
      .orderBy('count', 'DESC')
      .getRawMany();

    const total = await this.jobRepo.count({ where: { approvalStatus: JobApprovalStatus.APPROVED } });

    return {
      total,
      industries: industries.map((r) => ({ industry: r.industry, count: Number(r.count) })),
      locations: locations.map((r) => ({ location: r.location, count: Number(r.count) })),
    };
  }
}
