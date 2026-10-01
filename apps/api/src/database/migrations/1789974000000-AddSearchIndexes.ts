import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 90 — chỉ mục cho tìm kiếm công khai khi số tin tăng lên hàng chục nghìn:
// • pg_trgm (GIN) cho tiêu đề tin, tỉnh/thành, tên công ty → `ILIKE '%từ khoá%'` không còn quét cả bảng.
// • chỉ mục một phần cho tin ĐANG TUYỂN (đã duyệt + không tạm ngưng) theo kênh + ngày đăng → danh sách mới nhất.
// Máy chủ CSDL không có pg_trgm → bỏ qua phần trigram, vẫn tạo chỉ mục còn lại.
export class AddSearchIndexes1789974000000 implements MigrationInterface {
  name = 'AddSearchIndexes1789974000000';

  public async up(q: QueryRunner): Promise<void> {
    const avail = await q.query(`SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm'`);
    if (avail.length) {
      await q.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
      await q.query(`CREATE INDEX IF NOT EXISTS "IDX_job_title_trgm" ON "job_postings" USING gin ("title" gin_trgm_ops)`);
      await q.query(`CREATE INDEX IF NOT EXISTS "IDX_job_provinces_trgm" ON "job_postings" USING gin ("provinces" gin_trgm_ops)`);
      await q.query(`CREATE INDEX IF NOT EXISTS "IDX_company_name_trgm" ON "companies" USING gin ("name" gin_trgm_ops)`);
    }
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_job_open_channel_created" ON "job_postings" ("channel", "created_at" DESC) WHERE "approval_status" = 'approved' AND "is_paused" = false`,
    );
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_app_job_applied" ON "applications" ("job_posting_id", "applied_at" DESC)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_app_job_applied"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_job_open_channel_created"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_company_name_trgm"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_job_provinces_trgm"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_job_title_trgm"`);
  }
}
