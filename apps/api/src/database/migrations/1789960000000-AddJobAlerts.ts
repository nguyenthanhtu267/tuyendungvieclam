import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 38 — cảnh báo việc mới: link cho thông báo + bật/tắt & mốc gửi gần nhất của "tìm kiếm đã lưu". Chỉ thêm cột.
export class AddJobAlerts1789960000000 implements MigrationInterface {
  name = 'AddJobAlerts1789960000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "link" character varying`,
    );
    await q.query(
      `ALTER TABLE "search_histories" ADD COLUMN IF NOT EXISTS "alert_enabled" boolean NOT NULL DEFAULT true`,
    );
    await q.query(
      `ALTER TABLE "search_histories" ADD COLUMN IF NOT EXISTS "last_alert_at" TIMESTAMP`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "search_histories" DROP COLUMN IF EXISTS "last_alert_at"`,
    );
    await q.query(
      `ALTER TABLE "search_histories" DROP COLUMN IF EXISTS "alert_enabled"`,
    );
    await q.query(`ALTER TABLE "notifications" DROP COLUMN IF EXISTS "link"`);
  }
}
