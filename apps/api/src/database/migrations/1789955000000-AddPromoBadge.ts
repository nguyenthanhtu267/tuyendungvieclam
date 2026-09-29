import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 23 (29/09/2026) — nhãn quảng bá nhấp nháy cạnh logo ("Phần mềm Nhân sự Toàn diện"): Admin bật/tắt,
// sửa chữ và đường dẫn (mở tab mới) — lưu vào bảng cấu hình chung `admin_settings` (1 dòng 'singleton').
// Chỉ thêm cột có giá trị mặc định, không đụng dữ liệu cũ. Mặc định TẮT cho tới khi Admin nhập link.
export class AddPromoBadge1789955000000 implements MigrationInterface {
  name = 'AddPromoBadge1789955000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD "promo_badge_enabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD "promo_badge_text" character varying NOT NULL DEFAULT 'Phần mềm Nhân sự Toàn diện'`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD "promo_badge_url" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin_settings" DROP COLUMN "promo_badge_url"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" DROP COLUMN "promo_badge_text"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" DROP COLUMN "promo_badge_enabled"`,
    );
  }
}
