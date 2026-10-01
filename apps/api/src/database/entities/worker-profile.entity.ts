import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

// Đợt 79 — hồ sơ lao động phổ thông (công nhân / sinh viên làm thêm / thực tập sinh). Không bắt buộc
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

  @Column({ name: 'birth_date', type: 'date' })
  birthDate: string; // YYYY-MM-DD

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

  // Ứng viên tự bật/tắt "đang tìm việc"
  @Column({ name: 'is_seeking', default: true })
  isSeeking: boolean;

  // Admin ẩn hồ sơ vi phạm
  @Column({ name: 'is_hidden', default: false })
  isHidden: boolean;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

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
