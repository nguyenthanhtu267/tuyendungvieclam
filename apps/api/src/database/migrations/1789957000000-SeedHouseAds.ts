import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 28 (30/09/2026) — 4 banner "quảng bá chính website" có sẵn để các vùng banner mới không bị trống ngay từ đầu.
// Chỉ chèn khi hệ thống có ít hơn 4 chiến dịch (không thêm chồng lên chiến dịch Admin đã tự tạo). Link nội bộ,
// Admin có thể sửa / tắt / xoá ở tab "Banner quảng cáo". Không đụng cấu trúc bảng.
export class SeedHouseAds1789957000000 implements MigrationInterface {
  name = 'SeedHouseAds1789957000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ n }] = await queryRunner.query(`SELECT COUNT(*)::int AS n FROM "ad_campaigns"`);
    if (n >= 4) return;
    const rows: [string, string, string, string, string, string, string, string, string[], string][] = [
      ['Website – Việc làm mới mỗi ngày', 'Cập nhật liên tục', 'Hàng nghìn việc làm mới mỗi ngày', 'Lọc theo ngành, địa điểm, mức lương — ứng tuyển chỉ trong 3 bước.', 'Tìm việc ngay', '/viec-lam', 'việc làm, tìm kiếm, cơ hội, công nghệ hiện đại', 'ocean', ['guest', 'candidate'], '6'],
      ['Website – Đăng tin miễn phí', 'Dành cho nhà tuyển dụng', 'Đăng tin tuyển dụng MIỄN PHÍ', 'Tiếp cận ứng viên phù hợp, tin được duyệt nhanh.', 'Đăng tin ngay', '/nha-tuyen-dung/dashboard', 'tuyển dụng, doanh nghiệp, nhân sự, chuyển đổi số', 'brand', ['guest', 'employer'], '6'],
      ['Website – Hồ sơ trực tuyến', 'Cho ứng viên', 'Tạo hồ sơ — nhà tuyển dụng tự tìm bạn', 'Một hồ sơ trực tuyến, hàng trăm cơ hội việc làm phù hợp.', 'Tạo hồ sơ', '/ho-so', 'hồ sơ cá nhân, kỹ năng, sự nghiệp, công nghệ', 'emerald', ['guest', 'candidate'], '5'],
      ['Website – Phần mềm nhân sự', 'Giải pháp số', 'Phần mềm Nhân sự Toàn diện', 'Số hoá tuyển dụng và quản trị nhân sự trên một nền tảng.', 'Tìm hiểu thêm', '/', 'phần mềm, nhân sự, chuyển đổi số, dữ liệu, công nghệ', 'tech', [], '4'],
    ];
    for (const r of rows) {
      await queryRunner.query(
        `INSERT INTO "ad_campaigns" ("name","eyebrow","title","subtitle","cta_text","url","add_utm","bg_mode","bg_prompt","bg_theme","bg_seed","text_color","slots","audiences","device","weight","enabled")
         VALUES ($1,$2,$3,$4,$5,$6,false,'generated',$7,$8,$9,'auto','["*"]'::jsonb,$10::jsonb,'all',$11,true)`,
        [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], Number(r[9]) % 5, JSON.stringify(r[8]), Number(r[9])],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "ad_campaigns" WHERE "name" LIKE 'Website – %'`);
  }
}
