import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 17 (25/09/2026) — "Nguồn ngoài / Tin tổng hợp" (mô hình "labeled aggregator", theo yêu cầu
// người dùng qua trao đổi + AskUserQuestion):
//  1. 3 cột mới ở `companies`: `is_admin_sourced` (đánh dấu công ty do Admin tạo hộ từ nguồn ngoài),
//     `source_label` (nhãn nguồn tự do), `claimed_at` (thời điểm công ty thật "nhận lại" tài khoản —
//     null nghĩa là vẫn hiện badge "chưa xác thực").
//  2. 1 cột mới ở `job_postings`: `source_url` (link gốc tin, không bắt buộc, chỉ Admin xem nội bộ).
//  3. Bảng mới `company_claim_requests` — yêu cầu công khai "Đây là công ty của bạn?" (không cần đăng
//     nhập, xem CompaniesController), Admin duyệt/từ chối ở tab "Nguồn ngoài".
// Không cần backfill dữ liệu cũ: mọi công ty/tin hiện có đều KHÔNG phải nguồn ngoài (is_admin_sourced
// mặc định false), nên không bị hiện badge nhầm.
export class AddCompanySourcing1789949000000 implements MigrationInterface {
  name = 'AddCompanySourcing1789949000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "companies" ADD "is_admin_sourced" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "companies" ADD "source_label" character varying`);
    await queryRunner.query(`ALTER TABLE "companies" ADD "claimed_at" TIMESTAMP`);
    await queryRunner.query(
      `CREATE INDEX "IDX_companies_is_admin_sourced" ON "companies" ("is_admin_sourced")`,
    );

    await queryRunner.query(`ALTER TABLE "job_postings" ADD "source_url" character varying`);

    await queryRunner.query(
      `CREATE TYPE "company_claim_requests_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "company_claim_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "requester_name" character varying NOT NULL,
        "requester_email" character varying NOT NULL,
        "requester_phone" character varying,
        "note" text,
        "status" "company_claim_requests_status_enum" NOT NULL DEFAULT 'pending',
        "admin_note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "resolved_at" TIMESTAMP,
        CONSTRAINT "PK_company_claim_requests_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_company_claim_requests_company_id" ON "company_claim_requests" ("company_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_company_claim_requests_status" ON "company_claim_requests" ("status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_claim_requests" ADD CONSTRAINT "FK_company_claim_requests_company_id" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "company_claim_requests"`);
    await queryRunner.query(`DROP TYPE "company_claim_requests_status_enum"`);
    await queryRunner.query(`ALTER TABLE "job_postings" DROP COLUMN "source_url"`);
    await queryRunner.query(`DROP INDEX "IDX_companies_is_admin_sourced"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "claimed_at"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "source_label"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "is_admin_sourced"`);
  }
}
