import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 24 (29/09/2026) — hệ thống banner quảng cáo: bảng chiến dịch + bảng thống kê theo ngày, và 2 công tắc
// chung trong admin_settings (bật/tắt toàn bộ quảng cáo, danh sách vùng đang tắt). Chỉ thêm mới.
export class AddAdCampaigns1789956000000 implements MigrationInterface {
  name = 'AddAdCampaigns1789956000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ad_campaigns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "eyebrow" character varying(40),
        "title" character varying(90) NOT NULL,
        "subtitle" character varying(180),
        "cta_text" character varying(30),
        "url" character varying(1000) NOT NULL,
        "add_utm" boolean NOT NULL DEFAULT true,
        "bg_mode" character varying NOT NULL DEFAULT 'generated',
        "bg_prompt" character varying(300) NOT NULL DEFAULT '',
        "bg_theme" character varying,
        "bg_seed" integer NOT NULL DEFAULT 0,
        "bg_image_data" bytea,
        "bg_image_key" character varying,
        "bg_image_mime" character varying,
        "bg_image_tone" character varying,
        "text_color" character varying NOT NULL DEFAULT 'auto',
        "slots" jsonb NOT NULL DEFAULT '["*"]',
        "audiences" jsonb NOT NULL DEFAULT '[]',
        "device" character varying NOT NULL DEFAULT 'all',
        "weight" integer NOT NULL DEFAULT 5,
        "starts_at" TIMESTAMP WITH TIME ZONE,
        "ends_at" TIMESTAMP WITH TIME ZONE,
        "enabled" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ad_campaigns" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_ad_campaigns_enabled" ON "ad_campaigns" ("enabled")`,
    );
    await queryRunner.query(`
      CREATE TABLE "ad_campaign_stats" (
        "campaign_id" uuid NOT NULL,
        "slot" character varying NOT NULL,
        "day" date NOT NULL,
        "impressions" integer NOT NULL DEFAULT 0,
        "clicks" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_ad_campaign_stats" PRIMARY KEY ("campaign_id", "slot", "day"),
        CONSTRAINT "FK_ad_campaign_stats_campaign" FOREIGN KEY ("campaign_id")
          REFERENCES "ad_campaigns"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD "ads_enabled" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" ADD "ad_disabled_slots" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin_settings" DROP COLUMN "ad_disabled_slots"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_settings" DROP COLUMN "ads_enabled"`,
    );
    await queryRunner.query(`DROP TABLE "ad_campaign_stats"`);
    await queryRunner.query(`DROP TABLE "ad_campaigns"`);
  }
}
