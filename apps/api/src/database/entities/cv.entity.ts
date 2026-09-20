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

export enum CvType {
  TEMPLATE = 'template', // dựng bằng CV builder online
  UPLOAD = 'upload', // tệp đính kèm
}

// SRS Mục 10 (đã cập nhật 18/09/2026): CV — file_url cho tệp nhẹ (<=2MB, lưu ở Cloudflare R2),
// externalLinkUrl cho link Google Drive khi vượt ngưỡng. Hồ sơ đính kèm đơn giản hoá — không có
// trạng thái Khoá/Kích hoạt hay lượt xem riêng từng tệp.
@Entity({ name: 'cvs' })
export class CV {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_profile_id' })
  candidateProfileId: string;

  @ManyToOne(() => CandidateProfile, (profile) => profile.cvs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Column({ type: 'enum', enum: CvType, default: CvType.TEMPLATE })
  type: CvType;

  @Column({ name: 'file_url', nullable: true })
  fileUrl?: string;

  @Column({ name: 'original_file_name', nullable: true })
  originalFileName?: string;

  // Nội dung tệp lưu trực tiếp trong CSDL (thay vì ổ đĩa máy chủ) — để không bị mất khi triển khai
  // lên máy chủ miễn phí (không có ổ đĩa cố định). Tệp đã giới hạn ≤2MB nên phù hợp lưu dạng bytea.
  // `select: false` để không tự động tải theo mỗi lần truy vấn danh sách CV — chỉ lấy khi tải xuống.
  @Column({ name: 'file_data', type: 'bytea', nullable: true, select: false })
  fileData?: Buffer;

  @Column({ name: 'file_mime_type', nullable: true })
  fileMimeType?: string;

  @Column({ name: 'external_link_url', nullable: true })
  externalLinkUrl?: string;

  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
