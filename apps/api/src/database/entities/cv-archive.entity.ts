import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Company } from './company.entity';
import { Application } from './application.entity';
import type { ParsedCv } from '../../common/cv-parser.util';

// Đợt 18a (26/09/2026) — "Kho CV" của nhà tuyển dụng (theo yêu cầu người dùng: mọi CV ứng viên nộp
// đều tự động lưu lại TOÀN BỘ dữ liệu, phân loại thông minh, phục vụ tìm lại — và VẪN CÒN kể cả khi
// ứng viên xoá tài khoản). Lý do phải tách bảng riêng: chuỗi dữ liệu gốc users → candidate_profiles →
// cvs → applications đều nối CASCADE, xoá đầu chuỗi là NTD mất sạch đơn ứng tuyển.
//
// 2 bảng:
//  - `cv_archive_candidates`: 1 "thẻ" = 1 NGƯỜI trong kho của 1 công ty (gộp nhiều lần ứng tuyển của
//    cùng 1 người — nhận diện theo hồ sơ/email/SĐT, xem CvArchiveService.findCard()). CỐ Ý không có
//    khoá ngoại tới candidate_profiles (chỉ lưu id để tra "tài khoản còn hay đã xoá").
//  - `cv_archive_entries`: 1 dòng = 1 lần ứng tuyển, chứa bản chụp CỐ ĐỊNH toàn bộ hồ sơ 13 mục tại
//    thời điểm nộp + bản sao file CV. Khoá ngoại tới applications là ON DELETE SET NULL (NTD xoá vĩnh
//    viễn đơn / Admin xoá tin → vẫn giữ bản chụp).
// Chỉ nối CASCADE theo `companies` (công ty bị xoá thì kho của công ty đó không còn ý nghĩa).

@Entity({ name: 'cv_archive_candidates' })
export class CvArchiveCandidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  // Không khoá ngoại — xem ghi chú đầu file.
  @Index()
  @Column({ name: 'candidate_profile_id', type: 'uuid', nullable: true })
  candidateProfileId?: string | null;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', nullable: true })
  phone?: string | null;

  @Column({ type: 'varchar', nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', nullable: true })
  province?: string | null;

  // Tiêu đề hồ sơ hoặc vị trí mong muốn — dòng mô tả ngắn dưới tên trong danh sách.
  @Column({ type: 'varchar', nullable: true })
  headline?: string | null;

  @Column({ name: 'years_of_experience', type: 'int', nullable: true })
  yearsOfExperience?: number | null;

  @Column({ name: 'skills_text', type: 'text', nullable: true })
  skillsText?: string | null;

  // Toàn bộ chữ của hồ sơ + các vị trí đã ứng tuyển, đã bỏ dấu tiếng Việt + chữ thường — để tìm
  // kiếm "gõ không dấu vẫn ra" (VD "nguyen van a" khớp "Nguyễn Văn A"). Xem normalizeSearchText().
  @Column({ name: 'search_text', type: 'text', default: '' })
  searchText: string;

  @Column({ name: 'application_count', type: 'int', default: 0 })
  applicationCount: number;

  @Index()
  @Column({ name: 'last_applied_at', type: 'timestamp' })
  lastAppliedAt: Date;

  // Thùng rác của NTD (xoá mềm, khôi phục được — theo lựa chọn người dùng). Admin vẫn xem được.
  @Index()
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date | null;

  // Đợt 18c (26/09/2026) — "hàng chờ chia sẻ" của Admin: mỗi người trong Kho CV của 1 NTD có thể được
  // Admin duyệt (tay hoặc tự động sau 15 phút) để tạo HỒ SƠ NGUỒN TỔNG HỢP cho các NTD khác tìm thấy.
  // pending = chờ duyệt · shared = đã tạo hồ sơ tổng hợp (shared_profile_id) · already_public = ứng
  // viên đã tự công khai sẵn trong Tìm CV nên không cần bản sao · dismissed = Admin bỏ qua.
  @Index()
  @Column({ name: 'share_status', type: 'varchar', default: 'pending' })
  shareStatus: CvShareStatus;

  // Hồ sơ nguồn tổng hợp được tạo từ thẻ này. Tìm CV dùng cột này để ẨN bản sao với chính công ty gốc.
  @Index()
  @Column({ name: 'shared_profile_id', type: 'uuid', nullable: true })
  sharedProfileId?: string | null;

  @Column({ name: 'share_decided_at', type: 'timestamp', nullable: true })
  shareDecidedAt?: Date | null;

  @OneToMany(() => CvArchiveEntry, (e) => e.archiveCandidate)
  entries?: CvArchiveEntry[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity({ name: 'cv_archive_entries' })
export class CvArchiveEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'archive_candidate_id' })
  archiveCandidateId: string;

  @ManyToOne(() => CvArchiveCandidate, (c) => c.entries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'archive_candidate_id' })
  archiveCandidate: CvArchiveCandidate;

  @Index()
  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  // 1 đơn ứng tuyển ↔ tối đa 1 bản chụp (unique) — nhờ vậy phần "lưu bù" chạy lại bao nhiêu lần
  // cũng không tạo trùng.
  @Index({ unique: true })
  @Column({ name: 'application_id', type: 'uuid', nullable: true })
  applicationId?: string | null;

  @ManyToOne(() => Application, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'application_id' })
  application?: Application | null;

  // Không khoá ngoại — tin có thể bị xoá sau này, đã chép sẵn tên vị trí ở `job_title`.
  @Index()
  @Column({ name: 'job_posting_id', type: 'uuid', nullable: true })
  jobPostingId?: string | null;

  @Column({ name: 'job_title' })
  jobTitle: string;

  @Column({ name: 'applied_at', type: 'timestamp' })
  appliedAt: Date;

  @Column({ name: 'cover_letter', type: 'text', nullable: true })
  coverLetter?: string | null;

  // Bản chụp CỐ ĐỊNH toàn bộ hồ sơ 13 mục tại thời điểm nộp (xem CvArchiveSnapshot).
  @Column({ name: 'profile_snapshot', type: 'jsonb' })
  profileSnapshot: CvArchiveSnapshot;

  @Column({ name: 'cv_type', type: 'varchar', nullable: true })
  cvType?: string | null;

  @Column({ name: 'cv_file_name', type: 'varchar', nullable: true })
  cvFileName?: string | null;

  @Column({ name: 'cv_mime_type', type: 'varchar', nullable: true })
  cvMimeType?: string | null;

  // Bản sao nội dung file CV (≤2MB, cùng chiến lược lưu trong CSDL như cvs.file_data). `select:
  // false` để danh sách không tự tải cả file — chỉ lấy khi tải xuống.
  @Column({
    name: 'cv_file_data',
    type: 'bytea',
    nullable: true,
    select: false,
  })
  cvFileData?: Buffer | null;

  @Column({ name: 'cv_has_file', default: false })
  cvHasFile: boolean;

  @Column({ name: 'cv_external_link', type: 'varchar', nullable: true })
  cvExternalLink?: string | null;

  // Đợt 18b (26/09/2026) — chữ đọc được từ file CV (PDF/DOCX) hoặc nội dung NTD dán vào (18d), và
  // kết quả tách mục theo quy tắc. `cv_text_status`: ok / empty (ảnh scan, không có chữ) / unsupported
  // (.doc cũ, ảnh) / error; NULL = chưa đọc (phần "lưu bù" sẽ đọc).
  @Column({ name: 'cv_text', type: 'text', nullable: true, select: false })
  cvText?: string | null;

  @Column({ name: 'cv_parsed', type: 'jsonb', nullable: true })
  cvParsed?: ParsedCv | null;

  @Column({ name: 'cv_text_status', type: 'varchar', nullable: true })
  cvTextStatus?: string | null;

  // Đợt 18d — nguồn của bản ghi: 'application' (ứng viên tự nộp) hoặc 'employer_import' (NTD tự nhập
  // CV lấy từ nguồn ngoài vào kho).
  @Column({ name: 'entry_source', type: 'varchar', default: 'application' })
  entrySource: 'application' | 'employer_import';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

