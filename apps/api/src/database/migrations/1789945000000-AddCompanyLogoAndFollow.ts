import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 12ab (24/09/2026):
// 1. "logo_url" trên companies — NTD dán link ảnh (URL) làm logo hiện trên thẻ việc làm/trang công
//    ty (quyết định đã chốt: chưa nối Cloudflare R2 cho loại ảnh này nên dùng link thay vì tải tệp).
// 2. Bảng "company_follows" — "Theo dõi công ty" cho ứng viên (nút "+ Theo dõi" ở trang chi tiết tin
//    + trang công ty, trước đó chỉ là nút tĩnh chưa nối chức năng).
export class AddCompanyLogoAndFollow1789945000000 implements MigrationInterface {
  name = 'AddCompanyLogoAndFollow1789945000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "companies" ADD "logo_url" character varying`);

    await queryRunner.query(`
      CREATE TABLE "company_follows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "candidate_profile_id" uuid NOT NULL,
        "company_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_company_follows_profile_company" UNIQUE ("candidate_profile_id", "company_id"),
        CONSTRAINT "PK_company_follows_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_company_follows_company_id" ON "company_follows" ("company_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_company_follows_company_id"`);
    await queryRunner.query(`DROP TABLE "company_follows"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "logo_url"`);
  }
}
