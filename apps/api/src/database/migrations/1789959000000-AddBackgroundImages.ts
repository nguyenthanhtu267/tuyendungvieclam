import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 30b — ảnh nền tải lên. Chỉ thêm bảng mới.
export class AddBackgroundImages1789959000000 implements MigrationInterface {
  name = 'AddBackgroundImages1789959000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "bg_images" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "name" character varying(120) NOT NULL,
      "mime" character varying NOT NULL,
      "data" bytea,
      "storage_key" character varying,
      "overlay" integer NOT NULL DEFAULT 78,
      "width" integer NOT NULL DEFAULT 0,
      "height" integer NOT NULL DEFAULT 0,
      "bytes" integer NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_bg_images" PRIMARY KEY ("id")
    )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "bg_images"`);
  }
}
