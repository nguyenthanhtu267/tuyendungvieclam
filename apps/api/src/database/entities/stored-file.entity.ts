import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

// Đợt 20 (27/09/2026) — sổ theo dõi mọi file web đã đẩy lên Google Drive. Dùng để: đếm dung lượng/tiến độ,
// và DỌN file "mồ côi" (bản ghi gốc đã bị xoá — VD ứng viên xoá CV/xoá tài khoản, đổi ảnh đại diện) để
// không còn giữ file cá nhân của người đã xoá trên Drive.
@Entity({ name: 'stored_files' })
@Index('IDX_stored_files_category', ['category'])
export class StoredFile {
  // "gd:<id file trên Drive>"
  @PrimaryColumn({ type: 'varchar', length: 200 })
  key: string;

  // cv / archive / legal / avatar
  @Column({ type: 'varchar', length: 20 })
  category: string;

  @Column({ name: 'file_name', type: 'varchar', length: 300, nullable: true })
  fileName?: string | null;

  @Column({ type: 'int', default: 0 })
  size: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
