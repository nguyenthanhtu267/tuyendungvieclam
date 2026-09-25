import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { CompanyUser } from './company-user.entity';
import { JobPosting } from './job-posting.entity';
import { Order } from './order.entity';

export enum CompanyApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// SRS Mục 10 + 6.7 (Quản lý tài khoản & thông tin công ty): giấy tờ pháp lý dùng cùng chiến lược
// file nhẹ/link Drive như CV (Mục 9: ≤3MB/tệp).
@Entity({ name: 'companies' })
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'tax_code', unique: true })
  taxCode: string;

  @Column({ nullable: true })
  size?: string;

  @Column({ nullable: true })
  industry?: string;

  @Column({ nullable: true })
  website?: string;

  // Đợt 12ab (24/09/2026) — logo công ty hiện trên thẻ việc làm/trang công ty: theo quyết định đã
  // chốt, NTD dán link ảnh (URL) thay vì tải tệp lên (chưa nối Cloudflare R2 cho ảnh loại này).
  @Column({ name: 'logo_url', nullable: true })
  logoUrl?: string;

  // Đợt 12ac (24/09/2026) — "Giới thiệu công ty" cho tab Tổng quan công ty (trang chi tiết tin), có
  // mở rộng/thu gọn ở FE khi dài — theo mẫu careerviet.vn.
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Index()
  @Column({
    type: 'enum',
    enum: CompanyApprovalStatus,
    default: CompanyApprovalStatus.PENDING,
    name: 'approval_status',
  })
  approvalStatus: CompanyApprovalStatus;

  @Column({ name: 'legal_doc_url', nullable: true })
  legalDocUrl?: string;

  @Column({ name: 'legal_doc_original_file_name', nullable: true })
  legalDocOriginalFileName?: string;

  @Column({ name: 'legal_doc_external_link', nullable: true })
  legalDocExternalLink?: string;

  // Nội dung tệp lưu trực tiếp trong CSDL (thay vì ổ đĩa máy chủ) — lý do giống CV.entity.ts:
  // tránh mất tệp khi triển khai lên máy chủ miễn phí không có ổ đĩa cố định (đợt 7, 18/09/2026).
  @Column({ name: 'legal_doc_data', type: 'bytea', nullable: true, select: false })
  legalDocData?: Buffer;

  @Column({ name: 'legal_doc_mime_type', nullable: true })
  legalDocMimeType?: string;

  // Đợt 10 — "Doanh nghiệp yêu thích" (toggle lọc + khối nổi bật trang chủ). Admin đánh dấu thủ công.
  @Index()
  @Column({ name: 'is_featured_employer', default: false })
  isFeaturedEmployer: boolean;

  // Đợt 17 (25/09/2026) — "Nguồn ngoài / Tin tổng hợp" (mô hình "labeled aggregator" đã thống nhất
  // với người dùng): Admin tự tạo hồ sơ công ty + đăng tin hộ từ các trang tuyển dụng khác
  // (careerviet.vn, vietnamworks.com, glints.com, itviec.com, viecoi.vn, lamthem.com.vn, nhóm
  // Facebook...) để tăng lượng tin ngay từ đầu, thay vì chờ từng công ty tự đăng ký. Khác với công ty
  // tự đăng ký (registerEmployer): công ty này CHƯA xác thực — hiện badge "Tin tổng hợp — chưa xác
  // thực" ở mọi nơi có tên/logo công ty (JobCard, trang chi tiết tin, trang công ty) cho tới khi
  // "nhận lại" tài khoản (claimedAt được set — xem AdminService.approveClaimRequest()/claimCompany()).
  // isAdminSourced giữ NGUYÊN true vĩnh viễn (ghi nhận lịch sử nguồn gốc), chỉ claimedAt quyết định có
  // hiện badge hay không — badge ẩn khi `isAdminSourced && !claimedAt` sai (tức đã claimedAt).
  @Index()
  @Column({ name: 'is_admin_sourced', default: false })
  isAdminSourced: boolean;

  // Nhãn nguồn tự do Admin nhập khi tạo (VD "Tổng hợp từ careerviet.vn"), hiển thị cạnh badge ở FE.
  @Column({ name: 'source_label', nullable: true })
  sourceLabel?: string;

  // Thời điểm công ty thật "nhận lại" tài khoản — null nghĩa là vẫn đang ở trạng thái "chưa xác thực".
  @Column({ name: 'claimed_at', type: 'timestamp', nullable: true })
  claimedAt?: Date;

  @OneToMany(() => CompanyUser, (companyUser) => companyUser.company)
  companyUsers?: CompanyUser[];

  @OneToMany(() => JobPosting, (jobPosting) => jobPosting.company)
  jobPostings?: JobPosting[];

  @OneToMany(() => Order, (order) => order.company)
  orders?: Order[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
