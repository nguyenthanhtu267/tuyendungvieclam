import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 79 — lao động phổ thông: hồ sơ không cần tài khoản, ghi chú NTD, ứng tuyển nhanh, kênh tin riêng.
export class AddWorkerProfiles1789969000000 implements MigrationInterface {
  name = 'AddWorkerProfiles1789969000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "channel" varchar(10) NOT NULL DEFAULT 'office'`);
    await q.query(`ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "labor_group" varchar(60)`);
    await q.query(`CREATE TABLE IF NOT EXISTS "worker_profiles" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "kind" varchar(10) NOT NULL DEFAULT 'worker',
      "full_name" varchar(120) NOT NULL,
      "phone" varchar(15) NOT NULL,
      "relative_phone" varchar(15),
      "gender" varchar(6) NOT NULL,
      "birth_date" date NOT NULL,
      "province" varchar(60) NOT NULL,
      "address_mode" varchar(3) NOT NULL DEFAULT 'old',
      "old_district" varchar(120),
      "old_ward" varchar(120),
      "new_ward_code" varchar(10),
      "new_ward" varchar(120),
      "address_detail" varchar(200),
      "lat" double precision,
      "lon" double precision,
      "radius_km" integer,
      "desired_jobs" text,
      "shifts" text,
      "school" varchar(150),
      "major" varchar(150),
      "needs_housing" boolean NOT NULL DEFAULT false,
      "needs_shuttle" boolean NOT NULL DEFAULT false,
      "is_seeking" boolean NOT NULL DEFAULT true,
      "is_hidden" boolean NOT NULL DEFAULT false,
      "user_id" uuid,
      "refreshed_at" TIMESTAMP NOT NULL DEFAULT now(),
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_worker_profiles" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_worker_profiles_phone" ON "worker_profiles" ("phone")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_worker_profiles_province" ON "worker_profiles" ("province")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_worker_profiles_refreshed" ON "worker_profiles" ("refreshed_at")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "worker_notes" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "profile_id" uuid NOT NULL,
      "company_id" uuid,
      "author_user_id" uuid NOT NULL,
      "kind" varchar(10) NOT NULL DEFAULT 'note',
      "text" varchar(200) NOT NULL,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_worker_notes" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_worker_notes_profile" ON "worker_notes" ("profile_id")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "worker_applications" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "profile_id" uuid NOT NULL,
      "job_posting_id" uuid NOT NULL,
      "seen_at" TIMESTAMP,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_worker_applications" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_worker_app" ON "worker_applications" ("profile_id", "job_posting_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "worker_applications"`);
    await q.query(`DROP TABLE IF EXISTS "worker_notes"`);
    await q.query(`DROP TABLE IF EXISTS "worker_profiles"`);
    await q.query(`ALTER TABLE "job_postings" DROP COLUMN IF EXISTS "labor_group"`);
    await q.query(`ALTER TABLE "job_postings" DROP COLUMN IF EXISTS "channel"`);
  }
}
