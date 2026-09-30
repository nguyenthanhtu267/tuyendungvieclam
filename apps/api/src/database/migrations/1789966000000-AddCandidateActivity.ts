import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 73 — "mới truy cập / mới cập nhật hồ sơ" cho NTD tìm ứng viên.
export class AddCandidateActivity1789966000000 implements MigrationInterface {
  name = 'AddCandidateActivity1789966000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMP`);
    await q.query(`ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "show_activity_status" boolean NOT NULL DEFAULT true`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_users_last_active_at" ON "users" ("last_active_at")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_candidate_profiles_updated_at" ON "candidate_profiles" ("updated_at")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_candidate_profiles_updated_at"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_users_last_active_at"`);
    await q.query(`ALTER TABLE "candidate_profiles" DROP COLUMN IF EXISTS "show_activity_status"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "last_active_at"`);
  }
}
