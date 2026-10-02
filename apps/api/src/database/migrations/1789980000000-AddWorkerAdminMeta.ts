import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 135 — thẻ + ghi chú nội bộ Admin cho hồ sơ lao động phổ thông.
export class AddWorkerAdminMeta1789980000000 implements MigrationInterface {
  name = 'AddWorkerAdminMeta1789980000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "admin_tags" text[]`);
    await q.query(`ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "admin_note" text`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "worker_profiles" DROP COLUMN IF EXISTS "admin_note"`);
    await q.query(`ALTER TABLE "worker_profiles" DROP COLUMN IF EXISTS "admin_tags"`);
  }
}
