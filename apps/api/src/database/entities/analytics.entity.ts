import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Đợt 19 (26/09/2026) — "Phân tích truy cập THẬT" cho Admin (theo yêu cầu người dùng: số view thật,
// thời gian ở lại, click chuột thật... "trong admin toàn bộ là dữ liệu thật hoàn toàn").
//
// Nguyên tắc (người dùng chọn qua AskUserQuestion):
//  - Nhận diện bằng MÃ ẨN DANH theo trình duyệt (visitor_id), KHÔNG lưu IP. Người đã đăng nhập gắn
//    thêm user_id + vai trò lúc đó.
//  - Không ghi Admin/Điều phối viên, không ghi lúc Admin "Đăng nhập thay", không ghi bot (bot đếm
//    riêng ở analytics_bot_hits).
//  - Dữ liệu chi tiết (sessions/pageviews/events) giữ 90 ngày rồi tự xoá; số tổng hợp theo ngày
//    (analytics_daily, analytics_bot_hits) giữ vĩnh viễn — xem AnalyticsRollupService.
//  - Mọi mốc thời gian dùng timestamptz (tuyệt đối) để chia ngày theo giờ Việt Nam chính xác bất kể
//    múi giờ của máy chủ (Render chạy UTC).

// 1 phiên truy cập = chuỗi trang liên tục của 1 trình duyệt, hết hạn sau 30 phút không hoạt động.
@Entity({ name: 'analytics_sessions' })
@Index('IDX_analytics_sessions_started_at', ['startedAt'])
@Index('IDX_analytics_sessions_visitor_id', ['visitorId'])
@Index('IDX_analytics_sessions_last_seen_at', ['lastSeenAt'])
export class AnalyticsSession {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'visitor_id', type: 'varchar', length: 64 })
  visitorId: string;

  // Người dùng đã đăng nhập (null = khách). Vai trò lúc đó: candidate / employer / guest.
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'guest' })
  role: string;

  @Column({ name: 'is_new_visitor', type: 'boolean', default: true })
  isNewVisitor: boolean;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt: Date;

  @Column({
    name: 'landing_path',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  landingPath?: string | null;

  @Column({
    name: 'referrer_host',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  referrerHost?: string | null;

  // Nguồn hiển thị (Google, Facebook, Zalo, Trực tiếp, <utm_source>...) + nhóm kênh
  // (search / social / messaging / referral / direct / campaign).
  @Column({ type: 'varchar', length: 100, default: 'Trực tiếp' })
  source: string;

  @Column({ type: 'varchar', length: 20, default: 'direct' })
  channel: string;

  @Column({ name: 'utm_source', type: 'varchar', length: 100, nullable: true })
  utmSource?: string | null;

  @Column({ name: 'utm_medium', type: 'varchar', length: 100, nullable: true })
  utmMedium?: string | null;

  @Column({
    name: 'utm_campaign',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  utmCampaign?: string | null;

  @Column({ type: 'varchar', length: 10, default: 'desktop' })
  device: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  browser?: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  os?: string | null;

  @Column({ name: 'screen_w', type: 'int', nullable: true })
  screenW?: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  lang?: string | null;

  // Ước lượng vị trí theo header địa lý của Vercel lúc bắt đầu phiên (không lưu IP).
  @Column({ type: 'varchar', length: 8, nullable: true })
  country?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string | null;
}

// 1 lượt xem trang. id do trình duyệt tạo để cập nhật dần thời gian ở lại / độ cuộn.
@Entity({ name: 'analytics_pageviews' })
@Index('IDX_analytics_pageviews_started_at', ['startedAt'])
@Index('IDX_analytics_pageviews_session_id', ['sessionId'])
@Index('IDX_analytics_pageviews_entity', ['entityType', 'entityId'])
export class AnalyticsPageview {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ name: 'visitor_id', type: 'varchar', length: 64 })
  visitorId: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'guest' })
  role: string;

  // Đường dẫn thật (không kèm query) + mẫu trang (thay id bằng [id]) để gộp thống kê theo loại trang.
  @Column({ type: 'varchar', length: 300 })
  path: string;

  @Column({ type: 'varchar', length: 200 })
  route: string;

  // job / company / candidate / cv_archive ... khi trang gắn với 1 đối tượng cụ thể.
  @Column({ name: 'entity_type', type: 'varchar', length: 20, nullable: true })
  entityType?: string | null;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId?: string | null;

  // Trang (mẫu) ngay trước đó trong cùng phiên — dùng để vẽ "đường đi" phổ biến.
  @Column({ name: 'prev_route', type: 'varchar', length: 200, nullable: true })
  prevRoute?: string | null;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  // Thời gian ở lại THẬT: chỉ tính lúc tab đang hiển thị và người dùng còn tương tác (dừng đếm sau
  // 3 phút không cuộn/chạm/gõ), tối đa 30 phút/lượt.
  @Column({ name: 'duration_ms', type: 'int', default: 0 })
  durationMs: number;

  @Column({ name: 'max_scroll', type: 'smallint', default: 0 })
  maxScroll: number;

  @Column({ type: 'varchar', length: 10, default: 'desktop' })
  device: string;
}

// Sự kiện: mọi cú click (type = 'click', có toạ độ để vẽ bản đồ nhiệt) + hành động nghiệp vụ quan
// trọng (apply_click, apply_submit, save_job, follow_company, contact_phone/email/zalo, search...).
@Entity({ name: 'analytics_events' })
@Index('IDX_analytics_events_created_at', ['createdAt'])
@Index('IDX_analytics_events_type_created_at', ['type', 'createdAt'])
@Index('IDX_analytics_events_route_device', ['route', 'device'])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ name: 'pageview_id', type: 'uuid', nullable: true })
  pageviewId?: string | null;

  @Column({ name: 'visitor_id', type: 'varchar', length: 64 })
  visitorId: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'guest' })
  role: string;

  @Column({ type: 'varchar', length: 40 })
  type: string;

  @Column({ type: 'varchar', length: 200 })
  route: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  path?: string | null;

  @Column({ name: 'entity_type', type: 'varchar', length: 20, nullable: true })
  entityType?: string | null;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId?: string | null;

  // Tên nút/link được bấm (chữ hiển thị hoặc href), cắt 120 ký tự.
  @Column({ type: 'varchar', length: 120, nullable: true })
  label?: string | null;

  // Toạ độ click: x theo tỉ lệ bề ngang trang (0..1), y theo pixel từ đầu trang; kèm chiều cao trang.
  @Column({ type: 'real', nullable: true })
  x?: number | null;

  @Column({ type: 'int', nullable: true })
  y?: number | null;

  @Column({ name: 'doc_h', type: 'int', nullable: true })
  docH?: number | null;

  @Column({ type: 'varchar', length: 10, default: 'desktop' })
  device: string;

  @Column({ type: 'jsonb', nullable: true })
  meta?: Record<string, unknown> | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

