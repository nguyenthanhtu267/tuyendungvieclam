import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 150 — nguồn theo dõi: nhớ trang kế tiếp khi quét thủ công từng trang.
export class AddSourceManualPage1789984000000 implements MigrationInterface {
  name = 'AddSourceManualPage1789984000000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "job_sources" ADD COLUMN IF NOT EXISTS "manual_page" integer NOT NULL DEFAULT 1`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "job_sources" DROP COLUMN IF EXISTS "manual_page"`);
  }
}
