import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Application, ApplicationStatus } from './application.entity';

// Đợt 12o (21/09/2026) — "Nhật ký/lịch sử trạng thái ứng tuyển": 1 trong các tính năng thông minh
// người dùng chọn cho ứng viên. Mỗi lần trạng thái đơn ứng tuyển đổi (kể cả lúc tạo mới = 'new'),
// ghi 1 dòng ở đây — ApplicationsService.apply() ghi dòng đầu, EmployerService.updateApplicationStatus()
// ghi các dòng sau. Dùng LẠI enum "applications_status_enum" đã có sẵn ở bảng applications (qua
// enumName) thay vì tạo type Postgres mới trùng giá trị — xem migration AddApplicationStatusHistory.
@Index(['applicationId', 'createdAt'])
@Entity({ name: 'application_status_histories' })
export class ApplicationStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'application_id' })
  applicationId: string;

  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: Application;

  @Column({ type: 'enum', enum: ApplicationStatus, enumName: 'applications_status_enum' })
  status: ApplicationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
