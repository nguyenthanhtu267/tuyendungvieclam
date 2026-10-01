import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 80 — tính năng thông minh kênh lao động phổ thông.
export class AddLaborSmart1789970000000 implements MigrationInterface {
  name = 'AddLaborSmart1789970000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "work_place" jsonb`);
    await q.query(`ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "labor_perks" text`);
    await q.query(`ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "pay_info" jsonb`);
    await q.query(`ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "labor_schedule" text`);
    await q.query(`ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "filled_at" TIMESTAMP`);
    await q.query(`ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "availability" text`);
    await q.query(`ALTER TABLE "worker_applications" ADD COLUMN IF NOT EXISTS "status" varchar(12) NOT NULL DEFAULT 'new'`);
    await q.query(`ALTER TABLE "worker_applications" ADD COLUMN IF NOT EXISTS "group_code" varchar(10)`);
    await q.query(`CREATE TABLE IF NOT EXISTS "worker_contacts" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "company_id" uuid NOT NULL,
      "profile_id" uuid NOT NULL,
      "author_user_id" uuid NOT NULL,
      "status" varchar(12) NOT NULL,
      "job_posting_id" uuid,
      "updated_at" TIMESTAMP NOT NULL,
      "created_at" TIMESTAMP NOT NULL,
      CONSTRAINT "PK_worker_contacts" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_worker_contact" ON "worker_contacts" ("company_id", "profile_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_worker_contacts_profile" ON "worker_contacts" ("profile_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "worker_contacts"`);
    await q.query(`ALTER TABLE "worker_applications" DROP COLUMN IF EXISTS "group_code"`);
    await q.query(`ALTER TABLE "worker_applications" DROP COLUMN IF EXISTS "status"`);
    await q.query(`ALTER TABLE "worker_profiles" DROP COLUMN IF EXISTS "availability"`);
    for (const c of ['filled_at', 'labor_schedule', 'pay_info', 'labor_perks', 'work_place']) await q.query(`ALTER TABLE "job_postings" DROP COLUMN IF EXISTS "${c}"`);
  }
}
