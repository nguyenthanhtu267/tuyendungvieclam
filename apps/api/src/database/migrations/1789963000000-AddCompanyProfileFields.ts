import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 49 — trang "Tổng quan công ty" theo mẫu: địa chỉ, người liên hệ, loại hình, tầm nhìn, sứ mệnh, hình ảnh. Chỉ thêm cột.
export class AddCompanyProfileFields1789963000000 implements MigrationInterface {
  name = 'AddCompanyProfileFields1789963000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "address" character varying(300)`);
    await q.query(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "contact_person" character varying(120)`);
    await q.query(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "company_type" character varying(120)`);
    await q.query(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "vision" text`);
    await q.query(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "mission" text`);
    await q.query(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "gallery_urls" jsonb`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const c of ['gallery_urls', 'mission', 'vision', 'company_type', 'contact_person', 'address'])
      await q.query(`ALTER TABLE "companies" DROP COLUMN IF EXISTS "${c}"`);
  }
}
