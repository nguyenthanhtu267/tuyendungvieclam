import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CandidateProfile } from './candidate-profile.entity';

// Đợt 18c (26/09/2026) — yêu cầu "gỡ hồ sơ" / "nhận lại hồ sơ" do NGƯỜI THẬT gửi (trang công khai
// /yeu-cau-ho-so, không cần đăng nhập), khi phát hiện CV của mình được đăng thành hồ sơ nguồn tổng hợp
// (người dùng chọn phương án này, tương tự "Đây là công ty của bạn?" ở Đợt 17). Người gửi không nhìn
// thấy Tìm CV (chỉ NTD thấy) nên không gắn sẵn id hồ sơ — Admin đối chiếu (hệ thống tự gợi ý hồ sơ
// khớp theo email/SĐT) rồi xử lý.
@Entity({ name: 'candidate_profile_requests' })
export class CandidateProfileRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column()
  email: string;

  @Column({ type: 'varchar', nullable: true })
  phone?: string | null;

  // 'remove' = gỡ hồ sơ khỏi web · 'claim' = nhận lại để tự quản lý (chuyển thành tài khoản thật).
  @Column({ name: 'request_type', type: 'varchar' })
  requestType: 'remove' | 'claim';

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Index()
  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'resolved' | 'rejected';

  @Column({ name: 'resolved_profile_id', type: 'uuid', nullable: true })
  resolvedProfileId?: string | null;

  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt?: Date | null;
}

// Đợt 18f (26/09/2026) — nhãn + ghi chú NỘI BỘ của Admin cho từng ứng viên (chỉ Admin thấy, khác
// candidate_notes là ghi chú riêng của từng NTD).
@Entity({ name: 'admin_candidate_notes' })
export class AdminCandidateNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'candidate_profile_id' })
  candidateProfileId: string;

  @OneToOne(() => CandidateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[] | null;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ name: 'updated_by_email', type: 'varchar', nullable: true })
  updatedByEmail?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
