import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { Company, CompanyApprovalStatus } from '../database/entities/company.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { JobPosting, JobApprovalStatus } from '../database/entities/job-posting.entity';
import { Application } from '../database/entities/application.entity';
import { User, UserRole } from '../database/entities/user.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { Order, OrderStatus, PaymentMethod } from '../database/entities/order.entity';
import { Payment, PaymentStatus } from '../database/entities/payment.entity';
import { Invoice, InvoiceStatus } from '../database/entities/invoice.entity';
import { SearchHistory } from '../database/entities/search-history.entity';
import { AdminAuditLog } from '../database/entities/admin-audit-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateJobDto } from '../employer/dto/update-job.dto';
import { RejectJobDto } from './dto/reject-job.dto';
import { JOB_EDITABLE_FIELDS } from '../common/job-editable-fields';
import { sanitizeRichText } from '../common/sanitize-html.util';

// Đợt 12q (21/09/2026) — thông tin admin đang đăng nhập, lấy từ CurrentUser() (payload JWT), dùng để
// ghi nhật ký thao tác (mục #4 Batch 5). Chỉ cần userId + email, không cần load lại từ CSDL.
export type AdminActor = { userId: string; email: string };

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(CompanyUser) private readonly companyUserRepo: Repository<CompanyUser>,
    @InjectRepository(JobPosting) private readonly jobRepo: Repository<JobPosting>,
    @InjectRepository(Application) private readonly applicationRepo: Repository<Application>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(CandidateProfile) private readonly candidateProfileRepo: Repository<CandidateProfile>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(SearchHistory) private readonly searchHistoryRepo: Repository<SearchHistory>,
    @InjectRepository(AdminAuditLog) private readonly auditRepo: Repository<AdminAuditLog>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async logAction(
    admin: AdminActor,
    action: string,
    targetType: string,
    targetId?: string,
    description?: string,
  ) {
    await this.auditRepo.save(
      this.auditRepo.create({
        adminUserId: admin.userId,
        adminEmail: admin.email,
        action,
        targetType,
        targetId,
        description,
      }),
    );
  }

  // Đợt 12m (21/09/2026) — báo cho TẤT CẢ tài khoản (Chính + Phụ) gắn với 1 công ty, vì bất kỳ ai
  // trong số đó có thể là người cần biết tin/hồ sơ công ty vừa đổi trạng thái duyệt.
  private async notifyCompanyUsers(companyId: string, type: string, content: string) {
    const companyUsers = await this.companyUserRepo.find({ where: { companyId } });
    await this.notificationsService.createMany(companyUsers.map((cu) => cu.userId), type, content);
  }

  // Job alert (đợt 12m) — khi 1 tin được duyệt, đối chiếu với các "Tìm kiếm đã lưu" của ứng viên
  // (bảng search_histories, owner_type='candidate_profile') để báo tin mới phù hợp. Khớp đơn giản:
  // có lọc ngành thì phải trùng ngành; có lọc tỉnh/thành thì phải trùng ít nhất 1 tỉnh; nếu tìm kiếm
  // không lọc gì (chỉ có từ khoá) thì so khớp từ khoá với chức danh tin.
  private async notifyJobAlertMatches(job: JobPosting) {
    const rows = await this.searchHistoryRepo.find({ where: { ownerType: 'candidate_profile' } });
    if (rows.length === 0) return;

    const jobProvinces = job.provinces?.length
      ? job.provinces
      : job.location
        ? job.location.split('|').map((s) => s.trim()).filter(Boolean)
        : [];

    const matchingProfileIds = new Set<string>();
    for (const row of rows) {
      const criteria = (row.criteria ?? {}) as Record<string, unknown>;
      const industries = Array.isArray(criteria.industries) ? (criteria.industries as string[]) : [];
      const provinces = Array.isArray(criteria.provinces) ? (criteria.provinces as string[]) : [];
      const q = typeof criteria.q === 'string' ? criteria.q.trim().toLowerCase() : '';

      let matched = true;
      if (industries.length > 0) matched = matched && !!job.industry && industries.includes(job.industry);
      if (provinces.length > 0) matched = matched && jobProvinces.some((p) => provinces.includes(p));
      if (industries.length === 0 && provinces.length === 0) {
        matched = q.length > 0 && job.title.toLowerCase().includes(q);
      }
      if (matched) matchingProfileIds.add(row.ownerId);
    }
    if (matchingProfileIds.size === 0) return;

    const profiles = await this.candidateProfileRepo.find({
      where: { id: In(Array.from(matchingProfileIds)), allowJobNotifications: true },
    });
    if (profiles.length === 0) return;
    await this.notificationsService.createMany(
      profiles.map((p) => p.userId),
      'job_suggested',
      `Có tin mới phù hợp với tìm kiếm đã lưu của bạn: "${job.title}"`,
    );
  }

  async getDashboard() {
    const [employerCount, candidateCount, companyCount, jobCount, pendingJobs, pendingCompanies] =
      await Promise.all([
        this.userRepo.count({ where: [{ role: UserRole.EMPLOYER_MAIN }, { role: UserRole.EMPLOYER_SUB }] }),
        this.candidateProfileRepo.count(),
        this.companyRepo.count(),
        this.jobRepo.count(),
        this.jobRepo.count({ where: { approvalStatus: JobApprovalStatus.PENDING } }),
        this.companyRepo.count({ where: { approvalStatus: CompanyApprovalStatus.PENDING } }),
      ]);

    // Đợt 13 (24/09/2026) — updatedAt thay vì createdAt, xem ghi chú ở listPendingJobs() bên dưới.
    const recentJobsPending = await this.jobRepo.find({
      where: { approvalStatus: JobApprovalStatus.PENDING },
      relations: { company: true },
      order: { updatedAt: 'DESC' },
      take: 5,
    });

    return {
      employerCount,
      candidateCount,
      companyCount,
      jobCount,
      pendingJobsCount: pendingJobs,
      pendingCompaniesCount: pendingCompanies,
      recentPendingJobs: recentJobsPending,
    };
  }

  // Đợt 12aa (24/09/2026) — đổi ASC → DESC theo yêu cầu người dùng: tin mới gửi nằm ở đầu danh
  // sách để Admin dễ thấy tin mới nhất, thay vì phải cuộn xuống cuối (trước đó xếp kiểu FIFO, tin
  // cũ nhất lên đầu — hợp lý cho hàng đợi nhưng không hợp lý cho việc "dễ thấy tin mới").
  // Đợt 13 (24/09/2026) — đổi tiếp createdAt → updatedAt: tin bị Admin từ chối rồi NTD sửa gửi lại
  // (employer.service.ts chỉ đổi approvalStatus, KHÔNG đổi createdAt — cột @CreateDateColumn không
  // đổi được) trước đó vẫn kẹt ở vị trí cũ theo ngày tạo gốc thay vì nhảy lên đầu như tin gửi lần
  // đầu. updated_at tự động cập nhật mỗi lần save() kể cả khi resubmit nên phản ánh đúng "vừa gửi".
  listPendingJobs() {
    return this.jobRepo.find({
      where: { approvalStatus: JobApprovalStatus.PENDING },
      relations: { company: true },
      order: { updatedAt: 'DESC' },
    });
  }

  // Đợt 12i (21/09/2026) — cho Admin xem trước đúng nội dung tin (kể cả tin CHƯA duyệt) trước khi
  // bấm Duyệt/Từ chối, thay vì chỉ đọc vài dòng rút gọn trong bảng. Route công khai GET /jobs/:id
  // chỉ trả về tin đã duyệt (approvalStatus = APPROVED) nên không dùng lại được cho mục đích này.
  async getJobForReview(id: string) {
    const job = await this.jobRepo.findOne({ where: { id }, relations: { company: true } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    return job;
  }

  async setJobStatus(
    admin: AdminActor,
    id: string,
    status: JobApprovalStatus.APPROVED | JobApprovalStatus.REJECTED,
  ) {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    job.approvalStatus = status;
    // Đợt 12x (21/09/2026) — tin được duyệt (kể cả sau khi từng bị từ chối rồi NTD sửa lại gửi lên)
    // thì xoá lý do từ chối cũ, tránh còn sót lại gây hiểu nhầm khi xem lại tin đã duyệt.
    if (status === JobApprovalStatus.APPROVED) {
      // Dùng `null` (không phải `undefined`) để TypeORM thực sự XOÁ giá trị cũ trong CSDL — gán
      // `undefined` sẽ bị TypeORM bỏ qua, coi như "không đổi trường này" (giữ nguyên lý do cũ).
      job.rejectionReasons = null as unknown as string[];
      job.rejectionNote = null as unknown as string;
    }
    const saved = await this.jobRepo.save(job);

    if (status === JobApprovalStatus.APPROVED) {
      await this.notifyCompanyUsers(
        job.companyId,
        'job_approved',
        `Tin "${job.title}" đã được duyệt và hiển thị công khai trong tìm kiếm việc làm.`,
      );
      await this.notifyJobAlertMatches(saved);
    } else {
      await this.notifyCompanyUsers(
        job.companyId,
        'job_rejected',
        `Tin "${job.title}" đã bị từ chối. Vui lòng kiểm tra và sửa lại nội dung trước khi gửi duyệt lại.`,
      );
    }
    await this.logAction(
      admin,
      status === JobApprovalStatus.APPROVED ? 'job.approve' : 'job.reject',
      'job',
      job.id,
      job.title,
    );
    return saved;
  }

  // Đợt 12x (21/09/2026) — "Bắt buộc nhập lý do khi Từ chối" (theo yêu cầu người dùng, thay cho từ
  // chối "trống không" như setJobStatus() ở trên) — dùng riêng cho route từ chối 1 tin (trang Xem
  // tin). Từ chối hàng loạt (bulkSetJobStatus) vẫn dùng setJobStatus() không kèm lý do, vì đó là thao
  // tác gạt bỏ nhanh nhiều tin cùng lúc, không phải luồng duyệt đọc kỹ từng tin.
  async rejectJobWithReason(admin: AdminActor, id: string, dto: RejectJobDto) {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    job.approvalStatus = JobApprovalStatus.REJECTED;
    job.rejectionReasons = dto.reasons;
    job.rejectionNote = dto.note;
    const saved = await this.jobRepo.save(job);

    const reasonText = dto.reasons.join('; ');
    await this.notifyCompanyUsers(
      job.companyId,
      'job_rejected',
      `Tin "${job.title}" đã bị từ chối. Lý do: ${reasonText}.${dto.note ? ` Ghi chú thêm: ${dto.note}.` : ''} Vui lòng sửa lại nội dung rồi gửi duyệt lại.`,
    );
    await this.logAction(admin, 'job.reject', 'job', job.id, `${job.title} — Lý do: ${reasonText}`);
    return saved;
  }

  // Đợt 12x (21/09/2026) — "Sửa tin trước khi duyệt" (theo yêu cầu người dùng: Admin duyệt thấy tin
  // có sai sót thì sửa luôn rồi duyệt, thay vì phải từ chối rồi chờ NTD tự sửa gửi lại). Khác
  // EmployerService.updateJob(): KHÔNG đổi approvalStatus (tin đang PENDING vẫn PENDING, Admin bấm
  // "Duyệt tin này" ở bước riêng sau khi sửa xong — xem trang admin/sua-tin/[id]), và KHÔNG kiểm tra
  // quyền sở hữu công ty (Admin sửa được tin của bất kỳ công ty nào). Dùng chung danh sách trường
  // JOB_EDITABLE_FIELDS với EmployerService để không lệch nhau khi có trường mới.
  async adminUpdateJob(admin: AdminActor, id: string, dto: UpdateJobDto) {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    for (const key of JOB_EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(dto, key)) {
        const value = key === 'description' || key === 'requirements' ? sanitizeRichText(dto[key]) : dto[key];
        (job as unknown as Record<string, unknown>)[key] = value;
      }
    }
    const saved = await this.jobRepo.save(job);
    await this.logAction(admin, 'job.admin_edit', 'job', job.id, job.title);
    return saved;
  }

  // Đợt 12q (21/09/2026) — Batch 5 mục #2 "Duyệt/từ chối hàng loạt": lặp qua setJobStatus() cho từng
  // id thay vì viết lại logic duyệt riêng, để giữ đúng luồng thông báo + job alert + nhật ký của
  // đường duyệt đơn lẻ. Bỏ qua id không tồn tại/đã xử lý thay vì làm hỏng cả lô.
  async bulkSetJobStatus(
    admin: AdminActor,
    ids: string[],
    status: JobApprovalStatus.APPROVED | JobApprovalStatus.REJECTED,
  ) {
    let succeeded = 0;
    const failed: string[] = [];
    for (const id of ids) {
      try {
        await this.setJobStatus(admin, id, status);
        succeeded++;
      } catch {
        failed.push(id);
      }
    }
    await this.logAction(
      admin,
      status === JobApprovalStatus.APPROVED ? 'job.bulk_approve' : 'job.bulk_reject',
      'job',
      undefined,
      `${succeeded}/${ids.length} tin${failed.length ? ` (lỗi: ${failed.length})` : ''}`,
    );
    return { succeeded, failed };
  }

  listPendingCompanies() {
    return this.companyRepo.find({
      where: { approvalStatus: CompanyApprovalStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  async setCompanyStatus(
    admin: AdminActor,
    id: string,
    status: CompanyApprovalStatus.APPROVED | CompanyApprovalStatus.REJECTED,
  ) {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');
    company.approvalStatus = status;
    const saved = await this.companyRepo.save(company);

    await this.notifyCompanyUsers(
      company.id,
      status === CompanyApprovalStatus.APPROVED ? 'company_approved' : 'company_rejected',
      status === CompanyApprovalStatus.APPROVED
        ? `Hồ sơ công ty "${company.name}" đã được duyệt.`
        : `Hồ sơ công ty "${company.name}" bị từ chối. Vui lòng cập nhật giấy tờ pháp lý và gửi lại.`,
    );
    await this.logAction(
      admin,
      status === CompanyApprovalStatus.APPROVED ? 'company.approve' : 'company.reject',
      'company',
      company.id,
      company.name,
    );
    return saved;
  }

  async bulkSetCompanyStatus(
    admin: AdminActor,
    ids: string[],
    status: CompanyApprovalStatus.APPROVED | CompanyApprovalStatus.REJECTED,
  ) {
    let succeeded = 0;
    const failed: string[] = [];
    for (const id of ids) {
      try {
        await this.setCompanyStatus(admin, id, status);
        succeeded++;
      } catch {
        failed.push(id);
      }
    }
    await this.logAction(
      admin,
      status === CompanyApprovalStatus.APPROVED ? 'company.bulk_approve' : 'company.bulk_reject',
      'company',
      undefined,
      `${succeeded}/${ids.length} công ty${failed.length ? ` (lỗi: ${failed.length})` : ''}`,
    );
    return { succeeded, failed };
  }

  // Đợt 12q (21/09/2026) — Batch 5 mục #1 "Bật/tắt Doanh nghiệp yêu thích qua Admin UI": trước đây cờ
  // isFeaturedEmployer chỉ có thể bật thẳng trong CSDL (không có UI). Tìm công ty theo tên để chọn,
  // rồi bật/tắt — không giới hạn theo approvalStatus vì Admin có thể cần xem lại cả công ty đã duyệt.
  async searchCompanies(q?: string) {
    const qb = this.companyRepo.createQueryBuilder('company').orderBy('company.isFeaturedEmployer', 'DESC').addOrderBy('company.name', 'ASC');
    if (q?.trim()) {
      qb.where('company.name ILIKE :q', { q: `%${q.trim()}%` });
    }
    return qb.take(30).getMany();
  }

  async toggleFeaturedEmployer(admin: AdminActor, id: string) {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');
    company.isFeaturedEmployer = !company.isFeaturedEmployer;
    const saved = await this.companyRepo.save(company);
    await this.logAction(
      admin,
      'company.toggle_featured',
      'company',
      company.id,
      `${company.name} → ${saved.isFeaturedEmployer ? 'Đánh dấu' : 'Bỏ đánh dấu'} Doanh nghiệp yêu thích`,
    );
    return saved;
  }

  // ===== Đợt 12a (20/09/2026) — Admin hỗ trợ đặt lại mật khẩu =====
  // Giai đoạn 1 không có email/SMS (quyết định phạm vi ban đầu) nên không tự phục vụ "quên mật
  // khẩu" qua email được — thay vào đó Admin tra cứu tài khoản theo email rồi đặt lại mật khẩu
  // tạm, tự báo cho người dùng qua kênh ngoài hệ thống (điện thoại, gặp trực tiếp...). Người dùng
  // nên đổi lại mật khẩu ngay sau khi đăng nhập bằng mật khẩu tạm (xem AuthService.changePassword).
  async findUserByEmail(email: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản với email này');
    return { id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status };
  }

  async resetUserPassword(admin: AdminActor, id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    const tempPassword = crypto.randomBytes(6).toString('base64url'); // 8 ký tự, đủ ngẫu nhiên cho mật khẩu tạm
    user.passwordHash = await argon2.hash(tempPassword);
    await this.userRepo.save(user);
    await this.logAction(admin, 'user.reset_password', 'user', user.id, user.email);
    return { email: user.email, tempPassword };
  }

  // ===== B4 — Xác nhận thanh toán đơn hàng (Hợp đồng + hoá đơn VAT) =====
  // Chỉ áp dụng cho đơn dùng phương thức contract_vat: đây vốn là quy trình thủ công
  // (ký hợp đồng, chuyển khoản ngoài hệ thống) — Admin xác nhận thay vì cổng thanh toán tự động,
  // vì 3 cổng online (VNPay/MoMo/ZaloPay) chưa có thông tin tích hợp thật (xem quyết định đợt 6).
  listPendingOrders() {
    return this.orderRepo.find({
      where: { status: OrderStatus.PENDING },
      relations: { company: true, servicePackage: true },
      order: { createdAt: 'ASC' },
    });
  }

  async confirmOrderPayment(admin: AdminActor, id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: { servicePackage: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException('Đơn hàng này đã được xử lý trước đó');
    }

    const now = new Date();
    order.status = OrderStatus.ACTIVE;
    order.activatedAt = now;
    order.expiresAt = new Date(now.getTime() + order.servicePackage.durationDays * 24 * 60 * 60 * 1000);
    order.remaining = order.servicePackage.quantity;
    await this.orderRepo.save(order);

    const payment = this.paymentRepo.create({
      orderId: order.id,
      gateway: order.paymentMethod,
      amount: order.servicePackage.price,
      status: PaymentStatus.SUCCESS,
    });
    await this.paymentRepo.save(payment);

    if (order.paymentMethod === PaymentMethod.CONTRACT_VAT) {
      const invoice = this.invoiceRepo.create({
        orderId: order.id,
        invoiceNumber: `HD${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${now.getTime().toString().slice(-6)}`,
        vatAmount: Math.round(Number(order.servicePackage.price) * 0.1),
        status: InvoiceStatus.ISSUED,
      });
      await this.invoiceRepo.save(invoice);
    }

    await this.logAction(
      admin,
      'order.confirm_payment',
      'order',
      order.id,
      order.servicePackage ? `${order.servicePackage.name}` : undefined,
    );

    return this.orderRepo.findOne({
      where: { id: order.id },
      relations: { company: true, servicePackage: true, invoice: true },
    });
  }

  // ===== Batch 5 mục #4 — Nhật ký thao tác admin =====
  async getAuditLog(page = 1, pageSize = 30) {
    const [items, total] = await this.auditRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  // ===== Batch 5 mục #3 — Biểu đồ dashboard theo thời gian =====
  // Đợt 12q (21/09/2026) — đếm số bản ghi mới mỗi ngày trong N ngày gần nhất (mặc định 14) cho 4 chỉ
  // số: tin đăng mới, công ty đăng ký mới, ứng viên đăng ký mới, đơn ứng tuyển mới. Gộp theo ngày ở
  // tầng ứng dụng (JS) thay vì raw SQL GROUP BY phức tạp cho từng bảng — dữ liệu quy mô vừa phải
  // (~1000-2000 bản ghi/bảng theo đợt sinh dữ liệu ảo) nên không đáng lo hiệu năng.
  async getStatsTimeSeries(days = 14) {
    const clampedDays = Math.min(90, Math.max(1, days));
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (clampedDays - 1));

    const countByDay = async (
      repo: Repository<{ id: string }>,
      dateColumn: string,
      extraWhere?: string,
      extraParams?: Record<string, unknown>,
    ) => {
      const qb = repo
        .createQueryBuilder('t')
        .select(`to_char(date_trunc('day', t.${dateColumn}), 'YYYY-MM-DD')`, 'day')
        .addSelect('COUNT(*)', 'count')
        .where(`t.${dateColumn} >= :since`, { since })
        .groupBy('day');
      if (extraWhere) qb.andWhere(extraWhere, extraParams);
      const rows = await qb.getRawMany<{ day: string; count: string }>();
      const map = new Map<string, number>();
      rows.forEach((r) => map.set(r.day, Number(r.count)));
      return map;
    };

    const [jobsByDay, companiesByDay, candidatesByDay, applicationsByDay] = await Promise.all([
      countByDay(this.jobRepo as unknown as Repository<{ id: string }>, 'createdAt'),
      countByDay(this.companyRepo as unknown as Repository<{ id: string }>, 'createdAt'),
      countByDay(this.userRepo as unknown as Repository<{ id: string }>, 'createdAt', 't.role = :role', {
        role: UserRole.CANDIDATE,
      }),
      countByDay(this.applicationRepo as unknown as Repository<{ id: string }>, 'appliedAt'),
    ]);

    const series: {
      date: string;
      jobsPosted: number;
      companiesRegistered: number;
      candidatesRegistered: number;
      applications: number;
    }[] = [];
    for (let i = 0; i < clampedDays; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      series.push({
        date: key,
        jobsPosted: jobsByDay.get(key) ?? 0,
        companiesRegistered: companiesByDay.get(key) ?? 0,
        candidatesRegistered: candidatesByDay.get(key) ?? 0,
        applications: applicationsByDay.get(key) ?? 0,
      });
    }
    return series;
  }
}
