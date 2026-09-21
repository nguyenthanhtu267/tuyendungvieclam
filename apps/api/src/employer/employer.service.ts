import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { Company } from '../database/entities/company.entity';
import { CompanyUser, CompanyUserType } from '../database/entities/company-user.entity';
import { JobPosting, JobApprovalStatus } from '../database/entities/job-posting.entity';
import { Application, ApplicationStatus } from '../database/entities/application.entity';
import { ApplicationStatusHistory } from '../database/entities/application-status-history.entity';
import { User, UserRole } from '../database/entities/user.entity';
import { ServicePackage } from '../database/entities/service-package.entity';
import { Order, OrderStatus } from '../database/entities/order.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateSubAccountDto } from './dto/create-sub-account.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { EmployerJobStatus } from './dto/list-jobs-query.dto';
import { ListApplicantsQueryDto } from './dto/list-applicants-query.dto';
import { sanitizeRichText } from '../common/sanitize-html.util';

const LEGAL_DOC_MAX_BYTES = 3 * 1024 * 1024; // 3MB — theo Mục 9 SRS

@Injectable()
export class EmployerService {
  constructor(
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(CompanyUser) private readonly companyUserRepo: Repository<CompanyUser>,
    @InjectRepository(JobPosting) private readonly jobRepo: Repository<JobPosting>,
    @InjectRepository(Application) private readonly applicationRepo: Repository<Application>,
    @InjectRepository(ApplicationStatusHistory)
    private readonly applicationHistoryRepo: Repository<ApplicationStatusHistory>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ServicePackage) private readonly packageRepo: Repository<ServicePackage>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    private readonly notificationsService: NotificationsService,
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

