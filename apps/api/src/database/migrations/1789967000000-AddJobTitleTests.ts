import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 75 — thử nghiệm A/B tiêu đề tin tuyển dụng.
export class AddJobTitleTests1789967000000 implements MigrationInterface {
  name = 'AddJobTitleTests1789967000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "job_title_tests" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "job_id" uuid NOT NULL,
      "company_id" uuid NOT NULL,
      "title_a" character varying NOT NULL,
      "title_b" character varying NOT NULL,
      "views_a" integer NOT NULL DEFAULT 0,
      "views_b" integer NOT NULL DEFAULT 0,
      "clicks_a" integer NOT NULL DEFAULT 0,
      "clicks_b" integer NOT NULL DEFAULT 0,
      "status" character varying NOT NULL DEFAULT 'running',
      "winner" character varying,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "ended_at" TIMESTAMP,
      CONSTRAINT "PK_job_title_tests" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_job_title_tests_job" ON "job_title_tests" ("job_id", "status")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "job_title_tests"`);
  }
}
