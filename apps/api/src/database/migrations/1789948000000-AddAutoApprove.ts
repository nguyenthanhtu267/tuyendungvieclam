import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 15 (25/09/2026) — "Tự động duyệt tin" (theo yêu cầu người dùng, qua AskUserQuestion):
//  1. Bảng mới `admin_settings` — dạng key-value "singleton" (1 dòng cố định id='singleton'), lưu
//     công tắc chung `auto_approve_enabled` (mặc định TẮT). Thiết kế bảng riêng thay vì hard-code
//     biến môi trường để Admin bật/tắt được ngay trên giao diện, không cần deploy lại.
//  2. 2 cột mới ở `job_postings`:
//     - `auto_approved` (boolean, mặc định false) — đánh dấu tin này được tự động duyệt (khác duyệt
//       tay).
//     - `admin_reviewed` (boolean, mặc định false) — Admin đã bấm "Tin đã kiểm tra" (kiểm tra lần 2)
//       chưa. Chỉ có ý nghĩa khi auto_approved = true; tin duyệt tay coi như đã "kiểm tra" ngay từ
//       lúc đó (xem AdminService.setJobStatus()/rejectJobWithReason() — luôn set true).
// Không cần backfill dữ liệu cũ: mọi tin hiện có đều là duyệt tay (auto_approved mặc định false),
// nên tự động không rơi vào danh sách "chờ kiểm tra lần 2" mới này.
export class AddAutoApprove1789948000000 implements MigrationInterface {
  name = 'AddAutoApprove1789948000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "admin_settings" ("id" character varying NOT NULL, "auto_approve_enabled" boolean NOT NULL DEFAULT false, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_admin_settings_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "job_postings" ADD "auto_approved" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "job_postings" ADD "admin_reviewed" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job_postings" DROP COLUMN "admin_reviewed"`);
    await queryRunner.query(`ALTER TABLE "job_postings" DROP COLUMN "auto_approved"`);
    await queryRunner.query(`DROP TABLE "admin_settings"`);
  }
}
