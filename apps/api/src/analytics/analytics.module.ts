import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { resolveJwtSecret } from '../config/env-guard';
import { PresenceModule } from '../presence/presence.module';
import { AnalyticsIngestService } from './analytics-ingest.service';
import { AnalyticsRollupService } from './analytics-rollup.service';
import { AnalyticsReportService } from './analytics-report.service';
import {
  AnalyticsAdminController,
  AnalyticsCollectController,
} from './analytics.controller';

// Đợt 19 (26/09/2026) — phân tích truy cập thật (bộ ghi + cộng dồn theo ngày + báo cáo Admin).
@Module({
  imports: [
    PresenceModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: resolveJwtSecret(configService.get<string>('JWT_SECRET')),
      }),
    }),
  ],
  providers: [
    AnalyticsIngestService,
    AnalyticsRollupService,
    AnalyticsReportService,
  ],
  controllers: [AnalyticsCollectController, AnalyticsAdminController],
})
export class AnalyticsModule {}
