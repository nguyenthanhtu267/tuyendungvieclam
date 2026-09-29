import {
  Entity,
  PrimaryGeneratedColumn,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

// Đợt 24 (29/09/2026) — hệ thống banner quảng cáo. 1 "chiến dịch" = 1 mẫu banner (chữ + nền + link) chạy trên
// 1 hoặc nhiều "vùng" (khu vực đặt banner, xem ads/ad-slots.ts). Nhiều chiến dịch cùng vùng thì xoay vòng
// theo trọng số. Nền có 2 kiểu: 'generated' (trình duyệt tự dựng nền từ câu mô tả + số mẫu `bg_seed` —
// không tốn phí, không cần ảnh) hoặc 'image' (Admin tải ảnh lên, lưu Google Drive/CSDL như các file khác).
@Entity({ name: 'ad_campaigns' })
export class AdCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Tên nội bộ / chủ đề (chỉ Admin thấy) — VD "Phần mềm nhân sự – tháng 10".
  @Column({ type: 'varchar', length: 120 })
  name: string;

  // Nhãn nhỏ phía trên tiêu đề (VD "Mới ra mắt").
  @Column({ type: 'varchar', length: 40, nullable: true })
  eyebrow?: string | null;

  @Column({ type: 'varchar', length: 90 })
  title: string;

  @Column({ type: 'varchar', length: 180, nullable: true })
  subtitle?: string | null;

  @Column({ name: 'cta_text', type: 'varchar', length: 30, nullable: true })
  ctaText?: string | null;

  // http(s)://… (mở tab mới) hoặc đường dẫn nội bộ bắt đầu bằng "/" (mở ngay trong trang).
  @Column({ type: 'varchar', length: 1000 })
  url: string;

  // Tự gắn utm_source/utm_medium/utm_campaign/utm_content cho link ngoài (đo hiệu quả ở trang đích).
  @Column({ name: 'add_utm', type: 'boolean', default: true })
  addUtm: boolean;

  @Column({ name: 'bg_mode', type: 'varchar', default: 'generated' })
  bgMode: 'generated' | 'image';

  // Câu mô tả nền (VD "phần mềm nhân sự, hiện đại, tin cậy") — dùng để chọn bảng màu + hoạ tiết.
  @Column({ name: 'bg_prompt', type: 'varchar', length: 300, default: '' })
  bgPrompt: string;

  // Chủ động chọn bảng màu (bỏ trống = tự đoán từ mô tả).
  @Column({ name: 'bg_theme', type: 'varchar', nullable: true })
  bgTheme?: string | null;

  // "Tạo mẫu khác" = tăng số này → hoạ tiết/góc chuyển màu khác nhưng vẫn cùng tinh thần mô tả.
  @Column({ name: 'bg_seed', type: 'int', default: 0 })
  bgSeed: number;

  @Column({
    name: 'bg_image_data',
    type: 'bytea',
    nullable: true,
    select: false,
  })
  bgImageData?: Buffer | null;

  @Column({ name: 'bg_image_key', type: 'varchar', nullable: true })
  bgImageKey?: string | null;

  @Column({ name: 'bg_image_mime', type: 'varchar', nullable: true })
  bgImageMime?: string | null;

  // Độ sáng trung bình ảnh (trình duyệt Admin đo lúc tải lên): 'light' → chữ tối, 'dark' → chữ trắng.
  @Column({ name: 'bg_image_tone', type: 'varchar', nullable: true })
  bgImageTone?: 'light' | 'dark' | null;

  // 'auto' = tự chọn màu chữ tương phản với nền; 'light' = chữ trắng; 'dark' = chữ tối.
  @Column({ name: 'text_color', type: 'varchar', default: 'auto' })
  textColor: 'auto' | 'light' | 'dark';

  // ["*"] = mọi vùng; ngược lại là danh sách mã vùng.
  @Column({ type: 'jsonb', default: () => `'["*"]'` })
  slots: string[];

  // [] = mọi người; ngược lại: 'guest' | 'candidate' | 'employer'.
  @Column({ type: 'jsonb', default: () => `'[]'` })
  audiences: string[];

  @Column({ type: 'varchar', default: 'all' })
  device: 'all' | 'desktop' | 'mobile';

  // 1–10: cùng vùng có nhiều chiến dịch thì chiến dịch trọng số cao hiện nhiều hơn.
  @Column({ type: 'int', default: 5 })
  weight: number;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt?: Date | null;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt?: Date | null;

  @Index()
  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

// Số lượt hiển thị / bấm theo ngày (giờ Việt Nam) × chiến dịch × vùng — cộng dồn bằng UPSERT.
@Entity({ name: 'ad_campaign_stats' })
export class AdCampaignStat {
  @PrimaryColumn({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @ManyToOne(() => AdCampaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign?: AdCampaign;

  @PrimaryColumn({ type: 'varchar' })
  slot: string;

  @PrimaryColumn({ type: 'date' })
  day: string;

  @Column({ type: 'int', default: 0 })
  impressions: number;

  @Column({ type: 'int', default: 0 })
  clicks: number;
}
