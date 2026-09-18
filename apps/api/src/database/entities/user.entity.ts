import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { CandidateProfile } from './candidate-profile.entity';
import { CompanyUser } from './company-user.entity';
import { Notification } from './notification.entity';

export enum UserRole {
  CANDIDATE = 'candidate',
  EMPLOYER_MAIN = 'employer_main',
  EMPLOYER_SUB = 'employer_sub',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

// SRS Mục 10: User — gốc cho cả ứng viên & NTD (1 User → 1 CandidateProfile và/hoặc 1 CompanyUser)
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  // Họ tên hiển thị — dùng cho tài khoản Nhà tuyển dụng (chính/phụ), vốn không có CandidateProfile
  // riêng để lấy fullName như bên ứng viên (bổ sung 18/09/2026, màn B5 "Tài khoản phụ").
  @Column({ name: 'full_name', nullable: true })
  fullName?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CANDIDATE })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ name: 'preferred_language', default: 'vi' })
  preferredLanguage: string;

  @OneToOne(() => CandidateProfile, (profile) => profile.user)
  candidateProfile?: CandidateProfile;

  @OneToMany(() => CompanyUser, (companyUser) => companyUser.user)
  companyUsers?: CompanyUser[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications?: Notification[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
