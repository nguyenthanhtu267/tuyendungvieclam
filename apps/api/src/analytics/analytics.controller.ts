import {
  Body,
  Controller,
  Logger,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';
import { AnalyticsIngestService } from './analytics-ingest.service';
import { AnalyticsReportService } from './analytics-report.service';
import { detectBot } from './ua.util';

function ownHost(req: Request): string | null {
  const origin =
    (req.headers.origin as string) || (req.headers.referer as string) || '';
  try {
    return origin ? new URL(origin).hostname : null;
  } catch {
    return null;
  }
}

// Đợt 19 (26/09/2026) — công khai: trình duyệt gửi lô dữ liệu truy cập (sendBeacon, text/plain).
// Không dùng giới hạn mặc định 100 lần/phút theo IP (nhiều người cùng mạng công ty/NAT) — service tự
// giới hạn theo mã trình duyệt.
@Controller('analytics')
@SkipThrottle()
export class AnalyticsCollectController {
  private readonly logger = new Logger('Analytics');
  constructor(private readonly ingest: AnalyticsIngestService) {}

  @Post('collect')
  @HttpCode(HttpStatus.NO_CONTENT)
  async collect(@Body() body: unknown, @Req() req: Request) {
    await this.ingest
      .collect(body, req.headers['user-agent'], ownHost(req))
      .catch((err) =>
        // Không bao giờ trả lỗi cho trình duyệt (bộ ghi chạy ngầm), nhưng ghi log để dễ truy vết.
        this.logger.warn(
          `Ghi truy cập lỗi: ${err instanceof Error ? err.message : err}`,
        ),
      );
  }

  // Bot không chạy JavaScript (Googlebot, xem trước link Facebook...) — middleware của Next.js báo về
  // để Admin biết bot nào ghé (không tính vào số liệu người thật).
  @Post('bot-hit')
  @SkipThrottle({ default: false })
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async botHit(@Body() body: { ua?: string }) {
    const bot = detectBot(typeof body?.ua === 'string' ? body.ua : '');
    if (bot) await this.ingest.recordBot(bot).catch(() => undefined);
  }
}

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AnalyticsAdminController {
  constructor(private readonly reports: AnalyticsReportService) {}

  @Get('realtime')
  realtime() {
    return this.reports.realtime();
  }

  @Get('overview')
  overview(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.overview(from, to);
  }

  @Get('content')
  content(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.content(from, to);
  }

  @Get('behavior')
  behavior(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.behavior(from, to);
  }

  @Get('heatmap/pages')
  heatmapPages(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.heatmapPages(from, to);
  }

  @Get('heatmap')
  heatmap(
    @Query('route') route: string,
    @Query('device') device: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('path') path?: string,
  ) {
    return this.reports.heatmap(route, device, from, to, path || undefined);
  }
}
