import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
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
