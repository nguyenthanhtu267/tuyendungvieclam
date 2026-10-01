import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 84 — thông tin riêng theo nhóm (công nhân / sinh viên / thực tập sinh) cho hồ sơ và tin; xin xác nhận thực tập.
export class AddLaborExtra1789972000000 implements MigrationInterface {
  name = 'AddLaborExtra1789972000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "profile_extra" jsonb`);
    await q.query(`ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "labor_extra" jsonb`);
    await q.query(`ALTER TABLE "worker_applications" ADD COLUMN IF NOT EXISTS "cert_requested_at" TIMESTAMP`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "worker_profiles" DROP COLUMN IF EXISTS "profile_extra"`);
    await q.query(`ALTER TABLE "job_postings" DROP COLUMN IF EXISTS "labor_extra"`);
    await q.query(`ALTER TABLE "worker_applications" DROP COLUMN IF EXISTS "cert_requested_at"`);
  }
}
