import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company, CompanyApprovalStatus } from '../database/entities/company.entity';
import { JobPosting, JobApprovalStatus } from '../database/entities/job-posting.entity';
import { User, UserRole } from '../database/entities/user.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { Order, OrderStatus, PaymentMethod } from '../database/entities/order.entity';
import { Payment, PaymentStatus } from '../database/entities/payment.entity';
import { Invoice, InvoiceStatus } from '../database/entities/invoice.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(JobPosting) private readonly jobRepo: Repository<JobPosting>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(CandidateProfile) private readonly candidateProfileRepo: Repository<CandidateProfile>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
  ) {}

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

    const recentJobsPending = await this.jobRepo.find({
      where: { approvalStatus: JobApprovalStatus.PENDING },
      relations: { company: true },
      order: { createdAt: 'DESC' },
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

  listPendingJobs() {
    return this.jobRepo.find({
      where: { approvalStatus: JobApprovalStatus.PENDING },
      relations: { company: true },
      order: { createdAt: 'ASC' },
    });
  }

  async setJobStatus(id: string, status: JobApprovalStatus.APPROVED | JobApprovalStatus.REJECTED) {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    job.approvalStatus = status;
    return this.jobRepo.save(job);
  }

  listPendingCompanies() {
    return this.companyRepo.find({
      where: { approvalStatus: CompanyApprovalStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  async setCompanyStatus(
    id: string,
    status: CompanyApprovalStatus.APPROVED | CompanyApprovalStatus.REJECTED,
  ) {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');
    company.approvalStatus = status;
    return this.companyRepo.save(company);
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

  async confirmOrderPayment(id: string) {
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

    return this.orderRepo.findOne({
      where: { id: order.id },
      relations: { company: true, servicePackage: true, invoice: true },
    });
  }
}
