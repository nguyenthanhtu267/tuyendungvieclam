import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

// Đợt 15 (25/09/2026) — "Tự động duyệt tin" (theo yêu cầu người dùng): 1 công tắc BẬT/TẮT CHUNG áp
// dụng cho mọi tin đang chờ duyệt (không phải bật riêng từng tin — người dùng chọn phương án này qua
// AskUserQuestion), nên chỉ cần 1 dòng CSDL duy nhất kiểu "singleton" thay vì 1 bảng cấu hình phức
// tạp. `id` luôn cố định = 'singleton' để findOne({ where: { id: 'singleton' } }) luôn ra đúng 1 dòng
// (tạo dòng này nếu chưa có — xem AdminService.getAutoApproveSetting()). Thiết kế dạng key-value đơn
// giản này (khác hẳn 1 cột boolean thẳng trên bảng khác) để dễ mở rộng thêm cờ cấu hình chung khác
// của Admin trong tương lai mà không cần thêm bảng mới mỗi lần.
@Entity({ name: 'admin_settings' })
export class AdminSetting {
  @PrimaryColumn()
  id: string;

  // Mặc định TẮT (theo lựa chọn người dùng qua AskUserQuestion) — Admin tự bấm bật khi muốn dùng,
  // tránh tin xấu/spam bị tự động duyệt ngay từ lúc mới triển khai tính năng này.
  @Column({ name: 'auto_approve_enabled', type: 'boolean', default: false })
  autoApproveEnabled: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
