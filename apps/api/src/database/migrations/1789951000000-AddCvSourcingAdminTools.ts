import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 18b → 18f (26/09/2026) — 1 migration chung cho cả loạt (giao cùng 1 lần):
//  18b: cv_archive_entries + cv_text / cv_parsed / cv_text_status (đọc chữ file CV) + entry_source.
//  18c: cv_archive_candidates + share_status / shared_profile_id / share_decided_at (hàng chờ chia sẻ);
//       candidate_profiles + is_admin_sourced / source_label / claimed_at (hồ sơ nguồn tổng hợp);
//       admin_settings + cv_auto_share_enabled / cv_auto_share_enabled_at (công tắc tự động 15 phút);
//       bảng mới candidate_profile_requests (yêu cầu gỡ/nhận lại hồ sơ).
//  18f: bảng mới admin_candidate_notes (nhãn + ghi chú nội bộ của Admin).
// Mọi cột mới đều có mặc định/cho phép rỗng → không ảnh hưởng dữ liệu cũ. Thẻ Kho CV cũ mặc định
// share_status = 'pending' (vào hàng chờ để Admin tự quyết), KHÔNG bị tự động chia sẻ vì công tắc tự
// động chỉ áp dụng cho CV nộp sau thời điểm bật.
export class AddCvSourcingAdminTools1789951000000 implements MigrationInterface {
  name = 'AddCvSourcingAdminTools1789951000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 18b
    await queryRunner.query(
      `ALTER TABLE "cv_archive_entries" ADD "cv_text" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_entries" ADD "cv_parsed" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_entries" ADD "cv_text_status" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_entries" ADD "entry_source" character varying NOT NULL DEFAULT 'application'`,
    );

    // 18c — hàng chờ chia sẻ
    await queryRunner.query(
      `ALTER TABLE "cv_archive_candidates" ADD "share_status" character varying NOT NULL DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_candidates" ADD "shared_profile_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_candidates" ADD "share_decided_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cv_archive_candidates_share_status" ON "cv_archive_candidates" ("share_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cv_archive_candidates_shared_profile_id" ON "cv_archive_candidates" ("shared_profile_id")`,
    );

    // 18c — hồ sơ nguồn tổng hợp
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "is_admin_sourced" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "source_label" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "claimed_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_candidate_profiles_is_admin_sourced" ON "candidate_profiles" ("is_admin_sourced")`,
    );

    // 18c — công tắc tự động chia sẻ
    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD "cv_auto_share_enabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD "cv_auto_share_enabled_at" TIMESTAMP`,
    );

    // 18c — yêu cầu gỡ/nhận lại hồ sơ
    await queryRunner.query(
      `CREATE TABLE "candidate_profile_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "full_name" character varying NOT NULL,
        "email" character varying NOT NULL,
        "phone" character varying,
        "request_type" character varying NOT NULL,
        "note" text,
        "status" character varying NOT NULL DEFAULT 'pending',
        "resolved_profile_id" uuid,
        "admin_note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "resolved_at" TIMESTAMP,
        CONSTRAINT "PK_candidate_profile_requests_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_candidate_profile_requests_status" ON "candidate_profile_requests" ("status")`,
    );

    // 18f — nhãn + ghi chú nội bộ của Admin
    await queryRunner.query(
      `CREATE TABLE "admin_candidate_notes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "candidate_profile_id" uuid NOT NULL,
        "tags" text,
        "note" text,
        "updated_by_email" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_candidate_notes_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_admin_candidate_notes_candidate_profile_id" ON "admin_candidate_notes" ("candidate_profile_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_candidate_notes" ADD CONSTRAINT "FK_admin_candidate_notes_candidate_profile_id" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "admin_candidate_notes"`);
    await queryRunner.query(`DROP TABLE "candidate_profile_requests"`);
    await queryRunner.query(
      `ALTER TABLE "admin_settings" DROP COLUMN "cv_auto_share_enabled_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" DROP COLUMN "cv_auto_share_enabled"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_candidate_profiles_is_admin_sourced"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "claimed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "source_label"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "is_admin_sourced"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_cv_archive_candidates_shared_profile_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_cv_archive_candidates_share_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_candidates" DROP COLUMN "share_decided_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_candidates" DROP COLUMN "shared_profile_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_candidates" DROP COLUMN "share_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_entries" DROP COLUMN "entry_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_entries" DROP COLUMN "cv_text_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_entries" DROP COLUMN "cv_parsed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_entries" DROP COLUMN "cv_text"`,
    );
  }
}
