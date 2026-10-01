import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../database/entities/user.entity';
import { EmployerSearch, WorkerInput, WorkersService } from './workers.service';
import { LABOR_GROUPS, RADII, SHIFTS } from './labor-groups';
import { geoProvinces, newWards, oldDistricts, oldWards } from './vn-geo';

type U = { userId: string };
const STRICT = { default: { ttl: 60_000, limit: 15 } };

// Đợt 79 — công khai: khách tìm việc lao động phổ thông không cần đăng nhập.
@Controller('public/workers')
export class WorkersPublicController {
  constructor(private readonly svc: WorkersService) {}

  @Get('catalog')
  catalog() {
    return { groups: LABOR_GROUPS, shifts: SHIFTS, radii: RADII, provinces: geoProvinces() };
  }

  @Get('geo/districts')
  districts(@Query('province') province: string) {
    return { items: oldDistricts(province ?? '') };
  }
  @Get('geo/wards')
  wards(@Query('province') province: string, @Query('district') district: string) {
    return { items: oldWards(province ?? '', district ?? '') };
  }
  @Get('geo/new-wards')
  newWardList(@Query('province') province: string) {
    return { items: newWards(province ?? '') };
  }

  @Throttle(STRICT)
  @Post('check')
  check(@Body() b: { phone: string }) {
    return this.svc.check(b?.phone);
  }
  @Throttle(STRICT)
  @Post('verify')
  verify(@Body() b: { phone: string; birthDate: string }) {
    return this.svc.verify(b?.phone, b?.birthDate);
  }
  @Throttle(STRICT)
  @Post('refresh')
  refresh(@Body() b: { phone: string; birthDate: string }) {
    return this.svc.refresh(b?.phone, b?.birthDate);
  }
  @Throttle(STRICT)
  @Post('profile')
  save(@Body() b: WorkerInput) {
    return this.svc.saveGuest(b ?? {});
  }

  // Đợt 80 — duyệt tin kênh phổ thông (gần tôi, KTX/xe, hợp lịch học, đủ người…)
  @Get('browse')
  browse(@Query() q: Record<string, string>) {
    return this.svc.browse(q ?? {});
  }
  // Việc phù hợp với hồ sơ vừa lưu (mặc định xếp theo độ phù hợp, ẩn tin đã đủ người)
  @Get('jobs')
  jobs(@Query() q: Record<string, string>) {
    return this.svc.browse({ sort: 'match', hideFilled: '1', pageSize: '12', ...(q ?? {}) }).then((r) => r.items);
  }
  @Get('salary-stats')
  salary(@Query('kind') kind: string, @Query('group') group?: string, @Query('province') province?: string) {
    return this.svc.salaryStats({ kind, group, province });
  }
  @Get('jobs-by-ids')
  byIds(@Query('ids') ids: string) {
    return this.svc.cards(ids);
  }
  @Throttle(STRICT)
  @Post('applications')
  myApps(@Body() b: { phone: string; birthDate: string }) {
    return this.svc.myApplications(b?.phone, b?.birthDate);
  }
  @Throttle(STRICT)
  @Post('seeking')
  seeking(@Body() b: { phone: string; birthDate: string; seeking?: boolean }) {
    return this.svc.setSeekingGuest(b?.phone, b?.birthDate, b?.seeking !== false);
  }
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('jobs/:id/report')
  report(@Param('id', ParseUUIDPipe) id: string, @Body() b: { reason?: string; note?: string }) {
    return this.svc.reportJob(id, String(b?.reason ?? 'other'), b?.note);
  }
  @Get('jobs/:id/progress')
  progress(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.jobProgress(id);
  }
  @Get('jobs/:id/group/:code')
  group(@Param('id', ParseUUIDPipe) id: string, @Param('code') code: string) {
    return this.svc.groupInfo(id, code);
  }

