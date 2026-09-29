import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AdCampaign,
  AdCampaignStat,
} from '../database/entities/ad-campaign.entity';
import { AdminSetting } from '../database/entities/admin-setting.entity';
import { AdminAuditLog } from '../database/entities/admin-audit-log.entity';
import { AdsService } from './ads.service';
import { AdminAdsController, PublicAdsController } from './ads.controller';

// Đợt 24 (29/09/2026) — banner quảng cáo (FileStorageService đến từ StorageModule @Global).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdCampaign,
      AdCampaignStat,
      AdminSetting,
      AdminAuditLog,
    ]),
  ],
  controllers: [PublicAdsController, AdminAdsController],
  providers: [AdsService],
})
export class AdsModule {}
