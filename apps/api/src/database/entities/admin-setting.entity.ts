import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

// Đợt 15 (25/09/2026) — "Tự động duyệt tin" (theo yêu cầu người dùng): 1 công tắc BẬT/TẮT CHUNG áp
// dụng cho mọi tin đang chờ duyệt (không phải bật riêng từng tin — người dùng chọn phương án này qua
// AskUserQuestion), nên chỉ cần 1 dòng CSDL duy nhất kiểu "singleton" thay vì 1 bảng cấu hình phức
// tạp. `id` luôn cố định = 'singleton' để findOne({ where: { id: 'singleton' } }) luôn ra đúng 1 dòng
// (tạo dòng này nếu chưa có — xem AdminService.getAutoApproveSetting()). Thiết kế dạng key-value đơn
// giản này (khác hẳn 1 cột boolean thẳng trên bảng khác) để dễ mở rộng thêm cờ cấu hình chung khác
// của Admin trong tương lai mà không cần thêm bảng mới mỗi lần.
@Entity({ name: 'admin_settings' })
export class AdminSetting {
  @PrimaryColumn()
  id: string;

  // Mặc định TẮT (theo lựa chọn người dùng qua AskUserQuestion) — Admin tự bấm bật khi muốn dùng,
  // tránh tin xấu/spam bị tự động duyệt ngay từ lúc mới triển khai tính năng này.
  @Column({ name: 'auto_approve_enabled', type: 'boolean', default: false })
  autoApproveEnabled: boolean;

  // Đợt 18c (26/09/2026) — công tắc chung "Tự động chia sẻ CV sau 15 phút" (cùng mô hình với "Tự động
  // duyệt tin"). CHỈ áp dụng cho CV nộp SAU thời điểm bật (`cv_auto_share_enabled_at`) để không "xả"
  // hàng nghìn CV cũ ra cùng lúc khi vừa bật — CV cũ Admin tự duyệt tay.
  // Đợt 120 — tự đọc email thông báo việc làm (xem admin/mail-scan.service.ts): công tắc, lần quét gần nhất, kết quả.
  @Column({ name: 'mail_scan_enabled', type: 'boolean', default: false })
  mailScanEnabled: boolean;

  // Các nhãn Gmail cần đọc (mảng JSON, vd ["Việc làm/CareerViet"]); trống thì dùng biến MAIL_LABEL hoặc INBOX.
  @Column({ name: 'mail_scan_labels', type: 'text', nullable: true })
  mailScanLabels?: string | null;

  @Column({ name: 'mail_scan_last_at', type: 'timestamp', nullable: true })
  mailScanLastAt?: Date | null;

  @Column({ name: 'mail_scan_last_result', type: 'text', nullable: true })
  mailScanLastResult?: string | null;

  @Column({ name: 'cv_auto_share_enabled', type: 'boolean', default: false })
  cvAutoShareEnabled: boolean;

  @Column({
    name: 'cv_auto_share_enabled_at',
    type: 'timestamp',
    nullable: true,
  })
  cvAutoShareEnabledAt?: Date | null;

  // Đợt 20 (27/09/2026) — lưu file lên Google Drive của chủ web. Mã làm mới (refresh token) được MÃ HOÁ
  // (AES-256-GCM, khoá suy ra từ JWT_SECRET) trước khi lưu — xem storage/file-storage.service.ts.
  @Column({ name: 'gdrive_refresh_token_enc', type: 'text', nullable: true })
  gdriveRefreshTokenEnc?: string | null;

  @Column({ name: 'gdrive_account_email', type: 'varchar', nullable: true })
  gdriveAccountEmail?: string | null;

  @Column({ name: 'gdrive_connected_at', type: 'timestamptz', nullable: true })
  gdriveConnectedAt?: Date | null;

  // id các thư mục trên Drive: { root, cv, archive, legal, avatar }.
  @Column({ name: 'gdrive_folders', type: 'jsonb', nullable: true })
  gdriveFolders?: Record<string, string> | null;

  @Column({ name: 'gdrive_last_error', type: 'text', nullable: true })
  gdriveLastError?: string | null;

  // Tạm dừng việc tự chuyển file cũ từ CSDL sang Drive.
  @Column({ name: 'storage_migration_paused', type: 'boolean', default: false })
  storageMigrationPaused: boolean;

  // Đợt 23 (29/09/2026) — nhãn quảng bá nhấp nháy cạnh logo trên header: bật/tắt, chữ hiển thị và link
  // (mở tab mới). Chỉ hiện ra ngoài khi BẬT và có link hợp lệ.
  @Column({ name: 'promo_badge_enabled', type: 'boolean', default: false })
  promoBadgeEnabled: boolean;

  @Column({
    name: 'promo_badge_text',
    type: 'varchar',
    default: 'Phần mềm Nhân sự Toàn diện',
  })
  promoBadgeText: string;

  @Column({ name: 'promo_badge_url', type: 'varchar', nullable: true })
  promoBadgeUrl?: string | null;

  // Đợt 24 (29/09/2026) — banner quảng cáo: công tắc chung + danh sách vùng đang tắt (mã vùng).
  @Column({ name: 'ads_enabled', type: 'boolean', default: true })
  adsEnabled: boolean;

  @Column({ name: 'ad_disabled_slots', type: 'jsonb', default: () => `'[]'` })
  adDisabledSlots: string[];

  // Đợt 29 (30/09/2026) — nền giao diện toàn website: 'fixed' (1 mẫu) hoặc 'auto' (tự đổi mỗi bg_auto_hours giờ).
  @Column({ name: 'bg_mode', type: 'varchar', default: 'auto' })
  bgMode: 'fixed' | 'auto';

  @Column({ name: 'bg_theme', type: 'varchar', default: 'neural-1' })
  bgTheme: string;

  // [] = xoay vòng cả 15 mẫu.
  @Column({ name: 'bg_auto_themes', type: 'jsonb', default: () => `'[]'` })
  bgAutoThemes: string[];

  @Column({ name: 'bg_auto_hours', type: 'int', default: 2 })
  bgAutoHours: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
