import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 88 — quy ước lương = TRIỆU ĐỒNG. Tin cũ lỡ lưu số tiền đầy đủ (15000000) làm nhãn "CAO CẤP" và bộ lọc lương sai → quy đổi về triệu.
export class NormalizeSalaryUnit1789973000000 implements MigrationInterface {
  name = 'NormalizeSalaryUnit1789973000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE "job_postings" SET "salary_min" = ROUND("salary_min" / 1000000.0) WHERE "salary_min" >= 1000000`);
    await q.query(`UPDATE "job_postings" SET "salary_max" = ROUND("salary_max" / 1000000.0) WHERE "salary_max" >= 1000000`);
  }

  public async down(): Promise<void> {
    /* không hoàn tác được */
  }
}
