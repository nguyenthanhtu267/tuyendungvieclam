import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Company } from './company.entity';
import { CandidateProfile } from './candidate-profile.entity';
import { User } from './user.entity';
import { Order } from './order.entity';

// Đợt 9 — ghi nhận "mở khóa" hồ sơ ứng viên: 1 công ty mở 1 hồ sơ chỉ trừ điểm 1 lần duy nhất,
// xem lại về sau miễn phí vĩnh viễn (theo quyết định đã chốt). Ràng buộc duy nhất (company, profile).
@Entity({ name: 'unlocked_profiles' })
@Unique(['companyId', 'candidateProfileId'])
export class UnlockedProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ name: 'unlocked_by_user_id' })
  unlockedByUserId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'unlocked_by_user_id' })
  unlockedByUser?: User;

  // Đơn hàng bị trừ 1 điểm để mở hồ sơ này — giữ lại để tra soát/đối chiếu về sau.
  @Column({ name: 'order_id', nullable: true })
  orderId?: string;

  @ManyToOne(() => Order, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'order_id' })
  order?: Order;

  @CreateDateColumn({ name: 'unlocked_at' })
  unlockedAt: Date;
}
