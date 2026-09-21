import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 12v (21/09/2026) — "JOB TAGS / SKILLS": thêm cột tags (simple-array, giống cột benefits) trên
// job_postings để NTD tự nhập thẻ từ khoá/kỹ năng tự do khi đăng tin, hiển thị dạng chip ở trang chi
// tiết tin (theo ảnh mẫu người dùng gửi). Tin cũ chưa có dữ liệu → null, frontend chỉ hiện khối này
// khi có ít nhất 1 tag.
export class AddJobTags1789942000000 implements MigrationInterface {
  name = 'AddJobTags1789942000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job_postings" ADD "tags" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job_postings" DROP COLUMN "tags"`);
  }
}
