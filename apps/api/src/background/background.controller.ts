import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../database/entities/user.entity';
import { BackgroundService } from './background.service';
import {
  UpdateBackgroundDto,
  UpdateBgImageDto,
  UploadBgImageDto,
} from './background.dto';

type Actor = { userId: string; email: string };

// Đợt 30b — nền giao diện, phần CÔNG KHAI (cấu hình + ảnh).
@Controller('public/settings/background')
export class PublicBackgroundController {
  constructor(private readonly bg: BackgroundService) {}

  @Get()
  get() {
    return this.bg.get();
  }

  @Get('image/:id')
  async image(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const img = await this.bg.imageData(id);
    if (!img) throw new NotFoundException('Không có ảnh nền');
    res.set({
      'Content-Type': img.mime,
      'Cache-Control': 'public, max-age=604800, immutable',
    });
    res.send(img.data);
  }
}

@Controller('admin/settings/background')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AdminBackgroundController {
  constructor(private readonly bg: BackgroundService) {}

  @Get()
  get() {
    return this.bg.get();
  }

  @Patch()
  set(@CurrentUser() admin: Actor, @Body() dto: UpdateBackgroundDto) {
    return this.bg.set(admin, dto);
  }

  @Post('images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 4 * 1024 * 1024 },
    }),
  )
  addImage(
    @CurrentUser() admin: Actor,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadBgImageDto,
  ) {
    return this.bg.addImage(admin, file, body);
  }

  @Put('images/:id')
  updateImage(
    @CurrentUser() admin: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBgImageDto,
  ) {
    return this.bg.updateImage(admin, id, dto);
  }

  @Delete('images/:id')
  removeImage(
    @CurrentUser() admin: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bg.removeImage(admin, id);
  }
}
