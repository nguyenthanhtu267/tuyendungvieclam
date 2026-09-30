import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 65 — bảng báo cáo tin tuyển dụng từ người dùng.
export class AddJobReports1789964000000 implements MigrationInterface {
  name = 'AddJobReports1789964000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "job_reports" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "job_posting_id" uuid NOT NULL,
      "reporter_user_id" uuid,
      "reason" character varying(40) NOT NULL,
      "note" text,
      "category" character varying(40) NOT NULL,
      "priority" character varying(10) NOT NULL DEFAULT 'normal',
      "status" character varying(10) NOT NULL DEFAULT 'open',
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_job_reports_id" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_job_reports_job" ON "job_reports" ("job_posting_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "job_reports"`);
  }
}
