import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { Company } from '../database/entities/company.entity';
import { CompanyUser, CompanyUserType } from '../database/entities/company-user.entity';
import { JobPosting, JobApprovalStatus } from '../database/entities/job-posting.entity';
import { Application, ApplicationStatus } from '../database/entities/application.entity';
import { User, UserRole } from '../database/entities/user.entity';
import { ServicePackage } from '../database/entities/service-package.entity';
import { Order, OrderStatus } from '../database/entities/order.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateSubAccountDto } from './dto/create-sub-account.dto';
import { CreateOrderDto } from './dto/create-order.dto';

const LEGAL_DOC_MAX_BYTES = 3 * 1024 * 1024; // 3MB — theo Mục 9 SRS

@Injectable()
export class EmployerService {
  constructor(
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(CompanyUser) private readonly companyUserRepo: Repository<CompanyUser>,
    @InjectRepository(JobPosting) private readonly jobRepo: Repository<JobPosting>,
    @InjectRepository(Application) private readonly applicationRepo: Repository<Application>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ServicePackage) private readonly packageRepo: Repository<ServicePackage>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
  ) {}

  // Mọi endpoint của module này đều thao tác trên công ty gắn với tài khoản NTD đang đăng nhập —
  // tra qua bảng company_users (SRS Mục 10: 1 User employer_main/sub ↔ 1 Company).
  private async getCompanyIdForUser(userId: string): Promise<string> {
    const link = await this.companyUserRepo.findOne({ where: { userId } });
    if (!link) {
      throw new ForbiddenException('Tài khoản chưa liên kết với công ty nào');
    }
    return link.companyId;
  }

  async getMyCompany(userId: string) {
    const companyId = await this.getCompanyIdForUser(userId);
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');
    return company;
  }

  async getDashboard(userId: string) {
    const companyId = await this.getCompanyIdForUser(userId);

    const jobCount = await this.jobRepo.count({ where: { companyId } });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const applicationsQb = () =>
      this.applicationRepo
        .createQueryBuilder('app')
        .innerJoinAndSelect('app.jobPosting', 'job')
        .where('job.company_id = :companyId', { companyId });

    const totalApplications = await applicationsQb().getCount();
    const newApplicationsToday = await applicationsQb()
      .andWhere('app.applied_at >= :startOfToday', { startOfToday })
      .getCount();

    const recentJobs = await this.jobRepo.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
      take: 5,
    });
    const recentJobsWithCounts = await Promise.all(
      recentJobs.map(async (job) => ({
        ...job,
        applicationCount: await this.applicationRepo.count({ where: { jobPostingId: job.id } }),
      })),
    );

    const recentApplications = await applicationsQb()
      .leftJoinAndSelect('app.cv', 'cv')
      .leftJoinAndSelect('cv.candidateProfile', 'candidateProfile')
      .orderBy('app.applied_at', 'DESC')
      .take(5)
      .getMany();

    return {
      jobCount,
      totalApplications,
      newApplicationsToday,
      recentJobs: recentJobsWithCounts,
      recentApplications,
    };
  }

  async listMyJobs(userId: string) {
    const companyId = await this.getCompanyIdForUser(userId);
    const jobs = await this.jobRepo.find({ where: { companyId }, order: { createdAt: 'DESC' } });
    return Promise.all(
      jobs.map(async (job) => ({
        ...job,
        applicationCount: await this.applicationRepo.count({ where: { jobPostingId: job.id } }),
      })),
    );
  }

  // Quyết định 18/09/2026 (đợt 4, cập nhật đợt 5): nay đã có module Admin (C1) kiểm duyệt, nên
  // tin đăng mới trở lại trạng thái PENDING (chờ duyệt) đúng theo SRS gốc, thay cho quyết định
  // tạm thời tự động duyệt ở đợt 4. Tin sẽ hiển thị công khai trong tìm kiếm việc làm sau khi
  // Admin bấm Duyệt ở trang /admin/dashboard.
  async createJob(userId: string, dto: CreateJobDto) {
    const companyId = await this.getCompanyIdForUser(userId);
    const job = this.jobRepo.create({
      companyId,
      title: dto.title,
      industry: dto.industry,
      location: dto.location,
      salaryMin: dto.salaryMin,
      salaryMax: dto.salaryMax,
      employmentType: dto.employmentType,
      level: dto.level,
      headcount: dto.headcount ?? 1,
      description: dto.description,
      requirements: dto.requirements,
      benefits: dto.benefits,
      deadline: dto.deadline,
      approvalStatus: JobApprovalStatus.PENDING,
    });
    return this.jobRepo.save(job);
  }

  private async getOwnedJob(userId: string, jobId: string): Promise<JobPosting> {
    const companyId = await this.getCompanyIdForUser(userId);
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    if (job.companyId !== companyId) {
      throw new ForbiddenException('Bạn không có quyền truy cập tin tuyển dụng này');
    }
    return job;
  }

  async getJob(userId: string, jobId: string) {
    return this.getOwnedJob(userId, jobId);
  }

  async listApplicants(userId: string, jobId: string, status?: ApplicationStatus) {
    await this.getOwnedJob(userId, jobId);
    const qb = this.applicationRepo
      .createQueryBuilder('app')
      .leftJoinAndSelect('app.cv', 'cv')
      .leftJoinAndSelect('cv.candidateProfile', 'candidateProfile')
      .where('app.job_posting_id = :jobId', { jobId })
      .orderBy('app.applied_at', 'DESC');
    if (status) {
      qb.andWhere('app.status = :status', { status });
    }
    return qb.getMany();
  }

  async updateApplicationStatus(userId: string, applicationId: string, status: ApplicationStatus) {
    const companyId = await this.getCompanyIdForUser(userId);
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: { jobPosting: true, cv: { candidateProfile: true } },
    });
    if (!application) throw new NotFoundException('Không tìm thấy đơn ứng tuyển');
    if (application.jobPosting.companyId !== companyId) {
      throw new ForbiddenException('Bạn không có quyền truy cập đơn ứng tuyển này');
    }
    application.status = status;
    return this.applicationRepo.save(application);
  }

  // ===== B5 — Tài khoản & Hồ sơ công ty =====

  async updateCompany(userId: string, dto: UpdateCompanyDto) {
    const companyId = await this.getCompanyIdForUser(userId);
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');
    if (dto.size !== undefined) company.size = dto.size;
    if (dto.industry !== undefined) company.industry = dto.industry;
    if (dto.website !== undefined) company.website = dto.website;
    return this.companyRepo.save(company);
  }

  async addLegalDocFromUpload(userId: string, file: Express.Multer.File) {
    if (!file) throw new ConflictException('Vui lòng chọn tệp để tải lên');
    if (file.size > LEGAL_DOC_MAX_BYTES) {
      throw new ConflictException('Tệp vượt quá 3MB — vui lòng dán link Google Drive thay thế');
    }
    const companyId = await this.getCompanyIdForUser(userId);
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');
    company.legalDocUrl = `/uploads/legal/${file.filename}`;
    company.legalDocOriginalFileName = file.originalname;
    // Lưu ý TypeORM: gán `undefined` khiến save() BỎ QUA cột đó (không xoá giá trị cũ trong DB) —
    // phải gán `null` mới thực sự xoá link cũ khi chuyển từ "dán link" sang "tải tệp lên".
    company.legalDocExternalLink = null;
    return this.companyRepo.save(company);
  }

  async addLegalDocFromLink(userId: string, externalLinkUrl: string) {
    const companyId = await this.getCompanyIdForUser(userId);
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');
    company.legalDocExternalLink = externalLinkUrl;
    // Như trên: dùng `null` (không phải `undefined`) để thực sự xoá tệp đã tải lên trước đó.
    company.legalDocUrl = null;
    company.legalDocOriginalFileName = null;
    return this.companyRepo.save(company);
  }

  async listTeam(userId: string) {
    const companyId = await this.getCompanyIdForUser(userId);
    const links = await this.companyUserRepo.find({
      where: { companyId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    return links.map((link) => ({
      id: link.id,
      type: link.type,
      createdAt: link.createdAt,
      user: { id: link.user.id, email: link.user.email, fullName: link.user.fullName, status: link.user.status },
    }));
  }

  async addSubAccount(userId: string, dto: CreateSubAccountDto) {
    const companyId = await this.getCompanyIdForUser(userId);
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email này đã được đăng ký');

    const passwordHash = await argon2.hash(dto.password);
    const subUser = await this.userRepo.save(
      this.userRepo.create({
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        role: UserRole.EMPLOYER_SUB,
      }),
    );
    const link = await this.companyUserRepo.save(
      this.companyUserRepo.create({ companyId, userId: subUser.id, type: CompanyUserType.SUB }),
    );
    return {
      id: link.id,
      type: link.type,
      createdAt: link.createdAt,
      user: { id: subUser.id, email: subUser.email, fullName: subUser.fullName, status: subUser.status },
    };
  }

  async removeSubAccount(userId: string, companyUserId: string) {
    const companyId = await this.getCompanyIdForUser(userId);
    const link = await this.companyUserRepo.findOne({ where: { id: companyUserId } });
    if (!link || link.companyId !== companyId) {
      throw new NotFoundException('Không tìm thấy tài khoản phụ');
    }
    if (link.type === CompanyUserType.MAIN) {
      throw new ForbiddenException('Không thể xoá Tài khoản Chính');
    }
    await this.companyUserRepo.delete(link.id);
    return { success: true };
  }

  // ===== B4 — Gói dịch vụ & Đơn hàng =====

  listPackages() {
    return this.packageRepo.find({ where: { active: true }, order: { price: 'ASC' } });
  }

  async listOrders(userId: string) {
    const companyId = await this.getCompanyIdForUser(userId);
    return this.orderRepo.find({
      where: { companyId },
      relations: { servicePackage: true },
      order: { createdAt: 'DESC' },
    });
  }

  // Đặt đơn hàng cho gói dịch vụ. Phương thức "Hợp đồng + hoá đơn VAT" xử lý thủ công (Admin xác
  // nhận đã nhận thanh toán/hợp đồng) — các cổng thanh toán trực tuyến thật (VNPay/MoMo/ZaloPay/
  // VietQR) CHƯA được tích hợp trong môi trường lập trình này (cần tài khoản merchant thật), nên
  // đơn hàng luôn ở trạng thái PENDING chờ Admin xác nhận, không tự động kích hoạt.
  async createOrder(userId: string, dto: CreateOrderDto) {
    const companyId = await this.getCompanyIdForUser(userId);
    const pkg = await this.packageRepo.findOne({ where: { id: dto.servicePackageId, active: true } });
    if (!pkg) throw new NotFoundException('Không tìm thấy gói dịch vụ');

    const order = this.orderRepo.create({
      companyId,
      servicePackageId: pkg.id,
      quantity: pkg.quantity,
      remaining: pkg.quantity,
      paymentMethod: dto.paymentMethod,
      status: OrderStatus.PENDING,
    });
    return this.orderRepo.save(order);
  }
}
