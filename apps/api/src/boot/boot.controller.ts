import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { AdminService } from '../admin/admin.service';
import { BackgroundService } from '../background/background.service';
import { AdsService } from '../ads/ads.service';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';
import { VitalsService } from './vitals.service';
import { loadMonitor } from '../common/load-monitor';

// Đợt 93 — GỘP 3 lần gọi công khai mà MỌI trang đều gọi khi mở lần đầu (nền, khuyến mãi/banner, nhãn logo)
// thành 1 lần: trên điện thoại + máy chủ Render ở xa, mỗi vòng gọi tốn ~150–400ms nên gộp lại nhanh rõ rệt.
// Từng phần lỗi thì trả null cho phần đó (web tự dùng giá trị mặc định) — không bao giờ làm hỏng cả gói.
@Controller('public/boot')
export class BootController {
  constructor(
    private readonly admin: AdminService,
    private readonly bg: BackgroundService,
    private readonly ads: AdsService,
  ) {}

  @Get()
  async boot() {
    const [background, promos, badge] = await Promise.all([
      this.bg.get().catch(() => null),
      this.ads.publicFeed().catch(() => null),
      this.admin.getPublicPromoBadge().catch(() => null),
    ]);
    return { background, promos, badge };
  }
}

// Đợt 93 — nhận số đo tốc độ thật từ trình duyệt (sendBeacon text/plain) và cho Admin xem.

@Controller('analytics')
@SkipThrottle()
export class VitalsCollectController {
  constructor(private readonly vitals: VitalsService) {}

  @Post('vitals')
  @HttpCode(HttpStatus.NO_CONTENT)
  async collect(@Body() body: unknown) {
    if (loadMonitor.level() >= 1) return; // Đợt 94 — đang bận: bỏ qua số đo (việc phụ)
    await this.vitals.record(body).catch(() => undefined); // không bao giờ báo lỗi cho trình duyệt
  }
}

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class VitalsAdminController {
  constructor(private readonly vitals: VitalsService) {}

  @Get('vitals')
  summary(@Query('days') days?: string) {
    return this.vitals.summary(Number(days) || 7);
  }
}
