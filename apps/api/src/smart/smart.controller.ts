import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../database/entities/user.entity';
import { SmartService } from './smart.service';
import { Smart2Service } from './smart2.service';
import { Smart3Service } from './smart3.service';
import { Smart4Service } from './smart4.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SmartController {
  constructor(private readonly smart: SmartService, private readonly smart2: Smart2Service, private readonly smart3: Smart3Service, private readonly smart4: Smart4Service) {}

  @Get('employer/pending-applications')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  pending(@CurrentUser() user: { userId: string }, @Query('days') days?: string) {
    return this.smart4.pendingApplications(user.userId, Number(days) || 3);
  }

  @Get('employer/job-performance')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  performance(@CurrentUser() user: { userId: string }) {
    return this.smart4.jobPerformance(user.userId);
  }

  @Post('employer/jobs/:id/extend')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  extend(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() body: { days?: number }) {
    return this.smart4.extendJob(user.userId, id, Number(body?.days) || 15);
  }

  @Get('employer/jobs/:id/title-test')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  titleTest(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.smart4.getTitleTest(user.userId, id);
  }

  @Post('employer/jobs/:id/title-test')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  startTitleTest(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() body: { titleB?: string }) {
    return this.smart4.startTitleTest(user.userId, id, String(body?.titleB ?? ''));
  }

  @Post('employer/jobs/:id/title-test/finish')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  finishTitleTest(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() body: { apply?: boolean }) {
    return this.smart4.finishTitleTest(user.userId, id, !!body?.apply);
  }

  @Post('employer/jobs/:id/bulk-invite')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  bulkInvite(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() body: { profileIds?: string[] }) {
    return this.smart4.bulkInvite(user.userId, id, body?.profileIds ?? []);
  }

  @Get('admin/companies/:id/verify-check')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  verifyCheck(@Param('id') id: string) {
    return this.smart4.companyVerifyCheck(id);
  }

  @Get('jobs/:id/cv-tailor')
  @Roles(UserRole.CANDIDATE)
  cvTailor(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.smart3.cvTailor(user.userId, id);
  }

  @Get('jobs/:id/apply-check')
  @Roles(UserRole.CANDIDATE)
  applyCheck(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.smart3.applyCheck(user.userId, id);
  }

  @Get('me/profile-freshness')
  @Roles(UserRole.CANDIDATE)
  freshness(@CurrentUser() user: { userId: string }) {
    return this.smart3.profileFreshness(user.userId);
  }

  @Get('me/salary-position')
  @Roles(UserRole.CANDIDATE)
  salaryPosition(@CurrentUser() user: { userId: string }) {
    return this.smart3.salaryPosition(user.userId);
  }

  @Get('me/job-goal')
  @Roles(UserRole.CANDIDATE)
  jobGoal(@CurrentUser() user: { userId: string }) {
    return this.smart3.jobGoal(user.userId);
  }

  @Get('jobs/:id/insights')
  @Roles(UserRole.CANDIDATE)
  insights(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.smart.jobInsights(user.userId, id);
  }

  @Get('employer/applicant-scores')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  applicantScores(@CurrentUser() user: { userId: string }, @Query('jobId') jobId: string) {
    return this.smart.applicantScores(user.userId, jobId);
  }

  @Get('employer/job-health')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  jobHealth(@CurrentUser() user: { userId: string }) {
    return this.smart.jobHealth(user.userId);
  }

  @Get('employer/job-forecast')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  async forecast(
    @Query('industry') industry?: string,
    @Query('level') level?: string,
    @Query('province') province?: string,
    @Query('salaryMin') salaryMin?: string,
    @Query('salaryMax') salaryMax?: string,
  ) {
    const [core, extra] = await Promise.all([
      this.smart.jobForecast({
        industry: industry || undefined,
        level: level || undefined,
        salaryMin: salaryMin ? Number(salaryMin) || undefined : undefined,
        salaryMax: salaryMax ? Number(salaryMax) || undefined : undefined,
      }),
      this.smart2.postingInsights({ industry: industry || undefined, level: level || undefined, province: province || undefined }),
    ]);
    return { ...core, ...extra };
  }

  @Get('jobs/:id/certificates')
  @Roles(UserRole.CANDIDATE)
  certificates(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.smart2.certificateDemand(user.userId, id);
  }

  @Get('me/applications-eta')
  @Roles(UserRole.CANDIDATE)
  eta(@CurrentUser() user: { userId: string }) {
    return this.smart2.applicationEta(user.userId);
  }

  @Post('me/profile-share')
  @Roles(UserRole.CANDIDATE)
  share(@CurrentUser() user: { userId: string }) {
    return this.smart2.createShareLink(user.userId);
  }

  @Get('employer/reinvite')
  @Roles(UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB)
  reinvite(@CurrentUser() user: { userId: string }, @Query('jobId') jobId: string) {
    return this.smart2.reinvite(user.userId, jobId);
  }

  @Post('jobs/:id/report')
  report(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() body: { reason?: string; note?: string }) {
    return this.smart2.createReport(user.userId, id, String(body?.reason ?? 'other'), body?.note);
  }

  @Get('admin/quality/reports')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  reports() {
    return this.smart2.listReports();
  }

  @Post('admin/quality/reports/:jobId/resolve')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  resolve(@Param('jobId') jobId: string) {
    return this.smart2.resolveReports(jobId);
  }

  @Get('admin/quality/weekly')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  weekly() {
    return this.smart2.weeklyReport();
  }

  @Get('admin/quality/ad-targeting')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  adTargeting() {
    return this.smart2.adTargeting();
  }

  @Get('admin/quality/system')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  system() {
    return this.smart.systemHealth();
  }

  @Get('admin/quality/overview')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  quality() {
    return this.smart.qualityOverview();
  }
}

// Đợt 64 — công khai: tỷ lệ phản hồi của công ty (hiện ở trang tin và trang công ty).
@Controller('companies')
export class SmartPublicController {
  constructor(private readonly smart: SmartService) {}

  @Get(':id/response-stats')
  responseStats(@Param('id') id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { enough: false, total: 0 };
    return this.smart.companyResponseStats(id);
  }
}

// Đợt 65 — công khai: xem hồ sơ tóm tắt qua link chia sẻ (không có thông tin liên hệ).
@Controller('public')
export class SmartSharePublicController {
  constructor(private readonly smart2: Smart2Service, private readonly smart4: Smart4Service) {}

  // Đợt 75 — A/B tiêu đề: danh sách tin đang thử nghiệm + ghi nhận lượt hiển thị/bấm (ẩn danh, chỉ đếm).
  @Get('title-tests')
  titleTests(@Query('ids') ids?: string) {
    return this.smart4.publicTests((ids ?? '').split(','));
  }

  @Post('title-tests/event')
  titleEvent(@Body() body: { testId?: string; variant?: string; type?: string }) {
    return this.smart4.recordTestEvent(String(body?.testId ?? ''), String(body?.variant ?? ''), String(body?.type ?? ''));
  }

  @Get('profile-share/:token')
  shared(@Param('token') token: string) {
    return this.smart2.sharedProfile(token);
  }
}
