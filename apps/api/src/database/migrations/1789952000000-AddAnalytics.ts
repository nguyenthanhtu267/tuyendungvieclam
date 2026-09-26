import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 19 (26/09/2026) — "Phân tích truy cập THẬT" cho Admin: 5 bảng mới, KHÔNG đụng dữ liệu cũ.
//  - analytics_sessions / analytics_pageviews / analytics_events: dữ liệu chi tiết (giữ 90 ngày, tự xoá).
//  - analytics_daily: số tổng hợp theo ngày giờ Việt Nam (giữ vĩnh viễn).
//  - analytics_bot_hits: bot/công cụ tự động ghé web theo ngày (giữ vĩnh viễn, không tính vào số người thật).
// Mốc thời gian dùng timestamptz để chia ngày theo giờ Việt Nam chính xác bất kể múi giờ máy chủ.
export class AddAnalytics1789952000000 implements MigrationInterface {
  name = 'AddAnalytics1789952000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "analytics_sessions" ("id" uuid NOT NULL, "visitor_id" character varying(64) NOT NULL, "user_id" uuid, "role" character varying(20) NOT NULL DEFAULT 'guest', "is_new_visitor" boolean NOT NULL DEFAULT true, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, "landing_path" character varying(300), "referrer_host" character varying(200), "source" character varying(100) NOT NULL DEFAULT 'Trực tiếp', "channel" character varying(20) NOT NULL DEFAULT 'direct', "utm_source" character varying(100), "utm_medium" character varying(100), "utm_campaign" character varying(150), "device" character varying(10) NOT NULL DEFAULT 'desktop', "browser" character varying(40), "os" character varying(40), "screen_w" integer, "lang" character varying(20), "country" character varying(8), "city" character varying(100), CONSTRAINT "PK_analytics_sessions" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_sessions_started_at" ON "analytics_sessions" ("started_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_sessions_visitor_id" ON "analytics_sessions" ("visitor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_sessions_last_seen_at" ON "analytics_sessions" ("last_seen_at")`,
    );

    await queryRunner.query(
      `CREATE TABLE "analytics_pageviews" ("id" uuid NOT NULL, "session_id" uuid NOT NULL, "visitor_id" character varying(64) NOT NULL, "user_id" uuid, "role" character varying(20) NOT NULL DEFAULT 'guest', "path" character varying(300) NOT NULL, "route" character varying(200) NOT NULL, "entity_type" character varying(20), "entity_id" uuid, "prev_route" character varying(200), "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "duration_ms" integer NOT NULL DEFAULT 0, "max_scroll" smallint NOT NULL DEFAULT 0, "device" character varying(10) NOT NULL DEFAULT 'desktop', CONSTRAINT "PK_analytics_pageviews" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_pageviews_started_at" ON "analytics_pageviews" ("started_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_pageviews_session_id" ON "analytics_pageviews" ("session_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_pageviews_entity" ON "analytics_pageviews" ("entity_type", "entity_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE "analytics_events" ("id" BIGSERIAL NOT NULL, "session_id" uuid NOT NULL, "pageview_id" uuid, "visitor_id" character varying(64) NOT NULL, "user_id" uuid, "role" character varying(20) NOT NULL DEFAULT 'guest', "type" character varying(40) NOT NULL, "route" character varying(200) NOT NULL, "path" character varying(300), "entity_type" character varying(20), "entity_id" uuid, "label" character varying(120), "x" real, "y" integer, "doc_h" integer, "device" character varying(10) NOT NULL DEFAULT 'desktop', "meta" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_analytics_events" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_created_at" ON "analytics_events" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_type_created_at" ON "analytics_events" ("type", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_route_device" ON "analytics_events" ("route", "device")`,
    );

    await queryRunner.query(
      `CREATE TABLE "analytics_daily" ("day" date NOT NULL, "kind" character varying(20) NOT NULL, "key" character varying(300) NOT NULL, "views" integer NOT NULL DEFAULT 0, "visitors" integer NOT NULL DEFAULT 0, "sessions" integer NOT NULL DEFAULT 0, "duration_ms" bigint NOT NULL DEFAULT 0, "duration_n" integer NOT NULL DEFAULT 0, "bounces" integer NOT NULL DEFAULT 0, "events" integer NOT NULL DEFAULT 0, "extra" jsonb, CONSTRAINT "PK_analytics_daily" PRIMARY KEY ("day", "kind", "key"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_daily_kind_day" ON "analytics_daily" ("kind", "day")`,
    );

    await queryRunner.query(
      `CREATE TABLE "analytics_bot_hits" ("day" date NOT NULL, "bot" character varying(60) NOT NULL, "hits" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_analytics_bot_hits" PRIMARY KEY ("day", "bot"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "analytics_bot_hits"`);
    await queryRunner.query(`DROP TABLE "analytics_daily"`);
    await queryRunner.query(`DROP TABLE "analytics_events"`);
    await queryRunner.query(`DROP TABLE "analytics_pageviews"`);
    await queryRunner.query(`DROP TABLE "analytics_sessions"`);
  }
}
