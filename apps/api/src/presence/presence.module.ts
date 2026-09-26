import { Module } from '@nestjs/common';
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';

@Module({
  controllers: [PresenceController],
  providers: [PresenceService],
  // Đợt 19 — Admin "Phân tích truy cập" đọc cả số online thật lẫn số trang chủ đang hiển thị.
  exports: [PresenceService],
})
export class PresenceModule {}
