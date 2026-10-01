import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminSetting } from '../database/entities/admin-setting.entity';
import { AdminAuditLog } from '../database/entities/admin-audit-log.entity';
import { BgImage } from '../database/entities/bg-image.entity';
import { BackgroundService } from './background.service';
import {
  AdminBackgroundController,
  PublicBackgroundController,
} from './background.controller';

// Đợt 30b — nền giao diện (FileStorageService đến từ StorageModule @Global).
@Module({
  imports: [TypeOrmModule.forFeature([AdminSetting, AdminAuditLog, BgImage])],
  controllers: [PublicBackgroundController, AdminBackgroundController],
  providers: [BackgroundService],
  exports: [BackgroundService],
})
export class BackgroundModule {}
