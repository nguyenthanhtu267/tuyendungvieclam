import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 12q (21/09/2026) — Batch 5 mục #4 "Nhật ký thao tác admin": bảng mới ghi lại các hành động
// Admin/Moderator thực hiện (duyệt/từ chối tin & công ty, duyệt hàng loạt, đặt lại mật khẩu, xác nhận
// thanh toán, bật/tắt "Doanh nghiệp yêu thích"). Không backfill — chỉ ghi nhận hành động TỪ đợt này
// trở đi, không suy diễn ngược lịch sử duyệt trước đó (dữ liệu không có sẵn để tái tạo chính xác).
export class AddAdminAuditLog1789941600000 implements MigrationInterface {
  name = 'AddAdminAuditLog1789941600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "admin_user_id" uuid NOT NULL,
        "admin_email" character varying NOT NULL,
        "action" character varying NOT NULL,
        "target_type" character varying NOT NULL,
        "target_id" character varying,
        "description" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_audit_logs_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_admin_audit_logs_created_at" ON "admin_audit_logs" ("created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_admin_audit_logs_created_at"`);
    await queryRunner.query(`DROP TABLE "admin_audit_logs"`);
  }
}
