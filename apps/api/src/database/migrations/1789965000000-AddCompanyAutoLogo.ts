import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 67 — logo công ty tự dò từ website.
export class AddCompanyAutoLogo1789965000000 implements MigrationInterface {
  name = 'AddCompanyAutoLogo1789965000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "auto_logo_url" character varying`);
    await q.query(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "logo_checked_at" TIMESTAMP`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "companies" DROP COLUMN IF EXISTS "logo_checked_at"`);
    await q.query(`ALTER TABLE "companies" DROP COLUMN IF EXISTS "auto_logo_url"`);
  }
}
