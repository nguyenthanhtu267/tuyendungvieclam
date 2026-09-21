import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 12p (21/09/2026) — Batch 4 mục #1 "Thống kê lượt xem/tỷ lệ chuyển đổi tin đăng": thêm cột
// view_count trên job_postings, tăng dần mỗi khi ứng viên xem trang chi tiết tin công khai (xem
// JobsService.findOne() trong jobs.service.ts). Mặc định 0 — tin cũ trước đợt này coi như chưa có
// lượt xem ghi nhận (không suy diễn ngược, tránh sai lệch số liệu).
export class AddJobViewCount1789941200000 implements MigrationInterface {
  name = 'AddJobViewCount1789941200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job_postings" ADD "view_count" integer NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job_postings" DROP COLUMN "view_count"`);
  }
}
