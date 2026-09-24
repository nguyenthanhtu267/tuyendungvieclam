import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../database/entities/company.entity';
import { JobPosting, JobApprovalStatus } from '../database/entities/job-posting.entity';

// Đợt 12k (21/09/2026) — trang công ty công khai /cong-ty/[id]: bấm tên công ty trong tin tuyển
// dụng sẽ tới đây, xem thông tin công ty + toàn bộ tin đang tuyển khác của công ty đó (giống
// careerviet.vn). Chỉ trả tin đã APPROVED + chưa tạm ngưng, giống hệt điều kiện baseQuery() ở
// JobsService — không rò rỉ tin đang chờ duyệt/bị từ chối ra ngoài công khai.
@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(JobPosting)
    private readonly jobRepo: Repository<JobPosting>,
  ) {}

  async getProfile(id: string) {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');

    // Đợt 12y (24/09/2026) — FIX lỗi "Application error" khi bấm "Xem tất cả tin đang tuyển của
    // công ty này": thiếu `relations: { company: true }` nên mỗi tin trong `jobs` không có field
    // `company` lồng bên trong → JobCard.tsx (dùng chung với trang /viec-lam) gọi
    // `companyInitials(job.company.name)` bị crash vì `job.company` là undefined. Lỗi có sẵn từ
    // Đợt 12k (lúc tạo trang này), chưa từng được kiểm thử bấm thật tới bước cuối.
    const jobs = await this.jobRepo.find({
      where: { companyId: id, approvalStatus: JobApprovalStatus.APPROVED, isPaused: false },
      relations: { company: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    return {
      company: {
        id: company.id,
        name: company.name,
        taxCode: company.taxCode,
        size: company.size,
        industry: company.industry,
        website: company.website,
        isFeaturedEmployer: company.isFeaturedEmployer,
      },
      jobs,
      totalJobs: jobs.length,
    };
  }
}
