import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 145 — lưu link gốc của nguồn trên công ty tổng hợp để hiển thị nút "Nguồn tại đây".
export class AddCompanySourceUrl1789982000000 implements MigrationInterface {
  name = 'AddCompanySourceUrl1789982000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "source_url" varchar(500)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "companies" DROP COLUMN IF EXISTS "source_url"`);
  }
}
