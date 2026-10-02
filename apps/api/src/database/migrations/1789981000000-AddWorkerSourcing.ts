import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 136 — thu thập hồ sơ lao động phổ thông: nguồn tổng hợp, NTD tự nhập, che số + nhật ký xem số.
export class AddWorkerSourcing1789981000000 implements MigrationInterface {
  name = 'AddWorkerSourcing1789981000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "worker_profiles" ALTER COLUMN "birth_date" DROP NOT NULL`);
    await q.query(`ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "birth_year" integer`);
    await q.query(`ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "is_sourced" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "source_label" varchar(120)`);
    await q.query(`ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "claimed_at" TIMESTAMP`);
    await q.query(`ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "owner_company_id" uuid`);
    await q.query(`ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "share_status" varchar(10)`);
    await q.query(`ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "shared_at" TIMESTAMP`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_worker_profiles_owner" ON "worker_profiles" ("owner_company_id") WHERE "owner_company_id" IS NOT NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_worker_profiles_sourced" ON "worker_profiles" ("is_sourced") WHERE "is_sourced" = true`);
    await q.query(`CREATE TABLE IF NOT EXISTS "worker_phone_views" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "company_id" uuid NOT NULL,
      "profile_id" uuid NOT NULL,
      "user_id" uuid,
      "viewed_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_worker_phone_views" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_worker_phone_views_company" ON "worker_phone_views" ("company_id", "viewed_at")`);
    await q.query(`ALTER TABLE "admin_settings" ADD COLUMN IF NOT EXISTS "worker_auto_share_enabled" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "admin_settings" ADD COLUMN IF NOT EXISTS "worker_auto_share_enabled_at" TIMESTAMP`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "admin_settings" DROP COLUMN IF EXISTS "worker_auto_share_enabled_at"`);
    await q.query(`ALTER TABLE "admin_settings" DROP COLUMN IF EXISTS "worker_auto_share_enabled"`);
    await q.query(`DROP TABLE IF EXISTS "worker_phone_views"`);
    for (const c of ['shared_at', 'share_status', 'owner_company_id', 'claimed_at', 'source_label', 'is_sourced', 'birth_year']) await q.query(`ALTER TABLE "worker_profiles" DROP COLUMN IF EXISTS "${c}"`);
  }
}
