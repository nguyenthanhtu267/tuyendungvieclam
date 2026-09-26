import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { CV } from './cv.entity';
import { SavedJob } from './saved-job.entity';
import { BlockedCompany } from './blocked-company.entity';
import {
  CandidateExperience,
  CandidateEducation,
  CandidateCertificate,
  CandidateLanguage,
  CandidateSkill,
  CandidateAchievement,
  CandidateActivity,
  CandidateReference,
} from './candidate-sections.entity';

export enum ProfileVisibility {
  LOCKED = 'locked', // Khoá
  PUBLIC = 'public', // Công khai
  URGENT = 'urgent', // Khẩn cấp
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum MaritalStatus {
  SINGLE = 'single',
  MARRIED = 'married',
  OTHER = 'other',
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

  @Index()
  @Column({ name: 'desired_level', nullable: true })
  desiredLevel?: string;

  @Column({ name: 'desired_salary_min', type: 'int', nullable: true })
  desiredSalaryMin?: number;

  @Column({ name: 'desired_salary_max', type: 'int', nullable: true })
  desiredSalaryMax?: number;

  // Đợt 12a (20/09/2026) — index cho các cột hay lọc trong cv-search.service.ts (tìm hồ sơ ứng
  // viên cho NTD), quan trọng khi dữ liệu tăng lên ~1029 hồ sơ theo đợt sinh dữ liệu ảo.
  @Index()
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

  // Đợt 8 — mở rộng hồ sơ 13 mục (theo CareerViet). ------------------------------------------
  @Column({ name: 'profile_title', nullable: true })
  profileTitle?: string;

  @Column({ name: 'last_name', nullable: true })
  lastName?: string;

  @Column({ name: 'first_name', nullable: true })
  firstName?: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth?: string;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender?: Gender;

  @Column({ nullable: true })
  phone?: string;

  @Column({ name: 'contact_email', nullable: true })
  contactEmail?: string;

  @Column({ nullable: true })
  nationality?: string;

  @Column({ name: 'marital_status', type: 'enum', enum: MaritalStatus, nullable: true })
  maritalStatus?: MaritalStatus;

  @Column({ nullable: true })
  country?: string;

  @Index()
  @Column({ nullable: true })
  province?: string;

  @Column({ nullable: true })
  district?: string;

  @Column({ nullable: true })
  address?: string;

  // Ảnh đại diện lưu trong CSDL (bytea) — cùng chiến lược file nhẹ với CV.entity.ts (đợt 7).
  @Column({ name: 'avatar_data', type: 'bytea', nullable: true, select: false })
  avatarData?: Buffer;

  @Column({ name: 'avatar_mime_type', nullable: true })
  avatarMimeType?: string;

  @Column({ name: 'career_objective', type: 'text', nullable: true })
  careerObjective?: string;

  @Column({ name: 'desired_industries', type: 'simple-array', nullable: true })
  desiredIndustries?: string[];

  @Column({ name: 'desired_locations', type: 'simple-array', nullable: true })
  desiredLocations?: string[];

  @Column({ name: 'desired_job_types', type: 'simple-array', nullable: true })
  desiredJobTypes?: string[];

  @Column({ name: 'salary_currency', default: 'VND' })
  salaryCurrency: string;

  @Index()
  @Column({ name: 'years_of_experience', type: 'int', nullable: true })
  yearsOfExperience?: number;

  @Column({ name: 'current_level', nullable: true })
  currentLevel?: string;

  @Index()
  @Column({ name: 'highest_degree', nullable: true })
  highestDegree?: string;

  // Ẩn thông tin liên hệ với NTD — được tôn trọng kể cả khi NTD đã trả điểm mở hồ sơ (đợt 9).
  @Column({ name: 'hide_contact_info', default: false })
  hideContactInfo: boolean;

  // Đợt 18c (26/09/2026) — "Hồ sơ nguồn tổng hợp" do Admin tạo (từ Kho CV của NTD, dán nội dung/link
  // hoặc file CV ngoài web). Là User + CandidateProfile thật (email giả, không ai đăng nhập được) để
  // dùng lại nguyên Tìm CV/mở khoá trừ điểm/ghi chú/mời ứng tuyển; NTD chỉ thấy nhãn "Nguồn tổng hợp",
  // KHÔNG thấy `source_label` (có thể chứa tên công ty gốc). `claimed_at` = người thật đã nhận lại.
  @Index()
  @Column({ name: 'is_admin_sourced', type: 'boolean', default: false })
  isAdminSourced: boolean;

  @Column({ name: 'source_label', type: 'varchar', nullable: true })
  sourceLabel?: string | null;

  @Column({ name: 'claimed_at', type: 'timestamp', nullable: true })
  claimedAt?: Date | null;

  @OneToMany(() => CV, (cv) => cv.candidateProfile)
  cvs?: CV[];

  @OneToMany(() => SavedJob, (savedJob) => savedJob.candidateProfile)
  savedJobs?: SavedJob[];

  @OneToMany(() => BlockedCompany, (blocked) => blocked.candidateProfile)
  blockedCompanies?: BlockedCompany[];

  @OneToMany(() => CandidateExperience, (r) => r.candidateProfile)
  experiences?: CandidateExperience[];

  @OneToMany(() => CandidateEducation, (r) => r.candidateProfile)
  educations?: CandidateEducation[];

  @OneToMany(() => CandidateCertificate, (r) => r.candidateProfile)
  certificates?: CandidateCertificate[];

  @OneToMany(() => CandidateLanguage, (r) => r.candidateProfile)
  languages?: CandidateLanguage[];

  @OneToMany(() => CandidateSkill, (r) => r.candidateProfile)
  skills?: CandidateSkill[];

  @OneToMany(() => CandidateAchievement, (r) => r.candidateProfile)
  achievements?: CandidateAchievement[];

  @OneToMany(() => CandidateActivity, (r) => r.candidateProfile)
  activities?: CandidateActivity[];

  @OneToMany(() => CandidateReference, (r) => r.candidateProfile)
  references?: CandidateReference[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
