import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 121 — chọn nhiều nhãn Gmail để quét email thông báo việc làm.
export class AddMailScanLabels1789978000000 implements MigrationInterface {
  name = 'AddMailScanLabels1789978000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "admin_settings" ADD COLUMN IF NOT EXISTS "mail_scan_labels" text`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "admin_settings" DROP COLUMN IF EXISTS "mail_scan_labels"`);
  }
}
