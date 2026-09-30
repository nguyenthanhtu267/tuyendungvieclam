import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../database/entities/notification.entity';
import { MailService } from './mail.service';

// Đợt 12m (21/09/2026) — "chuông thông báo hoạt động thật": trước đây bảng `notifications` tồn tại
// nhưng KHÔNG có service nào tạo bản ghi, chuông trên header chỉ hiện tĩnh "Chưa có thông báo nào".
// NotificationsService là điểm gọi chung cho mọi module (admin/employer/cv-search/candidates...) khi
// có sự kiện cần báo cho người dùng — hiển thị trong web (chuông); từ Đợt 48 gửi kèm EMAIL cho các loại
// quan trọng khi đã cấu hình SMTP (xem mail.service.ts).
export const NOTIFICATION_LIST_LIMIT = 30;

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly mail: MailService,
  ) {}

  async create(
    userId: string,
    type: string,
    content: string,
    link?: string,
  ): Promise<Notification> {
    const saved = await this.notificationRepo.save(
      this.notificationRepo.create({
        userId,
        type,
        content,
        link: link ?? null,
      }),
    );
    this.mail.notify([userId], type, content, link); // Đợt 48 — email (nếu đã cấu hình SMTP)
    return saved;
  }

  // Nhiều người nhận cùng lúc (VD: tin công ty có nhiều tài khoản Chính/Phụ) — dùng khi duyệt
  // tin/công ty ở admin.service.ts.
  async createMany(
    userIds: string[],
    type: string,
    content: string,
    link?: string,
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
    if (uniqueIds.length === 0) return;
    await this.notificationRepo.save(
      uniqueIds.map((userId) =>
        this.notificationRepo.create({
          userId,
          type,
          content,
          link: link ?? null,
        }),
      ),
    );
    this.mail.notify(uniqueIds, type, content, link); // Đợt 48 — email (nếu đã cấu hình SMTP)
  }

  async list(
    userId: string,
    limit = NOTIFICATION_LIST_LIMIT,
  ): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({ where: { userId, isRead: false } });
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const notif = await this.notificationRepo.findOne({ where: { id } });
    if (!notif || notif.userId !== userId)
      throw new NotFoundException('Không tìm thấy thông báo');
    notif.isRead = true;
    return this.notificationRepo.save(notif);
  }

  async markAllRead(userId: string): Promise<{ success: true }> {
    await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true },
    );
    return { success: true };
  }
}
