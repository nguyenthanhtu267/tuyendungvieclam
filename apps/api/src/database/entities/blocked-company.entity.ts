import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CandidateProfile } from './candidate-profile.entity';
import { Company } from './company.entity';

// Mới (quyết định 18/09/2026): ứng viên chặn công ty cụ thể không cho xem hồ sơ của mình,
// áp dụng song song với CandidateProfile.visibility.
@Entity({ name: 'blocked_companies' })
export class BlockedCompany {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_profile_id' })
  candidateProfileId: string;

  @ManyToOne(() => CandidateProfile, (profile) => profile.blockedCompanies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Column({ name: 'company_id', nullable: true })
  companyId?: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'company_id' })
  company?: Company;

  // Cho phép chặn theo tên tự do khi công ty đó chưa có tài khoản trong hệ thống
  @Column({ name: 'company_name_text', nullable: true })
  companyNameText?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
