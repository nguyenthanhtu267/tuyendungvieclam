import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 93 — chỉ mục một phần cho hồ sơ lao động ĐANG TÌM VIỆC (không ẩn): các màn hình nhà tuyển dụng (tìm hồ sơ, giờ vàng, thống kê quận/huyện)
// luôn lọc is_hidden=false + is_seeking=true rồi xếp theo ngày làm mới → truy vấn lấy tối đa 3.000 hồ sơ không còn quét cả bảng.
export class AddWorkerIndexes1789975000000 implements MigrationInterface {
  name = 'AddWorkerIndexes1789975000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_worker_open_kind_refreshed" ON "worker_profiles" ("kind", "refreshed_at" DESC) WHERE "is_hidden" = false AND "is_seeking" = true`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_worker_open_kind_refreshed"`);
  }
}
