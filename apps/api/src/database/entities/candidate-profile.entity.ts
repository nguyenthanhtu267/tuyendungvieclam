import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { CV } from './cv.entity';
import { SavedJob } from './saved-job.entity';
import { BlockedCompany } from './blocked-company.entity';

export enum ProfileVisibility {
  LOCKED = 'locked', // Khoá
  PUBLIC = 'public', // Công khai
  URGENT = 'urgent', // Khẩn cấp
}

// SRS Mục 10: CandidateProfile — 1 User → 1 hồ sơ chính (đơn giản hoá theo quyết định 18/09/2026:
// nhiều CV/tệp đính kèm vẫn được nhưng không cần nhiều CandidateProfile song song ở bản MVP này).
@Entity({ name: 'candidate_profiles' })
export class CandidateProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => User, (user) => user.candidateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ name: 'desired_position', nullable: true })
  desiredPosition?: string;

  @Column({ name: 'desired_level', nullable: true })
  desiredLevel?: string;

  @Column({ name: 'desired_salary_min', type: 'int', nullable: true })
  desiredSalaryMin?: number;

  @Column({ name: 'desired_salary_max', type: 'int', nullable: true })
  desiredSalaryMax?: number;

  @Column({
    type: 'enum',
    enum: ProfileVisibility,
    default: ProfileVisibility.PUBLIC,
  })
  visibility: ProfileVisibility;

  @Column({ name: 'completion_percent', type: 'int', default: 0 })
  completionPercent: number;

  @Column({ name: 'allow_job_notifications', default: true })
  allowJobNotifications: boolean;

  @OneToMany(() => CV, (cv) => cv.candidateProfile)
  cvs?: CV[];

  @OneToMany(() => SavedJob, (savedJob) => savedJob.candidateProfile)
  savedJobs?: SavedJob[];

  @OneToMany(() => BlockedCompany, (blocked) => blocked.candidateProfile)
  blockedCompanies?: BlockedCompany[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
