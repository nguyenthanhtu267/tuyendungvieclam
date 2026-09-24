import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Company } from './company.entity';

// Đợt 12ac (24/09/2026) — "Quản lý địa điểm làm việc" (theo mẫu careerviet.vn): NTD lưu sẵn danh
// sách địa điểm công ty hay tuyển, chọn nhanh khi đăng tin thay vì gõ lại địa chỉ mỗi lần. Bản đơn
// giản hoá theo quyết định đã chốt trước đây — KHÔNG có bản đồ thật (Goong Maps là dịch vụ trả phí,
// chưa kết nối), chỉ lưu tỉnh/thành + quận huyện + địa chỉ chi tiết dạng text.
@Entity({ name: 'work_locations' })
export class WorkLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  // Tên gợi nhớ do NTD tự đặt, VD "Văn phòng chính Q1", "Chi nhánh Thủ Đức".
  @Column()
  label: string;

  @Column()
  province: string;

  @Column({ nullable: true })
  district?: string;

  @Column({ nullable: true })
  address?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