  @Throttle(STRICT)
  @Post('jobs/:id/apply')
  apply(@Param('id', ParseUUIDPipe) id: string, @Body() b: { phone: string; birthDate: string; group?: string }) {
    return this.svc.quickApply(id, b?.phone, b?.birthDate, b?.group);
  }
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkersController {
  constructor(private readonly svc: WorkersService) {}

  // Ứng viên có tài khoản
  @Get('me/worker-profile')
  @Roles(UserRole.CANDIDATE)
  mine(@CurrentUser() u: U) {
    return this.svc.getMine(u.userId);
  }
  @Post('me/worker-profile')
  @Roles(UserRole.CANDIDATE)
  saveMine(@CurrentUser() u: U, @Body() b: WorkerInput) {
    return this.svc.saveMine(u.userId, b ?? {});
  }
  @Post('me/worker-profile/refresh')
  @Roles(UserRole.CANDIDATE)
  refreshMine(@CurrentUser() u: U) {
    return this.svc.refreshMine(u.userId);
  }
  @Get('me/worker-applications')
  @Roles(UserRole.CANDIDATE)
  myAppsMine(@CurrentUser() u: U) {
    return this.svc.myApplicationsMine(u.userId);
  }
  @Patch('me/worker-profile/seeking')
  @Roles(UserRole.CANDIDATE)
  seekingMine(@CurrentUser() u: U, @Body() b: { seeking?: boolean }) {
    return this.svc.setSeekingMine(u.userId, b?.seeking !== false);
  }
  @Post('me/worker-apply/:id')
  @Roles(UserRole.CANDIDATE)
  applyMine(@CurrentUser() u: U, @Param('id', ParseUUIDPipe) id: string, @Body() b: { group?: string }) {
    return this.svc.quickApplyMine(u.userId, id, b?.group);
  }

  // Nhà tuyển dụng (bắt buộc đăng nhập)
  @Get('employer/workers')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB, UserRole.ADMIN)
  search(@CurrentUser() u: U, @Query() q: EmployerSearch) {
    return this.svc.search(u.userId, q);
  }
  @Get('employer/workers/supply')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB, UserRole.ADMIN)
  supply(@CurrentUser() u: U, @Query() q: EmployerSearch) {
    return this.svc.supply(u.userId, q);
  }
  @Put('employer/workers/:id/contact')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  contact(@CurrentUser() u: U, @Param('id', ParseUUIDPipe) id: string, @Body() b: { status?: string; jobId?: string | null }) {
    return this.svc.setContact(u.userId, id, b ?? {});
  }
  @Patch('employer/worker-applications/:id/status')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  appStatus(@CurrentUser() u: U, @Param('id', ParseUUIDPipe) id: string, @Body() b: { status: string }) {
    return this.svc.setAppStatus(u.userId, id, String(b?.status ?? ''));
  }
  @Patch('employer/jobs/:id/filled')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  filled(@CurrentUser() u: U, @Param('id', ParseUUIDPipe) id: string, @Body() b: { filled?: boolean }) {
    return this.svc.setFilled(u.userId, id, b?.filled !== false);
  }
  @Patch('employer/jobs/:id/extend')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  extend(@CurrentUser() u: U, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.extendJob(u.userId, id);
  }
  @Get('employer/workers/origin')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB, UserRole.ADMIN)
  origin(@CurrentUser() u: U) {
    return this.svc.employerOrigin(u.userId);
  }
  @Post('employer/workers/:id/notes')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB, UserRole.ADMIN)
  note(@CurrentUser() u: U, @Param('id', ParseUUIDPipe) id: string, @Body() b: { kind?: string; text?: string }) {
    return this.svc.addNote(u.userId, id, b ?? {});
  }
  @Delete('employer/workers/notes/:noteId')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB, UserRole.ADMIN)
  delNote(@CurrentUser() u: U, @Param('noteId', ParseUUIDPipe) noteId: string) {
    return this.svc.deleteNote(u.userId, noteId);
  }
  @Get('employer/worker-applications')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  apps(@CurrentUser() u: U) {
    return this.svc.employerApplications(u.userId);
  }
  @Patch('employer/worker-applications/:id/seen')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  seen(@CurrentUser() u: U, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.markSeen(u.userId, id);
  }

  // Admin
  @Get('admin/workers/stats')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  stats() {
    return this.svc.adminStats();
  }
  @Get('admin/workers/suspicious')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  suspicious() {
    return this.svc.adminSuspicious();
  }
  @Patch('admin/workers/:id/hide')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  hide(@Param('id', ParseUUIDPipe) id: string, @Body() b: { hidden?: boolean }) {
    return this.svc.adminHide(id, b?.hidden !== false);
  }
}
