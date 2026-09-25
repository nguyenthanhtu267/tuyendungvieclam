import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Company } from './company.entity';

export enum CompanyClaimRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// Đợt 17 (25/09/2026) — "Đây là công ty của bạn?": khi 1 công ty do Admin tạo hộ từ nguồn ngoài
// (Company.isAdminSourced = true) hiện công khai, bất kỳ ai tự nhận là đại diện công ty đó có thể gửi
// yêu cầu "nhận lại" qua nút trên trang công ty (companies.controller.ts, public, không cần đăng nhập
// — công ty thật CHƯA có tài khoản để đăng nhập vào lúc này). Admin xem danh sách chờ duyệt ở tab
// "Nguồn ngoài", xác minh thông tin NGOÀI hệ thống (điện thoại/email công ty, giấy tờ...) rồi mới
// Duyệt (chuyển giao tài khoản thật — xem AdminService.approveClaimRequest()) hoặc Từ chối — không tự
// động chuyển giao để tránh ai đó mạo danh "nhận lại" công ty của người khác.
@Entity({ name: 'company_claim_requests' })
export class CompanyClaimRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'requester_name' })
  requesterName: string;

  @Column({ name: 'requester_email' })
  requesterEmail: string;

  @Column({ name: 'requester_phone', nullable: true })
  requesterPhone?: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Index()
  @Column({
    type: 'enum',
    enum: CompanyClaimRequestStatus,
    default: CompanyClaimRequestStatus.PENDING,
  })
  status: CompanyClaimRequestStatus;

  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt?: Date;
}
