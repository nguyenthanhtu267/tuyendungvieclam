import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 12x (21/09/2026) — "Bắt buộc nhập lý do khi Từ chối" (theo yêu cầu người dùng): thêm cột
// rejection_reasons (simple-array, giống cột tags/benefits) + rejection_note (text tự do) trên
// job_postings, để NTD xem lại được lý do Admin từ chối ở trang Quản lý tin đăng / Sửa tin.
export class AddJobRejectionReason1789943000000 implements MigrationInterface {
  name = 'AddJobRejectionReason1789943000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job_postings" ADD "rejection_reasons" text`);
    await queryRunner.query(`ALTER TABLE "job_postings" ADD "rejection_note" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job_postings" DROP COLUMN "rejection_note"`);
    await queryRunner.query(`ALTER TABLE "job_postings" DROP COLUMN "rejection_reasons"`);
  }
}
