import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// Đợt 65 — báo cáo tin tuyển dụng từ người dùng (lừa đảo, trùng, hết hạn, sai thông tin...). Phân loại tự động theo từ khoá.
@Entity({ name: 'job_reports' })
@Index('IDX_job_reports_job', ['jobPostingId'])
export class JobReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'job_posting_id', type: 'uuid' })
  jobPostingId: string;

  @Column({ name: 'reporter_user_id', type: 'uuid', nullable: true })
  reporterUserId?: string | null;

  @Column({ type: 'varchar', length: 40 })
  reason: string; // scam | duplicate | expired | wrong_info | discrimination | other

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  // Nhóm do hệ thống tự phân loại từ lý do + nội dung ghi chú
  @Column({ type: 'varchar', length: 40 })
  category: string;

  @Column({ type: 'varchar', length: 10, default: 'normal' })
  priority: string; // high | normal

  @Column({ type: 'varchar', length: 10, default: 'open' })
  status: string; // open | resolved

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
