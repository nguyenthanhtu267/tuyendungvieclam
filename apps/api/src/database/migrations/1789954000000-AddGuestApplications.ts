import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 22 (29/09/2026) — ứng tuyển KHÔNG cần đăng nhập. Đơn của khách dùng lại bảng `cvs` (để mọi chỗ đang
// đọc application.cv — danh sách Ứng viên của NTD, Kho CV, tải file, lưu file lên Google Drive — chạy
// nguyên): `candidate_profile_id` cho phép rỗng (khách không có hồ sơ/tài khoản) + 3 cột thông tin khách.
// Chỉ nới ràng buộc và thêm cột — không đụng dữ liệu cũ.
export class AddGuestApplications1789954000000 implements MigrationInterface {
  name = 'AddGuestApplications1789954000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cvs" ALTER COLUMN "candidate_profile_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "cvs" ADD "guest_full_name" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "cvs" ADD "guest_phone" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "cvs" ADD "guest_email" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cvs_guest_email" ON "cvs" (LOWER("guest_email")) WHERE "guest_email" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_cvs_guest_email"`);
    // Đơn của khách không có hồ sơ nên không thể ép NOT NULL lại — xoá CV khách (kéo theo đơn) trước.
    await queryRunner.query(
      `DELETE FROM "cvs" WHERE "candidate_profile_id" IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE "cvs" DROP COLUMN "guest_email"`);
    await queryRunner.query(`ALTER TABLE "cvs" DROP COLUMN "guest_phone"`);
    await queryRunner.query(`ALTER TABLE "cvs" DROP COLUMN "guest_full_name"`);
    await queryRunner.query(
      `ALTER TABLE "cvs" ALTER COLUMN "candidate_profile_id" SET NOT NULL`,
    );
  }
}
