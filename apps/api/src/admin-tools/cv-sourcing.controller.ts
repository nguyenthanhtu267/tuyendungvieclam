import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../database/entities/user.entity';
import { BulkIdsDto } from '../admin/dto/bulk-ids.dto';
import { parseDraftPayload } from '../common/dto/candidate-draft.dto';
import {
  cvUploadInterceptor,
  sendCvFile,
} from '../cv-archive/cv-archive.controller';
import { CvArchiveService } from '../cv-archive/cv-archive.service';
import { CvSourcingService } from './cv-sourcing.service';
import { AdminActor } from './admin-audit';
import {
  CreateProfileRequestDto,
  ListQueryDto,
  QueueQueryDto,
  RejectRequestDto,
  RequestsQueryDto,
  ResolveRequestDto,
  SetAutoShareDto,
} from './dto/admin-tools.dto';

// Đợt 18c (26/09/2026) — Admin "Nguồn ngoài → CV ứng viên" (xem cv-sourcing.service.ts).
@Controller('admin/cv-sourcing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class CvSourcingController {
  constructor(
    private readonly sourcing: CvSourcingService,
    private readonly cvArchiveService: CvArchiveService,
  ) {}

  @Get('summary')
  summary() {
    return this.sourcing.summary();
  }

  @Get('settings/auto-share')
  getAutoShare() {
    return this.sourcing.getAutoShare();
  }

  @Patch('settings/auto-share')
  setAutoShare(@CurrentUser() admin: AdminActor, @Body() dto: SetAutoShareDto) {
    return this.sourcing.setAutoShare(admin, dto.enabled);
  }

  @Get('queue')
  listQueue(@Query() query: QueueQueryDto) {
    return this.sourcing.listQueue(query);
  }

  // Các route literal 2 đoạn đặt TRƯỚC 'queue/:id/...'.
  @Post('queue/bulk-share')
  bulkShare(@CurrentUser() admin: AdminActor, @Body() dto: BulkIdsDto) {
    return this.sourcing.bulkShare(admin, dto.ids);
  }

  @Post('queue/bulk-dismiss')
  bulkDismiss(@CurrentUser() admin: AdminActor, @Body() dto: BulkIdsDto) {
    return this.sourcing.dismissCards(admin, dto.ids);
  }

  @Get('queue/:id/draft')
  getDraft(@Param('id', ParseUUIDPipe) id: string) {
    return this.sourcing.getCardDraft(id);
  }

  // Body tuỳ chọn { draft } — Admin đã sửa lại bản nháp trên form trước khi duyệt.
  @Post('queue/:id/share')
  share(
    @CurrentUser() admin: AdminActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { draft?: unknown },
  ) {
    const override = body?.draft ? parseDraftPayload(body.draft) : undefined;
    return this.sourcing.shareCard(admin, id, override);
  }

  @Post('queue/:id/dismiss')
  dismiss(
    @CurrentUser() admin: AdminActor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sourcing.dismissCards(admin, [id]);
  }

  @Post('queue/:id/requeue')
  requeue(
    @CurrentUser() admin: AdminActor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sourcing.requeueCard(admin, id);
  }

  @Get('entries/:entryId/file')
  async getFile(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Res() res: Response,
  ) {
    sendCvFile(
      res,
      await this.cvArchiveService.getFileForCompany(null, entryId),
    );
  }

  @Get('profiles')
  listSourced(@Query() query: ListQueryDto) {
    return this.sourcing.listSourced(query);
  }

  // multipart: `payload` (JSON bản nháp) + `file` (tuỳ chọn — lưu kèm làm CV của hồ sơ).
  @Post('profiles')
  @UseInterceptors(cvUploadInterceptor)
  createSourced(
    @CurrentUser() admin: AdminActor,
    @Body('payload') payload: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.sourcing.createSourced(
      admin,
      parseDraftPayload(payload),
      file ?? null,
    );
  }

  @Delete('profiles/:id')
  deleteSourced(
    @CurrentUser() admin: AdminActor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sourcing.deleteSourced(admin, id);
  }

  @Get('requests')
  listRequests(@Query() query: RequestsQueryDto) {
    return this.sourcing.listRequests(query.status ?? 'pending');
  }

  @Post('requests/:id/remove')
  resolveRemove(
    @CurrentUser() admin: AdminActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveRequestDto,
  ) {
    return this.sourcing.resolveRemove(admin, id, dto.profileId, dto.adminNote);
  }

  @Post('requests/:id/claim')
  resolveClaim(
    @CurrentUser() admin: AdminActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveRequestDto,
  ) {
    return this.sourcing.resolveClaim(admin, id, dto.profileId, dto.adminNote);
  }

  @Post('requests/:id/reject')
  reject(
    @CurrentUser() admin: AdminActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRequestDto,
  ) {
    return this.sourcing.rejectRequest(admin, id, dto.adminNote);
  }
}

// Đợt 18c — trang công khai "Yêu cầu gỡ hoặc nhận lại hồ sơ" (không cần đăng nhập, giới hạn 5 lần/phút
// theo IP để chống spam).
@Controller('public')
export class PublicProfileRequestController {
  constructor(private readonly sourcing: CvSourcingService) {}

  @Post('candidate-profile-requests')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@Body() dto: CreateProfileRequestDto) {
    return this.sourcing.createPublicRequest(dto);
  }
}
