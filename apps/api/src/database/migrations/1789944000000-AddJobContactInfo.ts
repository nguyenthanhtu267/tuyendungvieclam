import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 12aa (24/09/2026) — "Thông tin liên hệ" trên tin tuyển dụng (Người liên hệ / Email liên hệ /
// SĐT liên hệ), theo mẫu careerviet.vn. Cả 3 cột đều nullable (không bắt buộc).
export class AddJobContactInfo1789944000000 implements MigrationInterface {
  name = 'AddJobContactInfo1789944000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job_postings" ADD "contact_name" character varying`);
    await queryRunner.query(`ALTER TABLE "job_postings" ADD "contact_email" character varying`);
    await queryRunner.query(`ALTER TABLE "job_postings" ADD "contact_phone" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job_postings" DROP COLUMN "contact_phone"`);
    await queryRunner.query(`ALTER TABLE "job_postings" DROP COLUMN "contact_email"`);
    await queryRunner.query(`ALTER TABLE "job_postings" DROP COLUMN "contact_name"`);
  }
}
