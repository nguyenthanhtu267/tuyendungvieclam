import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { CandidateProfile } from './candidate-profile.entity';
import { Company } from './company.entity';

// Đợt 12ab (24/09/2026) — "Theo dõi công ty": nút "+ Theo dõi" ở trang chi tiết tin (trước đó chỉ là
// nút tĩnh chưa nối chức năng) + trang công ty /cong-ty/[id]. Ứng viên theo dõi công ty để xem lại ở
// mục "Nhà tuyển dụng của tôi" (ho-so/page.tsx) — không gửi thông báo tự động ở bản này.
@Entity({ name: 'company_follows' })
@Unique(['candidateProfileId', 'companyId'])
export class CompanyFollow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_profile_id' })
  candidateProfileId: string;

  @ManyToOne(() => CandidateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Index()
  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
