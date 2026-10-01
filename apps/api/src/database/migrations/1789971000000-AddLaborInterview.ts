import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 83 — hẹn phỏng vấn, điểm danh ngày đầu, chế độ mùa thi.
export class AddLaborInterview1789971000000 implements MigrationInterface {
  name = 'AddLaborInterview1789971000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "worker_applications" ADD COLUMN IF NOT EXISTS "interview_at" TIMESTAMP`);
    await q.query(`ALTER TABLE "worker_applications" ADD COLUMN IF NOT EXISTS "interview_place" varchar(200)`);
    await q.query(`ALTER TABLE "worker_applications" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP`);
    await q.query(`ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "exam_until" date`);
    await q.query(`ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "exam_mode" varchar(10)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "worker_applications" DROP COLUMN IF EXISTS "interview_at"`);
    await q.query(`ALTER TABLE "worker_applications" DROP COLUMN IF EXISTS "interview_place"`);
    await q.query(`ALTER TABLE "worker_applications" DROP COLUMN IF EXISTS "started_at"`);
    await q.query(`ALTER TABLE "worker_profiles" DROP COLUMN IF EXISTS "exam_until"`);
    await q.query(`ALTER TABLE "worker_profiles" DROP COLUMN IF EXISTS "exam_mode"`);
  }
}