export type CvShareStatus =
  'pending' | 'shared' | 'already_public' | 'dismissed';

// Cấu trúc bản chụp hồ sơ lưu trong `profile_snapshot` (jsonb). Chỉ giữ các trường nội dung (bỏ id/
// thời điểm tạo của từng dòng), đủ để hiển thị lại đúng bố cục hồ sơ 13 mục.
export interface CvArchiveSnapshot {
  accountEmail?: string | null;
  fullName: string;
  lastName?: string | null;
  firstName?: string | null;
  profileTitle?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  phone?: string | null;
  contactEmail?: string | null;
  nationality?: string | null;
  maritalStatus?: string | null;
  country?: string | null;
  province?: string | null;
  district?: string | null;
  address?: string | null;
  careerObjective?: string | null;
  desiredPosition?: string | null;
  desiredLevel?: string | null;
  desiredSalaryMin?: number | null;
  desiredSalaryMax?: number | null;
  salaryCurrency?: string | null;
  desiredIndustries?: string[] | null;
  desiredLocations?: string[] | null;
  desiredJobTypes?: string[] | null;
  yearsOfExperience?: number | null;
  currentLevel?: string | null;
  highestDegree?: string | null;
  experiences: {
    position: string;
    companyName?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    isCurrent: boolean;
    description?: string | null;
  }[];
  educations: {
    schoolName?: string | null;
    degree?: string | null;
    major?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }[];
  certificates: {
    name: string;
    issuer?: string | null;
    issueDate?: string | null;
  }[];
  languages: { language: string; level: string }[];
  skills: { skillName: string; level: string }[];
  achievements: {
    title: string;
    description?: string | null;
    date?: string | null;
  }[];
  activities: {
    title: string;
    organizationName?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    description?: string | null;
  }[];
  references: {
    fullName: string;
    position?: string | null;
    company?: string | null;
    phone?: string | null;
    email?: string | null;
  }[];
}
