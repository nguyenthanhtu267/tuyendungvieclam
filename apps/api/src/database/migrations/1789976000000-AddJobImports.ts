import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 119 — bảng "Hộp nhập tin từ link" (xem entities/job-import.entity.ts).
export class AddJobImports1789976000000 implements MigrationInterface {
  name = 'AddJobImports1789976000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "job_imports" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "source_url" text NOT NULL,
      "status" character varying(20) NOT NULL DEFAULT 'pending',
      "data" jsonb NOT NULL DEFAULT '{}',
      "matched_company_id" uuid,
      "match_kind" character varying(20),
      "company_has_owner" boolean NOT NULL DEFAULT false,
      "job_id" uuid,
      "note" text,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_job_imports_id" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_job_imports_source_url" ON "job_imports" ("source_url")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_job_imports_status" ON "job_imports" ("status")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_job_imports_company" ON "job_imports" ("matched_company_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "job_imports"`);
  }
}
