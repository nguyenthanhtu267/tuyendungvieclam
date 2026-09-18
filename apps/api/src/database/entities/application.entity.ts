import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { JobPosting } from './job-posting.entity';
import { CV } from './cv.entity';

export enum ApplicationStatus {
  NEW = 'new', // Mới ứng tuyển
  REVIEWING = 'reviewing', // Đang xem xét
  SUITABLE = 'suitable', // Phù hợp
  REJECTED = 'rejected', // Từ chối
  INTERVIEW = 'interview', // Mời phỏng vấn
}

@Entity({ name: 'applications' })
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'job_posting_id' })
  jobPostingId: string;

  @ManyToOne(() => JobPosting, (jobPosting) => jobPosting.applications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_posting_id' })
  jobPosting: JobPosting;

  @Column({ name: 'cv_id' })
  cvId: string;

  @ManyToOne(() => CV, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cv_id' })
  cv: CV;

  @Column({ type: 'enum', enum: ApplicationStatus, default: ApplicationStatus.NEW })
  status: ApplicationStatus;

  @Column({ name: 'cover_letter', type: 'text', nullable: true })
  coverLetter?: string;

  @CreateDateColumn({ name: 'applied_at' })
  appliedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
