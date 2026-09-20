import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { JobPosting } from './job-posting.entity';
import { CV } from './cv.entity';

export enum ApplicationStatus {
  NEW = 'new', // Mới ứng tuyển
  REVIEWING = 'reviewing', // Đang xem xét
  SUITABLE = 'suitable', // Phù hợp
  REJECTED = 'rejected', // Từ chối
  INTERVIEW = 'interview', // Mời phỏng vấn
}

// Đợt 12a (20/09/2026) — index cho các truy vấn hay dùng ở employer.service.ts (listApplicants,
// listTrashedApplicants, listFolders) và applications.service.ts (listOwn). Composite
// (job_posting_id, status) khớp đúng tổ hợp lọc phổ biến nhất khi NTD xem ứng viên theo tin.
@Index(['jobPostingId', 'status'])
@Entity({ name: 'applications' })
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'job_posting_id' })
  jobPostingId: string;

  @ManyToOne(() => JobPosting, (jobPosting) => jobPosting.applications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_posting_id' })
  jobPosting: JobPosting;

  @Index()
  @Column({ name: 'cv_id' })
  cvId: string;

  @ManyToOne(() => CV, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cv_id' })
  cv: CV;

  @Index()
  @Column({ type: 'enum', enum: ApplicationStatus, default: ApplicationStatus.NEW })
  status: ApplicationStatus;

  @Column({ name: 'cover_letter', type: 'text', nullable: true })
  coverLetter?: string;

  // Đợt 11b — Mục #4 nâng cấp ATS: đánh giá sao (1-5) và thư mục hồ sơ (chữ tự do NTD đặt, ví dụ
  // "Ứng viên tiềm năng", "Vòng 2" — không dùng bảng riêng để giữ đơn giản, danh sách thư mục đang
  // dùng lấy qua DISTINCT trong service).
  @Index()
  @Column({ type: 'smallint', nullable: true })
  rating?: number;

  @Index()
  @Column({ nullable: true })
  folder?: string;

  // Thùng rác/khôi phục (mục #4): TypeORM soft-delete — repo.softDelete()/.restore() chỉ set/xoá cột
  // này, find()/createQueryBuilder() mặc định lọc bỏ bản ghi đã xoá mềm trừ khi gọi .withDeleted().
  @Index()
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @CreateDateColumn({ name: 'applied_at' })
  appliedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
