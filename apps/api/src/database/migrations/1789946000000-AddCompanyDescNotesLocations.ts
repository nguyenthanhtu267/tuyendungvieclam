import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 12ac (24/09/2026) — "Đợt 3":
// 1. "description" trên companies — giới thiệu công ty cho tab Tổng quan công ty.
// 2. Bảng "candidate_notes" — ghi chú riêng + ẩn khỏi danh sách tìm hồ sơ (icon hành động NTD).
// 3. Bảng "work_locations" — "Quản lý địa điểm làm việc" (chọn nhanh khi đăng tin).
export class AddCompanyDescNotesLocations1789946000000 implements MigrationInterface {
  name = 'AddCompanyDescNotesLocations1789946000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "companies" ADD "description" text`);

    await queryRunner.query(`
      CREATE TABLE "candidate_notes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "candidate_profile_id" uuid NOT NULL,
        "note" text,
        "hidden" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_candidate_notes_company_profile" UNIQUE ("company_id", "candidate_profile_id"),
        CONSTRAINT "PK_candidate_notes_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_candidate_notes_company_id" ON "candidate_notes" ("company_id")`);

    await queryRunner.query(`
      CREATE TABLE "work_locations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "label" character varying NOT NULL,
        "province" character varying NOT NULL,
        "district" character varying,
        "address" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_locations_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_work_locations_company_id" ON "work_locations" ("company_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_work_locations_company_id"`);
    await queryRunner.query(`DROP TABLE "work_locations"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_candidate_notes_company_id"`);
    await queryRunner.query(`DROP TABLE "candidate_notes"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "description"`);
  }
}
