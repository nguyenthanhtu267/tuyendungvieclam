import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 29 (30/09/2026) — cấu hình nền giao diện toàn website (cố định / tự động đổi mỗi N giờ). Chỉ thêm cột.
export class AddBackgroundSettings1789958000000 implements MigrationInterface {
  name = 'AddBackgroundSettings1789958000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD COLUMN IF NOT EXISTS "bg_mode" character varying NOT NULL DEFAULT 'auto'`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD COLUMN IF NOT EXISTS "bg_theme" character varying NOT NULL DEFAULT 'neural-1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD COLUMN IF NOT EXISTS "bg_auto_themes" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD COLUMN IF NOT EXISTS "bg_auto_hours" integer NOT NULL DEFAULT 2`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin_settings" DROP COLUMN IF EXISTS "bg_auto_hours"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" DROP COLUMN IF EXISTS "bg_auto_themes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" DROP COLUMN IF EXISTS "bg_theme"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" DROP COLUMN IF EXISTS "bg_mode"`,
    );
  }
}
