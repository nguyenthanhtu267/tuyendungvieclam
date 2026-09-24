import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { Company } from './company.entity';
import { CandidateProfile } from './candidate-profile.entity';

// Đợt 12ac (24/09/2026) — "Đợt 3": icon hành động của NTD ở trang Tìm hồ sơ (theo mẫu careerviet.vn:
// gắn thẻ ghi chú riêng + ẩn khỏi danh sách tìm kiếm của chính công ty đó). Ghi chú và trạng thái ẩn
// là RIÊNG của từng công ty với từng hồ sơ — ứng viên không thấy được nội dung này.
@Entity({ name: 'candidate_notes' })
@Unique(['companyId', 'candidateProfileId'])
export class CandidateNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'candidate_profile_id' })
  candidateProfileId: string;

  @ManyToOne(() => CandidateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ default: false })
  hidden: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
