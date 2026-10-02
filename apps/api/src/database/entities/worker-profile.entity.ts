import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

// Đợt 79 — hồ sơ lao động phổ thông (công nhân / sinh viên / thực tập sinh). Không bắt buộc
// tài khoản: khoá theo SĐT cá nhân, xác minh bằng ngày sinh khi xem/sửa/làm mới hồ sơ cũ.
export type WorkerKind = 'worker' | 'student' | 'intern';

@Entity({ name: 'worker_profiles' })
@Index('IDX_worker_profiles_province', ['province'])
@Index('IDX_worker_profiles_refreshed', ['refreshedAt'])
export class WorkerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10, default: 'worker' })
  kind: WorkerKind;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName: string;

  @Index('UQ_worker_profiles_phone', { unique: true })
  @Column({ type: 'varchar', length: 15 })
  phone: string;

  @Column({ name: 'relative_phone', type: 'varchar', length: 15, nullable: true })
  relativePhone?: string | null;

  @Column({ type: 'varchar', length: 6 })
  gender: string; // male | female | other

  // Đợt 136 — hồ sơ nguồn tổng hợp có thể chỉ biết năm sinh (hoặc không biết) nên cho phép trống.
  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: string; // YYYY-MM-DD

  @Column({ name: 'birth_year', type: 'int', nullable: true })
  birthYear?: number | null;

  // Tỉnh theo danh mục 63 tỉnh của web (khớp bộ lọc tin tuyển dụng)
  @Column({ type: 'varchar', length: 60 })
  province: string;

  @Column({ name: 'address_mode', type: 'varchar', length: 3, default: 'old' })
  addressMode: 'old' | 'new';

  @Column({ name: 'old_district', type: 'varchar', length: 120, nullable: true })
  oldDistrict?: string | null;

  @Column({ name: 'old_ward', type: 'varchar', length: 120, nullable: true })
  oldWard?: string | null;

  // Luôn quy về mã phường/xã mới (kể cả khi chọn địa chỉ cũ) để so khoảng cách thống nhất
  @Column({ name: 'new_ward_code', type: 'varchar', length: 10, nullable: true })
  newWardCode?: string | null;

  @Column({ name: 'new_ward', type: 'varchar', length: 120, nullable: true })
  newWard?: string | null;

  @Column({ name: 'address_detail', type: 'varchar', length: 200, nullable: true })
  addressDetail?: string | null;

  @Column({ type: 'double precision', nullable: true })
  lat?: number | null;

  @Column({ type: 'double precision', nullable: true })
  lon?: number | null;

  @Column({ name: 'radius_km', type: 'int', nullable: true })
  radiusKm?: number | null;

  @Column({ name: 'desired_jobs', type: 'simple-array', nullable: true })
  desiredJobs?: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  shifts?: string[] | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  school?: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  major?: string | null;

  // Đợt 80 — lịch rảnh (SV): mã "t2-sang", "t7-toi"…
  @Column({ type: 'simple-array', nullable: true })
  availability?: string[] | null;

  @Column({ name: 'needs_housing', default: false })
  needsHousing: boolean;

  @Column({ name: 'needs_shuttle', default: false })
  needsShuttle: boolean;

  // Đợt 83 — chế độ mùa thi: pause (ẩn tới ngày) | weekend (chỉ nhận ca cuối tuần)
  @Column({ name: 'exam_until', type: 'date', nullable: true })
  examUntil?: string | null;

  @Column({ name: 'exam_mode', type: 'varchar', length: 10, nullable: true })
  examMode?: string | null;

  // Đợt 84 — thông tin riêng theo nhóm: readyNow, availableFrom, experience, hasBike, hasHealthCert, certs, hoursPerWeek, internMonths, internDays, internMode, year
  @Column({ name: 'profile_extra', type: 'jsonb', nullable: true })
  extra?: import('../../workers/labor-extra').ProfileExtra | null;

  // Ứng viên tự bật/tắt "đang tìm việc"
  @Column({ name: 'is_seeking', default: true })
  isSeeking: boolean;

  // Admin ẩn hồ sơ vi phạm
  @Column({ name: 'is_hidden', default: false })
  isHidden: boolean;

  // Đợt 135 — thẻ + ghi chú nội bộ của Admin (giống hồ sơ văn phòng); người lao động và NTD không thấy.
  @Column({ name: 'admin_tags', type: 'text', array: true, nullable: true })
  adminTags?: string[] | null;

  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote?: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  // Đợt 136 — hồ sơ do Admin / NTD thu thập (không phải người lao động tự điền). Nhãn công khai "Nguồn tổng hợp".
  @Column({ name: 'is_sourced', default: false })
  isSourced: boolean;

  // Nguồn nội bộ (Zalo/Facebook/Excel/NTD…) — chỉ Admin thấy
  @Column({ name: 'source_label', type: 'varchar', length: 120, nullable: true })
  sourceLabel?: string | null;

  @Column({ name: 'claimed_at', type: 'timestamp', nullable: true })
  claimedAt?: Date | null;

  // Hồ sơ NTD tự nhập: chỉ công ty này thấy cho tới khi Admin chia sẻ (share_status = shared)
  @Column({ name: 'owner_company_id', type: 'uuid', nullable: true })
  ownerCompanyId?: string | null;

  // pending (chờ duyệt) | shared | dismissed — chỉ dùng cho hồ sơ có owner_company_id
  @Column({ name: 'share_status', type: 'varchar', length: 10, nullable: true })
  shareStatus?: string | null;

  @Column({ name: 'shared_at', type: 'timestamp', nullable: true })
  sharedAt?: Date | null;

  // Mốc "làm mới" để NTD biết thông tin còn mới — sắp xếp theo mốc này
  @Column({ name: 'refreshed_at', type: 'timestamp', default: () => 'now()' })
  refreshedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

