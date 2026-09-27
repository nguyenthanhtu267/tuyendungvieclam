import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../database/entities/user.entity';
import type { AdminActor } from '../admin-tools/admin-audit';
import { FileStorageService } from './file-storage.service';

function redirectUri(storage: FileStorageService, req: Request): string {
  const proto =
    (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() ||
    req.protocol;
  const host =
    (req.headers['x-forwarded-host'] as string) ||
    req.headers.host ||
    'localhost:3001';
  return storage.redirectUriFor(proto, host);
}

// Đợt 20 (27/09/2026) — Admin quản lý nơi lưu file (Google Drive). Chỉ Admin (không phải Điều phối viên)
// được kết nối/ngắt kết nối vì đây là tài khoản Google cá nhân của chủ web.
@Controller('admin/storage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StorageAdminController {
  constructor(private readonly storage: FileStorageService) {}

  @Get('status')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  status(@Req() req: Request) {
    return this.storage.status(redirectUri(this.storage, req));
  }

  @Get('google/connect-url')
  @Roles(UserRole.ADMIN)
  connectUrl(
    @CurrentUser() admin: AdminActor,
    @Query('returnTo') returnTo: string,
    @Req() req: Request,
  ) {
    return {
      url: this.storage.connectUrl(
        admin,
        redirectUri(this.storage, req),
        returnTo,
      ),
    };
  }

  @Post('google/disconnect')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  disconnect(@CurrentUser() admin: AdminActor) {
    return this.storage.disconnect(admin);
  }

  @Post('migration')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  migration(
    @CurrentUser() admin: AdminActor,
    @Body() body: { paused?: boolean },
  ) {
    return this.storage.setMigrationPaused(admin, !!body?.paused);
  }

  // Chạy ngay 1 lượt chuyển file (không chờ vòng 2 phút) — tối đa ~20 giây.
  @Post('migrate-now')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async migrateNow() {
    const moved = await this.storage.migrateStep(20_000);
    return { moved };
  }

  // Dọn ngay file thừa trên Drive (file của CV/tài khoản đã xoá, ảnh đã thay...) — cũ hơn 1 giờ.
  @Post('cleanup-now')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async cleanupNow() {
    const removed = await this.storage.collectOrphans();
    return { removed };
  }
}

// Google chuyển trình duyệt của chủ web về đây sau khi bấm "Cho phép" (công khai — xác thực bằng `state`
// đã ký, hết hạn sau 15 phút).
@Controller('storage/google')
@SkipThrottle()
export class StorageCallbackController {
  constructor(private readonly storage: FileStorageService) {}

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    try {
      res.redirect(await this.storage.handleCallback(code, state, error));
    } catch (err) {
      res
        .status(400)
        .type('text/html; charset=utf-8')
        .send(
          `<p style="font-family:sans-serif">${(err as Error).message.replace(/</g, '&lt;')}</p>`,
        );
    }
  }
}
