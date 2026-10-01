import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 120 — cột cấu hình "Tự đọc email thông báo việc làm" trên bảng admin_settings.
export class AddMailScanSettings1789977000000 implements MigrationInterface {
  name = 'AddMailScanSettings1789977000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "admin_settings" ADD COLUMN IF NOT EXISTS "mail_scan_enabled" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "admin_settings" ADD COLUMN IF NOT EXISTS "mail_scan_last_at" TIMESTAMP`);
    await q.query(`ALTER TABLE "admin_settings" ADD COLUMN IF NOT EXISTS "mail_scan_last_result" text`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "admin_settings" DROP COLUMN IF EXISTS "mail_scan_last_result"`);
    await q.query(`ALTER TABLE "admin_settings" DROP COLUMN IF EXISTS "mail_scan_last_at"`);
    await q.query(`ALTER TABLE "admin_settings" DROP COLUMN IF EXISTS "mail_scan_enabled"`);
  }
}