// Ghi chú của NTD về ứng viên (vd "Đã có việc làm"). NTD khác chỉ thấy nội dung + thời gian, không thấy công ty.
@Entity({ name: 'worker_notes' })
@Index('IDX_worker_notes_profile', ['profileId'])
export class WorkerNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profile_id', type: 'uuid' })
  profileId: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId?: string | null;

  @Column({ name: 'author_user_id', type: 'uuid' })
  authorUserId: string;

  @Column({ type: 'varchar', length: 10, default: 'note' })
  kind: string; // hired | note

  @Column({ type: 'varchar', length: 200 })
  text: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

// Ứng tuyển nhanh của lao động phổ thông vào tin kênh riêng (không cần CV).
@Entity({ name: 'worker_applications' })
@Index('UQ_worker_app', ['profileId', 'jobPostingId'], { unique: true })
export class WorkerApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profile_id', type: 'uuid' })
  profileId: string;

  @Column({ name: 'job_posting_id', type: 'uuid' })
  jobPostingId: string;

  @Column({ name: 'seen_at', type: 'timestamp', nullable: true })
  seenAt?: Date | null;

  // Đợt 80 — new | no_answer | callback | interview | hired | rejected
  @Column({ type: 'varchar', length: 12, default: 'new' })
  status: string;

  // Đợt 80 — "rủ bạn đi làm cùng": cùng mã nhóm = cùng một nhóm ứng tuyển
  @Column({ name: 'group_code', type: 'varchar', length: 10, nullable: true })
  groupCode?: string | null;

  // Đợt 83 — hẹn phỏng vấn (đơn lẻ hoặc theo nhóm) và điểm danh ngày đầu đi làm
  @Column({ name: 'interview_at', type: 'timestamp', nullable: true })
  interviewAt?: Date | null;

  @Column({ name: 'interview_place', type: 'varchar', length: 200, nullable: true })
  interviewPlace?: string | null;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt?: Date | null;

  // Đợt 84 — thực tập sinh xin nhà tuyển dụng xác nhận / phiếu nhận xét
  @Column({ name: 'cert_requested_at', type: 'timestamp', nullable: true })
  certRequestedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

// Đợt 80 — sổ gọi điện của từng công ty với ứng viên phổ thông (riêng công ty đó thấy trạng thái chi tiết).
@Entity({ name: 'worker_contacts' })
@Index('UQ_worker_contact', ['companyId', 'profileId'], { unique: true })
@Index('IDX_worker_contacts_profile', ['profileId'])
export class WorkerContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ name: 'profile_id', type: 'uuid' })
  profileId: string;

  @Column({ name: 'author_user_id', type: 'uuid' })
  authorUserId: string;

  // no_answer | callback | interview | hired | rejected
  @Column({ type: 'varchar', length: 12 })
  status: string;

  @Column({ name: 'job_posting_id', type: 'uuid', nullable: true })
  jobPostingId?: string | null;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}

// Đợt 136 — nhật ký NTD bấm "Xem số" trên hồ sơ nguồn tổng hợp (giới hạn lượt/ngày/công ty).
@Entity({ name: 'worker_phone_views' })
@Index('IDX_worker_phone_views_company', ['companyId', 'viewedAt'])
export class WorkerPhoneView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ name: 'profile_id', type: 'uuid' })
  profileId: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @CreateDateColumn({ name: 'viewed_at' })
  viewedAt: Date;
}
