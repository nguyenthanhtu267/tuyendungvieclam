import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../database/entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// Đợt 12m (21/09/2026) — export NotificationsService để các module khác (admin/employer/cv-search)
// import NotificationsModule và tự tạo thông báo khi có sự kiện liên quan (tin được duyệt, hồ sơ
// được xem, đơn ứng tuyển đổi trạng thái...).
@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
