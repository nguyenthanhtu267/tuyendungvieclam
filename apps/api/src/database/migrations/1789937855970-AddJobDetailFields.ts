import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 12k (21/09/2026) — thêm 4 cột không bắt buộc cho job_postings: address (địa chỉ chi tiết),
// gender, age_range, work_schedule — phục vụ khối "Địa điểm làm việc" / "Thông tin khác" trên trang
// chi tiết tin (theo mẫu careerviet.vn). Tin đã đăng trước đây sẽ có các cột này = NULL; frontend tự
// hiện giá trị mặc định khi trống, không cần backfill dữ liệu.
export class AddJobDetailFields1789937855970 implements MigrationInterface {
  name = 'AddJobDetailFields1789937855970';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job_postings" ADD "address" character varying`);
    await queryRunner.query(`ALTER TABLE "job_postings" ADD "gender" character varying`);
    await queryRunner.query(`ALTER TABLE "job_postings" ADD "age_range" character varying`);
    await queryRunner.query(`ALTER TABLE "job_postings" ADD "work_schedule" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job_postings" DROP COLUMN "work_schedule"`);
    await queryRunner.query(`ALTER TABLE "job_postings" DROP COLUMN "age_range"`);
    await queryRunner.query(`ALTER TABLE "job_postings" DROP COLUMN "gender"`);
    await queryRunner.query(`ALTER TABLE "job_postings" DROP COLUMN "address"`);
  }
}
