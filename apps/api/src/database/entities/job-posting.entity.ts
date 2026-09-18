import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Company } from './company.entity';
import { Application } from './application.entity';
import { SavedJob } from './saved-job.entity';

export enum JobApprovalStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Entity({ name: 'job_postings' })
export class JobPosting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.jobPostings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column()
  title: string;

  @Column({ nullable: true })
  industry?: string;

  @Column({ nullable: true })
  location?: string;

  @Column({ name: 'salary_min', type: 'int', nullable: true })
  salaryMin?: number;

  @Column({ name: 'salary_max', type: 'int', nullable: true })
  salaryMax?: number;

  @Column({ name: 'employment_type', nullable: true })
  employmentType?: string;

  @Column({ nullable: true })
  level?: string;

  @Column({ name: 'headcount', type: 'int', default: 1 })
  headcount: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  requirements?: string;

  @Column({ type: 'simple-array', nullable: true })
  benefits?: string[];

  @Column({ name: 'banner_image_url', nullable: true })
  bannerImageUrl?: string;

  @Column({ name: 'banner_image_external_link', nullable: true })
  bannerImageExternalLink?: string;

  @Column({ name: 'deadline', type: 'date', nullable: true })
  deadline?: string;

  @Column({
    type: 'enum',
    enum: JobApprovalStatus,
    default: JobApprovalStatus.DRAFT,
    name: 'approval_status',
  })
  approvalStatus: JobApprovalStatus;

  @OneToMany(() => Application, (application) => application.jobPosting)
  applications?: Application[];

  @OneToMany(() => SavedJob, (savedJob) => savedJob.jobPosting)
  savedByCandidates?: SavedJob[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
