import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 14 (25/09/2026) — mục 15 danh sách lỗi: "Thông tin liên hệ" đổi sang có thêm 1 khung nhập tự
// do (RichTextEditor) để NTD mô tả thêm ngoài 3 trường có sẵn (Người liên hệ/Email/SĐT — GIỮ NGUYÊN
// không đổi, vẫn dùng để tạo link bấm gọi/gửi mail tự động ở trang chi tiết tin theo lựa chọn người
// dùng qua AskUserQuestion: "Giữ 3 trường ẩn để vẫn có link tự động"). Cột mới, nullable, không ảnh
// hưởng dữ liệu cũ.
//
// LƯU Ý: "Quyền lợi được hưởng" (cột `benefits`) cũng đổi từ mảng chip (simple-array) sang rich text
// tự do (HTML) ở đợt này, nhưng KHÔNG cần migration riêng — cột `benefits` ở CSDL vốn đã là kiểu
// `text` ngay từ đầu (TypeORM `simple-array` chỉ là cách diễn giải phía code, nối các phần tử bằng
// dấu phẩy khi lưu — xem InitSchema.ts dòng khai báo "benefits" text). Dữ liệu tin cũ (dạng
// "Bảo hiểm sức khỏe,Thưởng KPI") vẫn đọc được bình thường, hiển thị dạng text thường (không có định
// dạng HTML) cho tới khi NTD sửa lại tin bằng RichTextEditor mới.
export class AddJobContactNote1789947000000 implements MigrationInterface {
  name = 'AddJobContactNote1789947000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job_postings" ADD "contact_note" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job_postings" DROP COLUMN "contact_note"`);
  }
}
