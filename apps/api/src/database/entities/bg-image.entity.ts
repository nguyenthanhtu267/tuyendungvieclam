import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Đợt 30b — ảnh nền do Admin tải lên (đã được trình duyệt Admin chuẩn hoá: thu nhỏ ≤ 2560px, đổi sang WEBP/JPEG).
@Entity('bg_images')
export class BgImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'mime', type: 'varchar' })
  mime: string;

  @Column({ name: 'data', type: 'bytea', nullable: true, select: false })
  data?: Buffer | null;

  // Khoá file trên Google Drive (nếu bật lưu trữ Drive); khi đó `data` = null.
  @Column({ name: 'storage_key', type: 'varchar', nullable: true })
  storageKey?: string | null;

  // Độ phủ sáng 0–90 (%): phủ màu sáng lên ảnh để chữ trên trang luôn đọc rõ.
  @Column({ name: 'overlay', type: 'int', default: 78 })
  overlay: number;

  @Column({ name: 'width', type: 'int', default: 0 })
  width: number;

  @Column({ name: 'height', type: 'int', default: 0 })
  height: number;

  @Column({ name: 'bytes', type: 'int', default: 0 })
  bytes: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
