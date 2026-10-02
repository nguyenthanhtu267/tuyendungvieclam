import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

// Đợt 147 — "Nguồn theo dõi": Admin dán link công ty / ngành nghề / từ khoá của một trang tuyển dụng; hệ thống đọc hết các
// trang danh sách, đưa tin MỚI vào "Hộp nhập tin từ link" (Chờ xem) và quét lại mỗi ngày. Quét theo lô (hàng đợi `queue`)
// để chạy được trên Render miễn phí; không tự đăng trừ khi Admin tick "cho tự đăng".
export type JobSourceKind = 'company' | 'category' | 'keyword' | 'list';

@Entity({ name: 'job_sources' })
export class JobSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, default: 'list' })
  kind: JobSourceKind;

  // Mã bộ đọc theo trang (careerviet | generic …).
  @Column({ type: 'varchar', length: 30, default: 'generic' })
  site: string;

  @Column({ type: 'varchar', length: 200 })
  label: string;

  // Link trang danh sách đã chuẩn hoá (trang 1) — duy nhất.
  @Index({ unique: true })
  @Column({ type: 'text' })
  url: string;

  // Link Admin đã dán (có thể là trang giới thiệu công ty).
  @Column({ name: 'original_url', type: 'text', nullable: true })
  originalUrl?: string | null;

  @Column({ default: true })
  enabled: boolean;

  // Cho phép chế độ "tự đăng" chung áp dụng cho tin của nguồn này (mặc định: không — chỉ vào Chờ xem).
  @Column({ name: 'auto_publish', default: false })
  autoPublish: boolean;

  @Column({ name: 'max_pages', type: 'int', default: 40 })
  maxPages: number;

  // Hàng đợi link tin đã thấy nhưng chưa nhập (xử lý dần theo lô).
  @Column({ type: 'jsonb', default: () => "'[]'" })
  queue: string[];

  // Trang danh sách đang đọc dở (0 = đã đọc xong vòng hiện tại).
  @Column({ name: 'cursor_page', type: 'int', default: 0 })
  cursorPage: number;

  @Column({ name: 'discovered_at', type: 'timestamp', nullable: true })
  discoveredAt?: Date | null;

  // Số vòng đọc danh sách đã hoàn tất (>=1 thì các lần sau dừng sớm khi gặp trang toàn tin cũ).
  @Column({ name: 'cycles_done', type: 'int', default: 0 })
  cyclesDone: number;

  // Tổng số tin trang nguồn ghi (nếu đọc được).
  @Column({ name: 'site_total', type: 'int', nullable: true })
  siteTotal?: number | null;

  @Column({ name: 'total_found', type: 'int', default: 0 })
  totalFound: number;

  @Column({ name: 'total_added', type: 'int', default: 0 })
  totalAdded: number;

  @Column({ name: 'last_added', type: 'int', default: 0 })
  lastAdded: number;

  @Column({ name: 'last_scan_at', type: 'timestamp', nullable: true })
  lastScanAt?: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
