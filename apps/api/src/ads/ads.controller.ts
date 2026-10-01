import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../database/entities/user.entity';
import { AdsService } from './ads.service';
import { AdSettingsDto, SaveAdDto } from './dto/save-ad.dto';
import { loadMonitor } from '../common/load-monitor';

type Actor = { userId: string; email: string };

// Đợt 24 (29/09/2026) — banner quảng cáo, phần CÔNG KHAI (không cần đăng nhập).
// Đường dẫn chính /public/promos (tên trung tính để trình chặn quảng cáo không chặn nhầm); giữ /public/ads
// cho bản web cũ đang chạy trong lúc Vercel/Render cập nhật lệch nhau.
@Controller(['public/promos', 'public/ads'])
export class PublicAdsController {
  constructor(private readonly ads: AdsService) {}

  @Get()
  feed() {
    return this.ads.publicFeed();
  }

  // Lượt hiển thị / bấm (text/plain qua sendBeacon — xem main.ts). Không bao giờ trả lỗi cho trình duyệt.
  @Post('events')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async events(@Body() body: unknown, @Req() req: Request) {
    if (loadMonitor.level() >= 2) return; // Đợt 94 — quá tải: bỏ qua lượt hiển thị banner (việc phụ)
    await this.ads.recordEvents(body, req.headers['user-agent']).catch(() => 0);
  }

  @Get(':id/image')
  async image(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const img = await this.ads.image(id);
    if (!img) throw new NotFoundException('Không có ảnh nền');
    // Đường dẫn ảnh có ?v=<thời điểm sửa> nên cho trình duyệt/CDN giữ lâu.
    res.set({
      'Content-Type': img.mime,
      'Cache-Control': 'public, max-age=604800, immutable',
    });
    res.send(img.data);
  }
}

@Controller('admin/ads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AdminAdsController {
  constructor(private readonly ads: AdsService) {}

  @Get()
  list(@Query('days') days?: string) {
    return this.ads.list(days ? Number(days) : 30);
  }

  @Get('settings')
  settings() {
    return this.ads.getSettings();
  }

  @Patch('settings')
  setSettings(@CurrentUser() admin: Actor, @Body() dto: AdSettingsDto) {
    return this.ads.setSettings(admin, dto);
  }

  @Get('stats')
  stats(@Query('days') days?: string) {
    return this.ads.stats(days ? Number(days) : 30);
  }

  @Post()
  create(@CurrentUser() admin: Actor, @Body() dto: SaveAdDto) {
    return this.ads.create(admin, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() admin: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveAdDto,
  ) {
    return this.ads.update(admin, id, dto);
  }

  @Patch(':id/enabled')
  setEnabled(
    @CurrentUser() admin: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('enabled') enabled: boolean,
  ) {
    return this.ads.setEnabled(admin, id, !!enabled);
  }

  @Post(':id/duplicate')
  duplicate(
    @CurrentUser() admin: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ads.duplicate(admin, id);
  }

  @Delete(':id')
  remove(@CurrentUser() admin: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.ads.remove(admin, id);
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  setImage(
    @CurrentUser() admin: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('tone') tone?: string,
  ) {
    return this.ads.setImage(admin, id, file, tone);
  }

  @Delete(':id/image')
  removeImage(
    @CurrentUser() admin: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ads.removeImage(admin, id);
  }
}
