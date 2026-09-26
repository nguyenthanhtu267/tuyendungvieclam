import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 18a (26/09/2026) — "Kho CV" của nhà tuyển dụng (xem cv-archive.entity.ts để biết lý do thiết
// kế). 2 bảng mới, KHÔNG sửa bảng cũ nào:
//  - cv_archive_candidates: 1 thẻ = 1 người trong kho của 1 công ty. Không khoá ngoại tới
//    candidate_profiles (cố ý — ứng viên xoá tài khoản thì thẻ vẫn còn).
//  - cv_archive_entries: 1 dòng = 1 lần ứng tuyển (bản chụp hồ sơ + bản sao file CV). Khoá ngoại tới
//    applications là ON DELETE SET NULL.
// Dữ liệu cũ KHÔNG backfill trong migration (cần đọc hồ sơ 13 mục qua nhiều bảng, dễ quá thời gian
// khởi động) — CvArchiveService tự "lưu bù" chạy nền ngay sau khi server khởi động.
export class AddCvArchive1789950000000 implements MigrationInterface {
  name = 'AddCvArchive1789950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "cv_archive_candidates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "candidate_profile_id" uuid,
        "full_name" character varying NOT NULL,
        "phone" character varying,
        "email" character varying,
        "province" character varying,
        "headline" character varying,
        "years_of_experience" integer,
        "skills_text" text,
        "search_text" text NOT NULL DEFAULT '',
        "application_count" integer NOT NULL DEFAULT 0,
        "last_applied_at" TIMESTAMP NOT NULL,
        "deleted_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cv_archive_candidates_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cv_archive_candidates_company_id" ON "cv_archive_candidates" ("company_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cv_archive_candidates_candidate_profile_id" ON "cv_archive_candidates" ("candidate_profile_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cv_archive_candidates_last_applied_at" ON "cv_archive_candidates" ("last_applied_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cv_archive_candidates_deleted_at" ON "cv_archive_candidates" ("deleted_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_candidates" ADD CONSTRAINT "FK_cv_archive_candidates_company_id" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `CREATE TABLE "cv_archive_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "archive_candidate_id" uuid NOT NULL,
        "company_id" uuid NOT NULL,
        "application_id" uuid,
        "job_posting_id" uuid,
        "job_title" character varying NOT NULL,
        "applied_at" TIMESTAMP NOT NULL,
        "cover_letter" text,
        "profile_snapshot" jsonb NOT NULL,
        "cv_type" character varying,
        "cv_file_name" character varying,
        "cv_mime_type" character varying,
        "cv_file_data" bytea,
        "cv_has_file" boolean NOT NULL DEFAULT false,
        "cv_external_link" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cv_archive_entries_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cv_archive_entries_archive_candidate_id" ON "cv_archive_entries" ("archive_candidate_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cv_archive_entries_company_id" ON "cv_archive_entries" ("company_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_cv_archive_entries_application_id" ON "cv_archive_entries" ("application_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cv_archive_entries_job_posting_id" ON "cv_archive_entries" ("job_posting_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_entries" ADD CONSTRAINT "FK_cv_archive_entries_archive_candidate_id" FOREIGN KEY ("archive_candidate_id") REFERENCES "cv_archive_candidates"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_entries" ADD CONSTRAINT "FK_cv_archive_entries_company_id" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_entries" ADD CONSTRAINT "FK_cv_archive_entries_application_id" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "cv_archive_entries"`);
    await queryRunner.query(`DROP TABLE "cv_archive_candidates"`);
  }
}
