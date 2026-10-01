import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 127 — chế độ tự đăng tin trong hộp nhập tin: Tắt / 15 phút / 30 phút.
export class AddImportAutoPublish1789979000000 implements MigrationInterface {
  name = 'AddImportAutoPublish1789979000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "admin_settings" ADD COLUMN IF NOT EXISTS "import_auto_publish_minutes" integer NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "admin_settings" ADD COLUMN IF NOT EXISTS "import_auto_publish_since" timestamp`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "admin_settings" DROP COLUMN IF EXISTS "import_auto_publish_since"`);
    await q.query(`ALTER TABLE "admin_settings" DROP COLUMN IF EXISTS "import_auto_publish_minutes"`);
  }
}
