import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../database/entities/company.entity';
import { JobPosting, JobApprovalStatus } from '../database/entities/job-posting.entity';
import { CompanyFollow } from '../database/entities/company-follow.entity';
import { resolveCompanyLogoUrl } from '../common/company-logo.util';

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
    @InjectRepository(CompanyFollow)
    private readonly followRepo: Repository<CompanyFollow>,
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

    // Đợt 12ab (24/09/2026) — "Theo dõi công ty": số lượt theo dõi hiện công khai trên trang công
    // ty, đồng bộ với nút "+ Theo dõi" (viec-lam/[id]/page.tsx) và cong-ty/[id]/page.tsx.
    const followersCount = await this.followRepo.count({ where: { companyId: id } });

    // Đợt 16 (25/09/2026) — mục 22a danh sách lỗi: favicon tự động theo website khi chưa có logoUrl
    // thủ công — áp dụng cho cả logo công ty ở đầu trang lẫn từng tin trong `jobs` (mỗi tin có
    // `company` lồng riêng, JobCard đọc trực tiếp `job.company.logoUrl`).
    for (const job of jobs) {
      if (job.company) job.company.logoUrl = resolveCompanyLogoUrl(job.company);
    }

    return {
      company: {
        id: company.id,
        name: company.name,
        taxCode: company.taxCode,
        size: company.size,
        industry: company.industry,
        website: company.website,
        logoUrl: resolveCompanyLogoUrl(company),
        isFeaturedEmployer: company.isFeaturedEmployer,
        followersCount,
        // Đợt 12ac (24/09/2026) — "Giới thiệu công ty" cho tab Tổng quan công ty.
        description: company.description,
      },
      jobs,
      totalJobs: jobs.length,
    };
  }
}