  // Đợt 11b — Mục #4 ATS: 4 trạng thái tin do NTD tự quản lý, tính từ approvalStatus (Admin duyệt)
  // + isPaused (NTD tự tạm ngưng) + deadline (tự hết hạn theo ngày) — không thêm enum trạng thái
  // riêng để tránh 2 nguồn sự thật trùng nhau. "khac" gom draft/rejected (không thuộc 4 tab spec).
  private computeEmployerStatus(job: JobPosting): EmployerJobStatus {
    if (job.approvalStatus === JobApprovalStatus.PENDING) return 'cho_dang';
    if (job.approvalStatus === JobApprovalStatus.APPROVED) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      if (job.deadline && new Date(job.deadline) < startOfToday) return 'het_han';
      if (job.isPaused) return 'tam_ngung';
      return 'dang_dang';
    }
    if (job.approvalStatus === JobApprovalStatus.EXPIRED) return 'het_han';
    return 'khac';
  }

  async listMyJobs(userId: string, status?: EmployerJobStatus) {
    const companyId = await this.getCompanyIdForUser(userId);
    const jobs = await this.jobRepo.find({ where: { companyId }, order: { createdAt: 'DESC' } });
    const withCounts = await Promise.all(
      jobs.map(async (job) => ({
        ...job,
        applicationCount: await this.applicationRepo.count({ where: { jobPostingId: job.id } }),
        employerStatus: this.computeEmployerStatus(job),
      })),
    );
    return status ? withCounts.filter((j) => j.employerStatus === status) : withCounts;
  }

  // Đếm số tin theo từng trạng thái — dùng cho số trên tab (giống mockup NTD-02/04: "4 tab trạng
  // thái, cột CV GỢI Ý"), tính 1 lần trên toàn bộ tin của công ty để 4 tab luôn khớp tổng.
  async countMyJobsByStatus(userId: string) {
    const companyId = await this.getCompanyIdForUser(userId);
    const jobs = await this.jobRepo.find({ where: { companyId } });
    const counts: Record<EmployerJobStatus, number> = {
      dang_dang: 0,
      cho_dang: 0,
      tam_ngung: 0,
      het_han: 0,
      khac: 0,
    };
    jobs.forEach((job) => {
      counts[this.computeEmployerStatus(job)]++;
    });
    return counts;
  }

  async pauseJob(userId: string, jobId: string) {
    const job = await this.getOwnedJob(userId, jobId);
    if (this.computeEmployerStatus(job) !== 'dang_dang') {
      throw new BadRequestException('Chỉ tạm ngưng được tin đang ở trạng thái "Đang đăng"');
    }
    job.isPaused = true;
    return this.jobRepo.save(job);
  }

  async resumeJob(userId: string, jobId: string) {
    const job = await this.getOwnedJob(userId, jobId);
    const current = this.computeEmployerStatus(job);
    if (current === 'het_han') {
      throw new BadRequestException('Tin đã hết hạn — vui lòng sao chép tin để đăng lại với hạn nộp mới');
    }
    if (current !== 'tam_ngung') {
      throw new BadRequestException('Chỉ đăng lại được tin đang ở trạng thái "Tạm ngưng"');
    }
    job.isPaused = false;
    return this.jobRepo.save(job);
  }

  // Sao chép tin (mục #4 ATS) — tin sao chép luôn về trạng thái "chờ đăng" (PENDING), chờ Admin duyệt
  // lại như tin mới hoàn toàn, không copy applications.
  async duplicateJob(userId: string, jobId: string) {
    const job = await this.getOwnedJob(userId, jobId);
    const clone = this.jobRepo.create({
      companyId: job.companyId,
      title: `${job.title} (Bản sao)`,
      industry: job.industry,
      location: job.location,
      provinces: job.provinces,
      district: job.district,
      experienceLevel: job.experienceLevel,
      isUrgent: job.isUrgent,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      employmentType: job.employmentType,
      level: job.level,
      headcount: job.headcount,
      description: job.description,
      requirements: job.requirements,
      benefits: job.benefits,
      deadline: job.deadline,
      address: job.address,
      gender: job.gender,
      ageRange: job.ageRange,
      workSchedule: job.workSchedule,
      tags: job.tags,
      approvalStatus: JobApprovalStatus.PENDING,
      isPaused: false,
    });
    return this.jobRepo.save(clone);
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
      provinces: dto.provinces,
      district: dto.district,
      experienceLevel: dto.experienceLevel,
      isUrgent: dto.isUrgent ?? false,
      salaryMin: dto.salaryMin,
      salaryMax: dto.salaryMax,
      employmentType: dto.employmentType,
      level: dto.level,
      headcount: dto.headcount ?? 1,
      description: sanitizeRichText(dto.description),
      requirements: sanitizeRichText(dto.requirements),
      benefits: dto.benefits,
      deadline: dto.deadline,
      address: dto.address,
      gender: dto.gender,
      ageRange: dto.ageRange,
      workSchedule: dto.workSchedule,
      tags: dto.tags,
      approvalStatus: JobApprovalStatus.PENDING,
    });
    return this.jobRepo.save(job);
  }

  private async getOwnedJob(userId: string, jobId: string): Promise<JobPosting> {
    const companyId = await this.getCompanyIdForUser(userId);
    // Đợt 12l (21/09/2026) — nạp thêm quan hệ company để trang Xem trước (NTD) có đủ thông tin
    // công ty hiển thị giống hệt trang chi tiết tin công khai, không cần truy vấn thêm.
    const job = await this.jobRepo.findOne({ where: { id: jobId }, relations: { company: true } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    if (job.companyId !== companyId) {
      throw new ForbiddenException('Bạn không có quyền truy cập tin tuyển dụng này');
    }
    return job;
  }

  async getJob(userId: string, jobId: string) {
    return this.getOwnedJob(userId, jobId);
  }

  // Đợt 12l (21/09/2026) — sửa tin đã đăng: chỉ gán lại những trường THỰC SỰ có mặt trong dto (kể
  // cả khi giá trị là null, để NTD có thể "xoá" một trường tuỳ chọn — VD bật lại "Thoả thuận" thì
  // salaryMin/salaryMax gửi null để xoá số cũ). Sau khi lưu, tin luôn quay về PENDING chờ Admin
  // duyệt lại — theo quyết định người dùng chốt đợt 12l (nhất quán với "Sao chép tin").
  private static readonly EDITABLE_JOB_FIELDS = [
    'title',
    'industry',
    'location',
    'provinces',
    'district',
    'experienceLevel',
    'isUrgent',
    'salaryMin',
    'salaryMax',
    'employmentType',
    'level',
    'headcount',
    'description',
    'requirements',
    'benefits',
    'deadline',
    'address',
    'gender',
    'ageRange',
    'workSchedule',
    'tags',
  ] as const;

  async updateJob(userId: string, jobId: string, dto: UpdateJobDto) {
    const job = await this.getOwnedJob(userId, jobId);
    for (const key of EmployerService.EDITABLE_JOB_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(dto, key)) {
        const value = key === 'description' || key === 'requirements' ? sanitizeRichText(dto[key]) : dto[key];
        (job as unknown as Record<string, unknown>)[key] = value;
      }
    }
    job.approvalStatus = JobApprovalStatus.PENDING;
    return this.jobRepo.save(job);
  }

  // Đợt 11b — Mục #4 ATS: bộ lọc nâng cao (trạng thái, thư mục, đánh giá tối thiểu, từ khoá, khoảng
  // ngày nộp). Mặc định KHÔNG lấy hồ sơ đã vào thùng rác (soft-delete) — xem listTrashedApplicants().
  async listApplicants(userId: string, jobId: string, filters: ListApplicantsQueryDto = {}) {
    await this.getOwnedJob(userId, jobId);
    const qb = this.applicationRepo
      .createQueryBuilder('app')
      .leftJoinAndSelect('app.cv', 'cv')
      .leftJoinAndSelect('cv.candidateProfile', 'candidateProfile')
      .where('app.job_posting_id = :jobId', { jobId })
      .andWhere('app.deleted_at IS NULL')
      .orderBy('app.applied_at', 'DESC');
    if (filters.status) qb.andWhere('app.status = :status', { status: filters.status });
    if (filters.folder) qb.andWhere('app.folder = :folder', { folder: filters.folder });
    if (filters.ratingMin != null) qb.andWhere('app.rating >= :ratingMin', { ratingMin: filters.ratingMin });
    if (filters.q) {
      qb.andWhere('(candidateProfile.fullName ILIKE :q OR candidateProfile.desiredPosition ILIKE :q)', {
        q: `%${filters.q}%`,
      });
    }
    if (filters.dateFrom) qb.andWhere('app.applied_at >= :dateFrom', { dateFrom: filters.dateFrom });
    if (filters.dateTo) qb.andWhere('app.applied_at <= :dateTo', { dateTo: filters.dateTo });
    return qb.getMany();
  }

  // Danh sách thư mục đang dùng trong toàn công ty — để giao diện gợi ý thay vì gõ lại từ đầu.
  async listFolders(userId: string) {
    const companyId = await this.getCompanyIdForUser(userId);
    const rows = await this.applicationRepo
      .createQueryBuilder('app')
      .innerJoin('app.jobPosting', 'job')
      .where('job.company_id = :companyId', { companyId })
      .andWhere('app.folder IS NOT NULL')
      .andWhere('app.deleted_at IS NULL')
      .select('DISTINCT app.folder', 'folder')
      .getRawMany<{ folder: string }>();
    return rows.map((r) => r.folder).sort((a, b) => a.localeCompare(b, 'vi'));
  }

  // Thùng rác — hồ sơ ứng tuyển NTD đã "xoá" khỏi danh sách quản lý (không xoá đơn ứng tuyển thật
  // của ứng viên, xem ghi chú .withDeleted() ở applications.service.ts listOwn()).
  async listTrashedApplicants(userId: string, jobId: string) {
    await this.getOwnedJob(userId, jobId);
    return this.applicationRepo
      .createQueryBuilder('app')
      .withDeleted()
      .leftJoinAndSelect('app.cv', 'cv')
      .leftJoinAndSelect('cv.candidateProfile', 'candidateProfile')
      .where('app.job_posting_id = :jobId', { jobId })
      .andWhere('app.deleted_at IS NOT NULL')
      .orderBy('app.deleted_at', 'DESC')
      .getMany();
  }

  private async getOwnedApplication(userId: string, applicationId: string, withDeleted = false): Promise<Application> {
    const companyId = await this.getCompanyIdForUser(userId);
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: { jobPosting: true, cv: { candidateProfile: true } },
      withDeleted,
    });
    if (!application) throw new NotFoundException('Không tìm thấy đơn ứng tuyển');
    if (application.jobPosting.companyId !== companyId) {
      throw new ForbiddenException('Bạn không có quyền truy cập đơn ứng tuyển này');
    }
    return application;
  }

  // Đợt 12m (21/09/2026) — báo cho ứng viên khi NTD đổi trạng thái đơn ứng tuyển. `getOwnedApplication`
  // đã nạp sẵn quan hệ jobPosting + cv.candidateProfile nên có đủ dữ liệu, không cần truy vấn thêm.
  private static readonly APPLICATION_STATUS_NOTIFICATION: Partial<Record<ApplicationStatus, string>> = {
    [ApplicationStatus.REVIEWING]: 'Nhà tuyển dụng đang xem xét hồ sơ ứng tuyển của bạn cho vị trí',
    [ApplicationStatus.SUITABLE]: 'Hồ sơ ứng tuyển của bạn được đánh giá Phù hợp cho vị trí',
    [ApplicationStatus.INTERVIEW]: 'Bạn được mời phỏng vấn cho vị trí',
    [ApplicationStatus.REJECTED]: 'Rất tiếc, hồ sơ ứng tuyển của bạn không phù hợp với vị trí',
  };

  async updateApplicationStatus(userId: string, applicationId: string, status: ApplicationStatus) {
    const application = await this.getOwnedApplication(userId, applicationId);
    const statusChanged = application.status !== status;
    application.status = status;
    const saved = await this.applicationRepo.save(application);

    if (statusChanged) {
      // Đợt 12o (21/09/2026) — ghi "Nhật ký trạng thái ứng tuyển" mỗi lần NTD đổi trạng thái, để
      // ứng viên xem lại được dòng thời gian xử lý hồ sơ của mình (GET /me/applications/:id/history).
      await this.applicationHistoryRepo.save(
        this.applicationHistoryRepo.create({ applicationId: application.id, status }),
      );
      const message = EmployerService.APPLICATION_STATUS_NOTIFICATION[status];
      const candidateUserId = application.cv?.candidateProfile?.userId;
      if (message && candidateUserId) {
        const type = status === ApplicationStatus.INTERVIEW ? 'interview_invite' : 'application_status';
        await this.notificationsService.create(candidateUserId, type, `${message} "${application.jobPosting.title}".`);
      }
    }
    return saved;
  }

  async rateApplication(userId: string, applicationId: string, rating: number) {
    const application = await this.getOwnedApplication(userId, applicationId);
    application.rating = rating;
    return this.applicationRepo.save(application);
  }

  async setApplicationFolder(userId: string, applicationId: string, folder?: string) {
    const application = await this.getOwnedApplication(userId, applicationId);
    application.folder = folder && folder.trim().length > 0 ? folder.trim() : null;
    return this.applicationRepo.save(application);
  }

  async trashApplication(userId: string, applicationId: string) {
    const application = await this.getOwnedApplication(userId, applicationId);
    await this.applicationRepo.softDelete(application.id);
    return { success: true };
  }

  async restoreApplication(userId: string, applicationId: string) {
    const application = await this.getOwnedApplication(userId, applicationId, true);
    await this.applicationRepo.restore(application.id);
    return { success: true };
  }

  // Xoá vĩnh viễn — chỉ cho phép với hồ sơ ĐÃ ở trong thùng rác (bước xoá 2 lần, tránh xoá nhầm).
  async permanentlyDeleteApplication(userId: string, applicationId: string) {
    const application = await this.getOwnedApplication(userId, applicationId, true);
    if (!application.deletedAt) {
      throw new BadRequestException('Chỉ xoá vĩnh viễn được hồ sơ đang ở trong thùng rác');
    }
    await this.applicationRepo.delete(application.id);
    return { success: true };
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
    // Lưu buffer thẳng vào CSDL thay vì ổ đĩa (đợt 7, 18/09/2026) — id công ty đã biết trước nên
    // đặt luôn được legalDocUrl trỏ vào route phục vụ tệp (FilesController), không cần lưu 2 lần.
    company.legalDocUrl = `/files/legal-doc/${company.id}`;
    company.legalDocOriginalFileName = file.originalname;
    company.legalDocData = file.buffer;
    company.legalDocMimeType = file.mimetype;
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
    company.legalDocData = null;
    company.legalDocMimeType = null;
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
