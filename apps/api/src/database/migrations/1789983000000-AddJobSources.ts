import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 147 — bảng "Nguồn theo dõi" (công ty / ngành nghề / từ khoá của trang tuyển dụng) quét tự động mỗi ngày.
export class AddJobSources1789983000000 implements MigrationInterface {
  name = 'AddJobSources1789983000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "job_sources" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "kind" varchar(20) NOT NULL DEFAULT 'list',
      "site" varchar(30) NOT NULL DEFAULT 'generic',
      "label" varchar(200) NOT NULL,
      "url" text NOT NULL,
      "original_url" text,
      "enabled" boolean NOT NULL DEFAULT true,
      "auto_publish" boolean NOT NULL DEFAULT false,
      "max_pages" integer NOT NULL DEFAULT 40,
      "queue" jsonb NOT NULL DEFAULT '[]',
      "cursor_page" integer NOT NULL DEFAULT 0,
      "discovered_at" TIMESTAMP,
      "cycles_done" integer NOT NULL DEFAULT 0,
      "site_total" integer,
      "total_found" integer NOT NULL DEFAULT 0,
      "total_added" integer NOT NULL DEFAULT 0,
      "last_added" integer NOT NULL DEFAULT 0,
      "last_scan_at" TIMESTAMP,
      "last_error" text,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_job_sources" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_job_sources_url" ON "job_sources" ("url")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "job_sources"`);
  }
}
