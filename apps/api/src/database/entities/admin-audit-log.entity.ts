import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// Đợt 12q (21/09/2026) — Batch 5 mục #4 "Nhật ký thao tác admin": ghi lại mỗi hành động thay đổi dữ
// liệu do Admin/Moderator thực hiện (duyệt/từ chối tin & công ty — kể cả duyệt hàng loạt, đặt lại mật
// khẩu, xác nhận thanh toán, bật/tắt "Doanh nghiệp yêu thích") để tra cứu "ai đã làm gì, lúc nào" khi
// có khiếu nại/tranh chấp. Lưu thẳng adminEmail (thay vì chỉ adminUserId + join User) vì đây là bản ghi
// lịch sử — nếu tài khoản admin bị xoá sau này, nhật ký vẫn đọc được đã có ai thao tác.
@Entity({ name: 'admin_audit_logs' })
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'admin_user_id' })
  adminUserId: string;

  @Column({ name: 'admin_email' })
  adminEmail: string;

  // Dạng "<đối_tượng>.<hành_động>", ví dụ: 'job.approve', 'job.reject', 'job.bulk_approve',
  // 'company.approve', 'company.toggle_featured', 'order.confirm_payment', 'user.reset_password'.
  @Column()
  action: string;

  @Column({ name: 'target_type' })
  targetType: string;

  // Nullable vì hành động hàng loạt có nhiều target — targetId để trống, chi tiết nằm ở description.
  @Column({ name: 'target_id', nullable: true })
  targetId?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
