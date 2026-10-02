import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../database/entities/user.entity';
import { AdminActor } from '../admin-tools/admin-audit';
import { SourcedInput, WorkerSourcingService } from './worker-sourcing.service';

// Đợt 136 — chính chủ gỡ / nhận lại hồ sơ lao động (công khai)
@Controller('public/workers')
export class WorkerSourcingPublicController {
  constructor(private readonly svc: WorkerSourcingService) {}
  @Throttle({ default: { ttl: 60_000, limit: 8 } })
  @Post('sourced/request')
  request(@Body() b: { phone?: string; birth?: string; type?: string }) {
    return this.svc.publicClaimOrRemove(b ?? {});
  }
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkerSourcingController {
  constructor(private readonly svc: WorkerSourcingService) {}

  // ----- Admin -----
  @Post('admin/workers/sourced/preview-post')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  previewPost(@Body('text') text: string) {
    return this.svc.previewPost(text);
  }
  @Post('admin/workers/sourced/preview-table')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  previewTable(@Body('text') text: string) {
    return this.svc.previewTable(text);
  }
  @Post('admin/workers/sourced/save')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  save(@CurrentUser() a: AdminActor, @Body() b: { rows?: SourcedInput[]; label?: string }) {
    return this.svc.adminSave(a, b ?? {});
  }
  @Delete('admin/workers/sourced/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  del(@CurrentUser() a: AdminActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.adminDelete(a, id);
  }
  @Get('admin/workers/share-queue')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  queue(@Query() q: { status?: string; page?: string }) {
    return this.svc.queueList(q ?? {});
  }
  @Post('admin/workers/share-queue/act')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  act(@CurrentUser() a: AdminActor, @Body() b: { ids?: string[]; action?: string }) {
    return this.svc.queueAct(a, b?.ids ?? [], String(b?.action ?? ''));
  }
  @Put('admin/workers/share-queue/auto')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  auto(@CurrentUser() a: AdminActor, @Body('enabled') enabled: boolean) {
    return this.svc.setAutoShare(a, !!enabled);
  }
  @Get('admin/workers/phone-views')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  phoneViews(@Query() q: { companyId?: string; page?: string }) {
    return this.svc.phoneViewLog(q ?? {});
  }

  // ----- NTD -----
  @Get('employer/worker-stock')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  myStock(@CurrentUser() u: { userId: string }, @Query() q: { page?: string; q?: string }) {
    return this.svc.myStock(u.userId, q ?? {});
  }
  @Post('employer/worker-stock/preview-post')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  myPreviewPost(@CurrentUser() u: { userId: string }, @Body('text') text: string) {
    return this.svc.myPreviewPost(u.userId, text);
  }
  @Post('employer/worker-stock/preview-table')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  myPreviewTable(@CurrentUser() u: { userId: string }, @Body('text') text: string) {
    return this.svc.myPreviewTable(u.userId, text);
  }
  @Post('employer/worker-stock/save')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  mySave(@CurrentUser() u: { userId: string }, @Body() b: { rows?: SourcedInput[] }) {
    return this.svc.mySave(u.userId, b ?? {});
  }
  @Delete('employer/worker-stock/:id')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  myDelete(@CurrentUser() u: { userId: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.myDelete(u.userId, id);
  }
  @Get('employer/workers/phone-quota')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  quota(@CurrentUser() u: { userId: string }) {
    return this.svc.phoneQuota(u.userId);
  }
  @Post('employer/workers/:id/reveal-phone')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  reveal(@CurrentUser() u: { userId: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.revealPhone(u.userId, id);
  }
}
