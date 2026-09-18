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

  @Column({ name: 'external_link_url', nullable: true })
  externalLinkUrl?: string;

  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
