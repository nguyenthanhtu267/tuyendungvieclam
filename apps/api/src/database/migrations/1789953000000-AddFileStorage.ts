import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 20 (27/09/2026) — lưu file lên Google Drive. Chỉ THÊM cột/bảng mới (cho phép rỗng) — không đụng dữ
// liệu cũ: file đang nằm trong CSDL vẫn đọc được bình thường và được chuyển dần lên Drive sau khi Admin kết nối.
export class AddFileStorage1789953000000 implements MigrationInterface {
  name = 'AddFileStorage1789953000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cvs" ADD "file_storage_key" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_entries" ADD "cv_file_storage_key" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" ADD "legal_doc_storage_key" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "avatar_storage_key" character varying`,
    );

    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD "gdrive_refresh_token_enc" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD "gdrive_account_email" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD "gdrive_connected_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD "gdrive_folders" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD "gdrive_last_error" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD "storage_migration_paused" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(
      `CREATE TABLE "stored_files" ("key" character varying(200) NOT NULL, "category" character varying(20) NOT NULL, "file_name" character varying(300), "size" integer NOT NULL DEFAULT 0, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_stored_files" PRIMARY KEY ("key"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stored_files_category" ON "stored_files" ("category")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "stored_files"`);
    for (const col of [
      'storage_migration_paused',
      'gdrive_last_error',
      'gdrive_folders',
      'gdrive_connected_at',
      'gdrive_account_email',
      'gdrive_refresh_token_enc',
    ])
      await queryRunner.query(
        `ALTER TABLE "admin_settings" DROP COLUMN "${col}"`,
      );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "avatar_storage_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" DROP COLUMN "legal_doc_storage_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_archive_entries" DROP COLUMN "cv_file_storage_key"`,
    );
    await queryRunner.query(`ALTER TABLE "cvs" DROP COLUMN "file_storage_key"`);
  }
}