// Số tổng hợp theo ngày (giờ Việt Nam), giữ vĩnh viễn. kind + key: 'site'/'' , 'route'/<mẫu trang>,
// 'job'/<id>, 'company'/<id>, 'source'/<nguồn>, 'channel', 'device', 'browser', 'os', 'city',
// 'role', 'event'/<loại>, 'search'/<từ khoá>.
@Entity({ name: 'analytics_daily' })
@Index('IDX_analytics_daily_kind_day', ['kind', 'day'])
export class AnalyticsDaily {
  @PrimaryColumn({ type: 'date' })
  day: string;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  kind: string;

  @PrimaryColumn({ type: 'varchar', length: 300 })
  key: string;

  @Column({ type: 'int', default: 0 })
  views: number;

  @Column({ type: 'int', default: 0 })
  visitors: number;

  @Column({ type: 'int', default: 0 })
  sessions: number;

  @Column({ name: 'duration_ms', type: 'bigint', default: 0 })
  durationMs: string;

  @Column({ name: 'duration_n', type: 'int', default: 0 })
  durationN: number;

  @Column({ type: 'int', default: 0 })
  bounces: number;

  @Column({ type: 'int', default: 0 })
  events: number;

  @Column({ type: 'jsonb', nullable: true })
  extra?: Record<string, number> | null;
}

// Bot/công cụ tự động ghé web (không tính vào số liệu người thật) — đếm theo ngày, giữ vĩnh viễn.
@Entity({ name: 'analytics_bot_hits' })
export class AnalyticsBotHit {
  @PrimaryColumn({ type: 'date' })
  day: string;

  @PrimaryColumn({ type: 'varchar', length: 60 })
  bot: string;

  @Column({ type: 'int', default: 0 })
  hits: number;
}
