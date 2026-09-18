import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
