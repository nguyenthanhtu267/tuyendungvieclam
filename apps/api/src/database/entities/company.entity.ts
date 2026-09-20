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
