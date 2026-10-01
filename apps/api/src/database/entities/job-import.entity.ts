import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

// Đợt 119 — "Hộp nhập tin từ link": Admin dán link tin tuyển dụng (từ email thông báo việc làm…), hệ thống đọc dữ
// liệu chuẩn (JSON-LD JobPosting), so khớp công ty rồi xếp vào hàng chờ để Admin XEM LẠI trước khi đăng — không tự đăng.
// status: pending = chờ Admin xem · published = đã đăng · owner_review = công ty đã có chủ thật, chờ Admin báo
//   · owner_notified = đã báo công ty, chờ họ nhận/bỏ qua · accepted = công ty đã nhận (thành tin của họ)
//   · skipped = bỏ qua · failed = không đọc được.
export type JobImportStatus = 'pending' | 'published' | 'owner_review' | 'owner_notified' | 'accepted' | 'skipped' | 'failed';

@Entity({ name: 'job_imports' })
export class JobImport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'source_url', type: 'text' })
  sourceUrl: string;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: JobImportStatus;

  // Dữ liệu đọc được từ trang nguồn (tiêu đề, mô tả, lương, địa điểm, tên/website/logo công ty…).
  @Column({ type: 'jsonb', default: () => "'{}'" })
  data: Record<string, unknown>;

  // Công ty khớp được trong hệ thống (nếu có) và cách khớp: name | website.
  @Index()
  @Column({ name: 'matched_company_id', type: 'uuid', nullable: true })
  matchedCompanyId?: string | null;

  @Column({ name: 'match_kind', type: 'varchar', length: 20, nullable: true })
  matchKind?: string | null;

  // true khi công ty khớp đã có chủ thật (không phải công ty nguồn ngoài, hoặc đã được nhận lại).
  @Column({ name: 'company_has_owner', default: false })
  companyHasOwner: boolean;

  @Column({ name: 'job_id', type: 'uuid', nullable: true })
  jobId?: string | null;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
