import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 12o (21/09/2026) — "Nhật ký/lịch sử trạng thái ứng tuyển": bảng mới ghi lại mỗi lần trạng
// thái 1 đơn ứng tuyển thay đổi, để ứng viên xem lại dòng thời gian xử lý hồ sơ của mình (GET
// /me/applications/:id/history). Dòng đầu tiên (status='new') được ghi ngay lúc ứng viên nộp hồ sơ;
// các dòng sau ghi mỗi khi NTD đổi trạng thái (xem ApplicationsService.apply() và
// EmployerService.updateApplicationStatus()). Cột status DÙNG LẠI type Postgres đã có sẵn
// "applications_status_enum" (không tạo type mới trùng giá trị) — an toàn vì type này đã tồn tại
// từ InitSchema và không có ràng buộc sở hữu (ownership) theo bảng.
export class AddApplicationStatusHistory1789940720800 implements MigrationInterface {
  name = 'AddApplicationStatusHistory1789940720800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "application_status_histories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "application_id" uuid NOT NULL,
        "status" "public"."applications_status_enum" NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_application_status_histories_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ash_application_id" ON "application_status_histories" ("application_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ash_application_id_created_at" ON "application_status_histories" ("application_id", "created_at")`,
    );
    await queryRunner.query(`
      ALTER TABLE "application_status_histories"
      ADD CONSTRAINT "FK_ash_application_id" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Backfill: mỗi đơn ứng tuyển đã tồn tại trước đợt này ghi 1 dòng lịch sử theo trạng thái hiện
    // tại (kể cả đơn đã bị NTD xoá mềm — lịch sử của ứng viên không phụ thuộc thùng rác của NTD),
    // dùng applied_at làm mốc thời gian thay vì "now()" để dòng thời gian không bị lệch.
    await queryRunner.query(`
      INSERT INTO "application_status_histories" ("application_id", "status", "created_at")
      SELECT "id", "status", "applied_at" FROM "applications"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "application_status_histories" DROP CONSTRAINT "FK_ash_application_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ash_application_id_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ash_application_id"`);
    await queryRunner.query(`DROP TABLE "application_status_histories"`);
  }
}
