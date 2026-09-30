import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

// SRS Mục 10: dùng chung cho cả tìm CV (NTD) và tìm việc (ứng viên) — phân biệt qua ownerType.
@Entity({ name: 'search_histories' })
export class SearchHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_type' }) // 'company' | 'candidate_profile'
  ownerType: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ type: 'jsonb', nullable: true })
  criteria?: Record<string, unknown>;

  @Column({ name: 'result_count', type: 'int', default: 0 })
  resultCount: number;

  // Đợt 38 — cảnh báo việc mới cho tìm kiếm đã lưu (ứng viên bật/tắt); mốc gửi gần nhất để không báo trùng.
  @Column({ name: 'alert_enabled', type: 'boolean', default: true })
  alertEnabled: boolean;

  @Column({ name: 'last_alert_at', type: 'timestamp', nullable: true })
  lastAlertAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
