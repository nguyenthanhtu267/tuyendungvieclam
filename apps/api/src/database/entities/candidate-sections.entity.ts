import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CandidateProfile } from './candidate-profile.entity';

// Đợt 8 — 8 bảng "danh sách" của hồ sơ 13 mục (CareerViet). Mỗi bảng thuộc về 1 CandidateProfile,
// xóa hồ sơ thì xóa theo (CASCADE).

export enum LanguageLevel {
  NATIVE = 'native', // Bản ngữ
  EXCELLENT = 'excellent', // Rất tốt
  GOOD = 'good', // Tốt
  FAIR = 'fair', // Khá
  BEGINNER = 'beginner', // Cơ bản
}

export enum SkillLevel {
  BEGINNER = 'beginner', // Cơ bản
  INTERMEDIATE = 'intermediate', // Trung bình
  ADVANCED = 'advanced', // Thành thạo
  EXPERT = 'expert', // Chuyên gia
}

@Entity({ name: 'candidate_experiences' })
export class CandidateExperience {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_profile_id' })
  candidateProfileId: string;

  @ManyToOne(() => CandidateProfile, (p) => p.experiences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Column()
  position: string;

  @Column({ name: 'company_name', nullable: true })
  companyName?: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate?: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate?: string;

  @Column({ name: 'is_current', default: false })
  isCurrent: boolean;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity({ name: 'candidate_educations' })
export class CandidateEducation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_profile_id' })
  candidateProfileId: string;

  @ManyToOne(() => CandidateProfile, (p) => p.educations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Column({ name: 'school_name', nullable: true })
  schoolName?: string;

  @Column({ nullable: true })
  degree?: string;

  @Column({ nullable: true })
  major?: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate?: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity({ name: 'candidate_certificates' })
export class CandidateCertificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_profile_id' })
  candidateProfileId: string;

  @ManyToOne(() => CandidateProfile, (p) => p.certificates, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Column()
  name: string;

  @Column({ nullable: true })
  issuer?: string;

  @Column({ name: 'issue_date', type: 'date', nullable: true })
  issueDate?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity({ name: 'candidate_languages' })
export class CandidateLanguage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_profile_id' })
  candidateProfileId: string;

  @ManyToOne(() => CandidateProfile, (p) => p.languages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Column()
  language: string;

  @Column({ type: 'enum', enum: LanguageLevel })
  level: LanguageLevel;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity({ name: 'candidate_skills' })
export class CandidateSkill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_profile_id' })
  candidateProfileId: string;

  @ManyToOne(() => CandidateProfile, (p) => p.skills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Column({ name: 'skill_name' })
  skillName: string;

  @Column({ type: 'enum', enum: SkillLevel })
  level: SkillLevel;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity({ name: 'candidate_achievements' })
export class CandidateAchievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_profile_id' })
  candidateProfileId: string;

  @ManyToOne(() => CandidateProfile, (p) => p.achievements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'date', nullable: true })
  date?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity({ name: 'candidate_activities' })
export class CandidateActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_profile_id' })
  candidateProfileId: string;

  @ManyToOne(() => CandidateProfile, (p) => p.activities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Column()
  title: string;

  @Column({ name: 'organization_name', nullable: true })
  organizationName?: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate?: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity({ name: 'candidate_references' })
export class CandidateReference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_profile_id' })
  candidateProfileId: string;

  @ManyToOne(() => CandidateProfile, (p) => p.references, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ nullable: true })
  position?: string;

  @Column({ nullable: true })
  company?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  email?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
