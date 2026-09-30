import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 48 — bước "Đã xem" trong tiến trình ứng tuyển: thời điểm NTD mở CV/hồ sơ lần đầu. Chỉ thêm cột.
export class AddApplicationViewedAt1789962000000 implements MigrationInterface {
  name = 'AddApplicationViewedAt1789962000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "viewed_at" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "applications" DROP COLUMN IF EXISTS "viewed_at"`);
  }
}
