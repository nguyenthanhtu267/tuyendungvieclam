import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Company } from './company.entity';
import { Application } from './application.entity';
import { SavedJob } from './saved-job.entity';

export enum JobApprovalStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

// Đợt 12a (20/09/2026) — đánh index cho các cột hay lọc/sắp xếp trong jobs.service.ts baseQuery()/
// applyFilters(), quan trọng khi dữ liệu tăng lên quy mô lớn (~1245 tin theo đợt sinh dữ liệu ảo).
// Composite (approval_status, is_paused) khớp đúng điều kiện WHERE luôn đi cùng nhau ở baseQuery().
@Index(['approvalStatus', 'isPaused'])
@Entity({ name: 'job_postings' })
export class JobPosting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.jobPostings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column()
  title: string;

  @Index()
  @Column({ nullable: true })
  industry?: string;

  @Column({ nullable: true })
  location?: string;

  // Đợt 10 — nhiều tỉnh/thành cho 1 tin (hiển thị "Hồ Chí Minh | Đà Nẵng" trên thẻ việc làm), dùng
  // cho popover lọc "Tỉnh, Thành Phố". `location` giữ lại để tương thích ngược các tin đợt 7.
  @Column({ type: 'simple-array', nullable: true })
  provinces?: string[];

  @Index()
  @Column({ nullable: true })
  district?: string;

  // Đợt 10 — khoảng kinh nghiệm yêu cầu theo danh mục cố định (claude/06-spec-tim-kiem-nang-cao.md
  // mục 2), lưu nguyên nhãn để lọc khớp chính xác thay vì suy luận từ số năm.
  @Index()
  @Column({ name: 'experience_level', nullable: true })
  experienceLevel?: string;

  // Đợt 10 — "Việc làm khẩn cấp" (nhãn đỏ, ưu tiên hiển thị) — nhà tuyển dụng tự đánh dấu khi đăng tin.
  @Column({ name: 'is_urgent', default: false })
  isUrgent: boolean;

  // Đợt 11b — NTD tự tạm ngưng tin đang đăng (không hiện trong tìm kiếm việc làm công khai nữa)
  // mà không cần Admin duyệt lại; "đăng lại" chỉ đặt lại cờ này. Trạng thái hiển thị cho NTD (4 tab:
  // đang đăng/chờ đăng/tạm ngưng/hết hạn) được tính từ approvalStatus + isPaused + deadline, xem
  // computeEmployerStatus() trong employer.service.ts — không thêm enum riêng để tránh trùng lặp với
  // approvalStatus (vốn là trạng thái duyệt của Admin, khác khái niệm).
  @Column({ name: 'is_paused', default: false })
  isPaused: boolean;

  @Column({ name: 'salary_min', type: 'int', nullable: true })
  salaryMin?: number;

  @Column({ name: 'salary_max', type: 'int', nullable: true })
  salaryMax?: number;

  @Index()
  @Column({ name: 'employment_type', nullable: true })
  employmentType?: string;

  @Index()
  @Column({ nullable: true })
  level?: string;

  @Column({ name: 'headcount', type: 'int', default: 1 })
  headcount: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  requirements?: string;

  @Column({ type: 'simple-array', nullable: true })
  benefits?: string[];

  @Column({ name: 'banner_image_url', nullable: true })
  bannerImageUrl?: string;

  @Column({ name: 'banner_image_external_link', nullable: true })
  bannerImageExternalLink?: string;

  @Index()
  @Column({ name: 'deadline', type: 'date', nullable: true })
  deadline?: string;

  // Đợt 12k (21/09/2026) — bổ sung khối "Địa điểm làm việc" (địa chỉ chi tiết) và "Thông tin khác"
  // (Giới tính, Độ tuổi, Thời gian làm việc) trên trang chi tiết tin, theo mẫu careerviet.vn. Tất cả
  // đều không bắt buộc — tin cũ (chưa có dữ liệu) sẽ hiện giá trị mặc định ở phía frontend, không ghi
  // đè giá trị mặc định vào CSDL (xem jobDetailDefaults() trong lib/format.ts).
  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  gender?: string;

  @Column({ name: 'age_range', nullable: true })
  ageRange?: string;

  @Column({ name: 'work_schedule', nullable: true })
  workSchedule?: string;

  // Đợt 12v (21/09/2026) — "JOB TAGS / SKILLS": thẻ từ khoá/kỹ năng NTD tự nhập tự do khi đăng tin
  // (VD "Tiktokshop Specialist", "Admin E-commerce"), hiển thị dạng chip dưới khối "Thông tin khác"
  // ở trang chi tiết tin (theo ảnh mẫu người dùng gửi) — khác `industry` (1 ngành nghề chọn từ danh
  // mục cố định) và `benefits` (phúc lợi chọn từ danh mục cố định).
  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({
    type: 'enum',
    enum: JobApprovalStatus,
    default: JobApprovalStatus.DRAFT,
    name: 'approval_status',
  })
  approvalStatus: JobApprovalStatus;

  @OneToMany(() => Application, (application) => application.jobPosting)
  applications?: Application[];

  @OneToMany(() => SavedJob, (savedJob) => savedJob.jobPosting)
  savedByCandidates?: SavedJob[];

  // Đợt 12p (21/09/2026) — Batch 4 mục #1: đếm lượt xem trang chi tiết tin (chỉ tăng khi ứng viên
  // xem qua trang công khai /viec-lam/[id] → jobs.service.ts findOne(), KHÔNG tăng khi NTD tự xem
  // trước tin của mình ở /nha-tuyen-dung/xem-tin/[id] vì trang đó dùng employer.service.ts getJob()
  // riêng). Dùng cho thống kê "Lượt xem" + "Tỷ lệ chuyển đổi" (hồ sơ/lượt xem) ở trang Tin đăng NTD.
  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount: number;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
