import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../database/entities/user.entity';
import { JobApprovalStatus } from '../database/entities/job-posting.entity';
import { CompanyApprovalStatus } from '../database/entities/company.entity';
import { CompanyClaimRequestStatus } from '../database/entities/company-claim-request.entity';
import { BulkIdsDto } from './dto/bulk-ids.dto';
import { RejectJobDto } from './dto/reject-job.dto';
import { UpdateJobDto } from '../employer/dto/update-job.dto';
import { CreateJobDto } from '../employer/dto/create-job.dto';
import { CreateDraftCompanyDto } from './dto/create-draft-company.dto';
import { ClaimCompanyDto } from './dto/claim-company.dto';
import { ResolveClaimRequestDto } from './dto/resolve-claim-request.dto';
import { JobImportService } from './job-import.service';
import { MailScanService } from './mail-scan.service';
import { JobSourceService } from './job-source.service';
import { SupportMailService } from './support-mail.service';
import { ShareBgService } from './share-bg.service';
import { ExtractJobUrlDto } from './dto/extract-job-url.dto';
import { UpdatePromoBadgeDto } from './dto/promo-badge.dto';

// Đợt 23 — endpoint CÔNG KHAI (không cần đăng nhập) cho header đọc nhãn quảng bá.
@Controller('public/settings')
export class PublicSettingsController {
  constructor(private readonly adminService: AdminService) {}

  @Get('promo-badge')
  async promoBadge() {
    return { badge: await this.adminService.getPublicPromoBadge() };
  }
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly imports: JobImportService,
    private readonly mailScan: MailScanService,
    private readonly sources: JobSourceService,
    private readonly support: SupportMailService,
    private readonly shareBg: ShareBgService,
  ) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }

  // Đợt 15 (25/09/2026) — công tắc chung "Tự động duyệt tin" (theo yêu cầu người dùng). Đặt trước
  // 'jobs/:id' (không xung đột về số đoạn URL nhưng đặt gần các route cấu hình khác cho dễ đọc).
  @Get('settings/auto-approve')
  getAutoApproveSetting() {
    return this.adminService.getAutoApproveSetting();
  }

  @Patch('settings/auto-approve')
  setAutoApproveSetting(
    @CurrentUser() admin: { userId: string; email: string },
    @Body('enabled') enabled: boolean,
  ) {
    return this.adminService.setAutoApproveSetting(admin, !!enabled);
  }

  // Đợt 23 (29/09/2026) — nhãn quảng bá nhấp nháy cạnh logo (Admin bật/tắt, sửa chữ + link).
  @Get('settings/promo-badge')
  getPromoBadge() {
    return this.adminService.getPromoBadge();
  }

  @Patch('settings/promo-badge')
  setPromoBadge(
    @CurrentUser() admin: { userId: string; email: string },
    @Body() dto: UpdatePromoBadgeDto,
  ) {
    return this.adminService.setPromoBadge(admin, dto);
  }

  // Đợt 12q (21/09/2026) — Batch 5 mục #3: chuỗi thời gian cho biểu đồ dashboard, mặc định 14 ngày.
  @Get('stats/timeseries')
  getStatsTimeSeries(@Query('days') days?: string) {
    return this.adminService.getStatsTimeSeries(
      days ? Number(days) : undefined,
    );
  }

  // Đợt 12q (21/09/2026) — Batch 5 mục #4: nhật ký thao tác admin, phân trang.
  @Get('audit-log')
  getAuditLog(@Query('page') page?: string) {
    return this.adminService.getAuditLog(page ? Number(page) : undefined);
  }

  // Đợt 115 — danh sách theo trạng thái: ?status=approved|rejected (đặt trước 'jobs/:id').
  @Get('jobs/by-status')
  listJobsByStatus(@Query('status') status?: string, @Query('q') q?: string) {
    return this.adminService.listJobsByStatus(
      status === 'rejected' ? JobApprovalStatus.REJECTED : JobApprovalStatus.APPROVED,
      q,
    );
  }

  @Get('jobs/pending')
  listPendingJobs() {
    return this.adminService.listPendingJobs();
  }

  @Get('jobs/:id')
  getJobForReview(@Param('id') id: string) {
    return this.adminService.getJobForReview(id);
  }

  @Patch('jobs/:id/approve')
  approveJob(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
  ) {
    return this.adminService.setJobStatus(
      admin,
      id,
      JobApprovalStatus.APPROVED,
    );
  }

  // Đợt 15 (25/09/2026) — nút "Tin đã kiểm tra": chỉ dùng cho tin đã được TỰ ĐỘNG duyệt (còn hiện
  // trong tab "Duyệt tin" chờ Admin xem lại lần 2) — bấm xong thì dòng tin biến mất khỏi danh sách.
  // Đợt 115 — "Thu hồi": đưa tin đã duyệt về hàng chờ.
  @Patch('jobs/:id/revoke')
  revokeJob(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
  ) {
    return this.adminService.setJobStatus(admin, id, JobApprovalStatus.PENDING);
  }

  @Patch('jobs/:id/mark-reviewed')
  markJobReviewed(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
  ) {
    return this.adminService.markJobReviewed(admin, id);
  }

  // Đợt 12x (21/09/2026) — "Bắt buộc nhập lý do khi Từ chối" (theo yêu cầu người dùng): route này
  // giờ nhận body { reasons: string[]; note?: string } thay vì từ chối "trống không" như trước.
  @Patch('jobs/:id/reject')
  rejectJob(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
    @Body() dto: RejectJobDto,
  ) {
    return this.adminService.rejectJobWithReason(admin, id, dto);
  }

  // Đợt 12q (21/09/2026) — Batch 5 mục #2: duyệt/từ chối hàng loạt (đặt trước 'jobs/:id' về mặt
  // route matching không xung đột: 'jobs/bulk-approve' 2 đoạn (đúng bằng số đoạn của 'jobs/:id') nên
  // PHẢI khai báo trước 'jobs/:id' (đợt 12x, PATCH) — nếu không Nest sẽ hiểu "bulk-approve" là :id).
  @Patch('jobs/bulk-approve')
  bulkApproveJobs(
    @CurrentUser() admin: { userId: string; email: string },
    @Body() dto: BulkIdsDto,
  ) {
    return this.adminService.bulkSetJobStatus(
      admin,
      dto.ids,
      JobApprovalStatus.APPROVED,
    );
  }

  @Patch('jobs/bulk-reject')
  bulkRejectJobs(
    @CurrentUser() admin: { userId: string; email: string },
    @Body() dto: BulkIdsDto,
  ) {
    return this.adminService.bulkSetJobStatus(
      admin,
      dto.ids,
      JobApprovalStatus.REJECTED,
    );
  }

  // Đợt 12x (21/09/2026) — "Sửa tin trước khi duyệt" (theo yêu cầu người dùng, chọn phương án "Sửa
  // toàn bộ như form NTD"). Khai báo SAU 'jobs/bulk-approve'/'jobs/bulk-reject' (xem ghi chú ở trên).
  @Patch('jobs/:id')
  adminUpdateJob(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.adminService.adminUpdateJob(admin, id, dto);
  }

  // Đợt 17k (25/09/2026) — "xoá tin đăng" (theo yêu cầu người dùng). Khai báo sau PATCH 'jobs/:id'
  // (method khác nên không xung đột route matching) cho gần các route sửa/xoá tin khác trong file này.
  @Delete('jobs/:id')
  deleteJob(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
  ) {
    return this.adminService.deleteJob(admin, id);
  }

  // Đợt 113 — danh sách theo trạng thái: ?status=pending|approved|rejected
  @Get('companies/by-status')
  listCompaniesByStatus(@Query('status') status?: string, @Query('q') q?: string) {
    const st =
      status === 'approved'
        ? CompanyApprovalStatus.APPROVED
        : status === 'rejected'
          ? CompanyApprovalStatus.REJECTED
          : CompanyApprovalStatus.PENDING;
    return this.adminService.listCompaniesByStatus(st, q);
  }

  // ===== Đợt 119 — Hộp nhập tin từ link =====
  @Post('imports')
  addImportLinks(@Body('urls') urls: string[]) {
    return this.imports.addLinks(Array.isArray(urls) ? urls : []);
  }

  @Get('imports')
  listImports(@Query('status') status?: string, @Query('q') q?: string) {
    return this.imports.list(status, q);
  }

  // Đợt 120 — tự đọc email thông báo việc làm.
  // Đợt 147 — Nguồn theo dõi (công ty / ngành nghề / từ khoá của trang tuyển dụng), quét tự động mỗi ngày.
  @Get('job-sources')
  sourcesList() {
    return this.sources.list();
  }

  @Get('job-sources/sites')
  sourcesSites() {
    return this.sources.sites();
  }

  @Post('job-sources/preview')
  sourcesPreview(@Body('url') url: string) {
    return this.sources.preview(String(url || ''));
  }

  @Get('job-sources/search-company')
  sourcesSearchCompany(@Query('site') site: string, @Query('q') q: string) {
    return this.sources.searchCompany(String(site || ''), String(q || ''));
  }

  @Post('job-sources')
  sourcesAdd(@Body() b: { url: string; autoPublish?: boolean; label?: string; maxPages?: number }) {
    return this.sources.add(String(b?.url || ''), { autoPublish: !!b?.autoPublish, label: b?.label, maxPages: b?.maxPages });
  }

  @Post('job-sources/run')
  sourcesRunAll() {
    return this.sources.start();
  }

  @Post('job-sources/site-enabled')
  sourcesSiteEnabled(@Body() b: { site: string; enabled: boolean }) {
    return this.sources.setSiteEnabled(String(b?.site || ''), !!b?.enabled);
  }

  @Post('job-sources/:id/run')
  sourcesRun(@Param('id') id: string) {
    return this.sources.start(id);
  }

  @Post('job-sources/:id/step')
  sourcesStep(@Param('id') id: string, @Body() b: { reset?: boolean; page?: number }) {
    return this.sources.stepSource(id, { reset: !!b?.reset, page: b?.page });
  }

  @Patch('job-sources/:id')
  sourcesUpdate(@Param('id') id: string, @Body() b: { enabled?: boolean; autoPublish?: boolean; label?: string; maxPages?: number }) {
    return this.sources.update(id, b ?? {});
  }

  @Delete('job-sources/:id')
  sourcesRemove(@Param('id') id: string) {
    return this.sources.remove(id);
  }

  // ===== Đợt 153 — nền ảnh chia sẻ tin tuyển dụng =====
  @Get('share-bg')
  shareBgGet() {
    return this.shareBg.adminView();
  }
  @Put('share-bg')
  shareBgSet(@Body() b: { mode?: string; fixedId?: string; presets?: string[]; texts?: Record<string, string>; style?: unknown; people?: string; format?: string; cast?: { source?: string; male?: { scale?: number; flip?: boolean }; female?: { scale?: number; flip?: boolean } } }) {
    return this.shareBg.update(b ?? {});
  }
  @Post('share-bg/custom')
  shareBgAdd(@Body() b: { name?: string; dataUrl: string }) {
    return this.shareBg.addCustom(String(b?.name || ''), String(b?.dataUrl || ''));
  }
  @Post('share-bg/person/:who')
  shareBgPerson(@Param('who') who: string, @Body() b: { dataUrl: string }) {
    return this.shareBg.setPerson(who, String(b?.dataUrl || ''));
  }
  @Delete('share-bg/person/:who')
  shareBgPersonRemove(@Param('who') who: string) {
    return this.shareBg.removePerson(who);
  }
  @Delete('share-bg/custom/:id')
  shareBgRemove(@Param('id') id: string) {
    return this.shareBg.removeCustom(id);
  }

  // ===== Đợt 150 — Hộp thư (thư hỗ trợ, mẫu email, danh sách email, chiến dịch) =====
  @Get('mail/status')
  mailStatus() {
    return this.support.status();
  }
  @Post('mail/sync')
  mailSync() {
    return this.support.sync();
  }
  @Get('mail/inbox')
  mailInbox(@Query('status') status?: string, @Query('q') q?: string) {
    return this.support.inbox(status, q);
  }
  @Get('mail/messages/:id')
  mailMessage(@Param('id') id: string) {
    return this.support.message(id);
  }
  @Patch('mail/messages/:id')
  mailSetStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.support.setStatus(id, String(status));
  }
  @Delete('mail/messages/:id')
  mailRemove(@Param('id') id: string) {
    return this.support.removeMessage(id);
  }
  @Post('mail/messages/:id/reply')
  mailReply(@Param('id') id: string, @Body() b: { subject?: string; body: string }) {
    return this.support.reply(id, String(b?.subject || ''), String(b?.body || ''));
  }
  @Get('mail/templates')
  mailTemplates() {
    return this.support.templates();
  }
  @Post('mail/templates')
  mailTemplateNew(@Body() b: { kind?: string; name: string; subject: string; body: string }) {
    return this.support.saveTemplate(undefined, b);
  }
  @Patch('mail/templates/:id')
  mailTemplateSave(@Param('id') id: string, @Body() b: { kind?: string; name: string; subject: string; body: string }) {
    return this.support.saveTemplate(id, b);
  }
  @Post('mail/templates/:id/reset')
  mailTemplateReset(@Param('id') id: string) {
    return this.support.resetTemplate(id);
  }
  @Delete('mail/templates/:id')
  mailTemplateRemove(@Param('id') id: string) {
    return this.support.removeTemplate(id);
  }
  @Get('mail/contacts')
  mailContacts(@Query('q') q?: string, @Query('status') status?: string, @Query('source') source?: string) {
    return this.support.contacts(q, status, source);
  }
  @Post('mail/contacts')
  mailContactsAdd(@Body('text') text: string) {
    return this.support.addContacts(String(text || ''), 'manual');
  }
  @Post('mail/contacts/harvest')
  mailContactsHarvest(@Body('kind') kind: string) {
    return this.support.harvest(String(kind || ''));
  }
  @Patch('mail/contacts/:id')
  mailContactStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.support.setContactStatus(id, String(status));
  }
  @Delete('mail/contacts/:id')
  mailContactRemove(@Param('id') id: string) {
    return this.support.removeContact(id);
  }
  @Get('mail/campaigns')
  mailCampaigns() {
    return this.support.campaigns();
  }
  @Post('mail/campaigns')
  mailCampaignNew(@Body() b: { name: string; subject: string; body: string; sourceFilter?: string | null }) {
    return this.support.saveCampaign(undefined, b);
  }
  @Patch('mail/campaigns/:id')
  mailCampaignSave(@Param('id') id: string, @Body() b: { name: string; subject: string; body: string; sourceFilter?: string | null }) {
    return this.support.saveCampaign(id, b);
  }
  @Post('mail/campaigns/:id/approve')
  mailCampaignApprove(@Param('id') id: string, @Body('approve') approve: boolean) {
    return this.support.approveCampaign(id, approve !== false);
  }
  @Post('mail/campaigns/:id/test')
  mailCampaignTest(@Param('id') id: string, @Body('to') to?: string) {
    return this.support.testCampaign(id, String(to || ''));
  }
  @Post('mail/campaigns/:id/send')
  mailCampaignSend(@Param('id') id: string) {
    return this.support.sendBatch(id);
  }
  @Delete('mail/campaigns/:id')
  mailCampaignRemove(@Param('id') id: string) {
    return this.support.removeCampaign(id);
  }

  @Get('mail-scan')
  mailScanStatus() {
    return this.mailScan.status();
  }

  @Post('mail-scan')
  mailScanNow(@Body('days') days?: number) {
    return this.mailScan.start(Number(days) || undefined);
  }

  @Get('mail-scan/labels')
  mailScanLabels(@Query('account') account?: string) {
    return this.mailScan.labels(Number(account) || 1);
  }

  @Post('mail-scan/labels')
  mailScanSetLabels(@Body('labels') labels: string[], @Body('account') account?: number) {
    return this.mailScan.setLabels(Array.isArray(labels) ? labels : [], Number(account) || 1);
  }

  @Post('imports/merge-duplicates')
  async mergeImportDuplicates() {
    return { merged: await this.imports.mergeDuplicates() };
  }

  @Post('mail-scan/enabled')
  mailScanEnabled(@Body('enabled') enabled: boolean) {
    return this.mailScan.setEnabled(!!enabled);
  }

  @Post('mail-scan/auto-publish')
  mailScanAutoPublish(@Body('minutes') minutes: number) {
    return this.mailScan.setAutoPublish(Number(minutes));
  }

  @Post('imports/publish-many')
  publishManyImports(@CurrentUser() admin: { userId: string; email: string }, @Body('ids') ids: string[]) {
    return this.imports.publishMany(admin, Array.isArray(ids) ? ids : []);
  }

  @Post('imports/bulk')
  bulkImports(
    @CurrentUser() admin: { userId: string; email: string },
    @Body('ids') ids: string[],
    @Body('action') action: string,
  ) {
    const a = ['skip', 'restore', 'notify'].includes(action) ? (action as 'skip' | 'restore' | 'notify') : 'skip';
    return this.imports.bulk(admin, Array.isArray(ids) ? ids : [], a);
  }

  @Post('imports/:id/restore')
  restoreImport(@Param('id') id: string) {
    return this.imports.restore(id);
  }

  @Post('imports/:id/enrich')
  enrichImport(@Param('id') id: string) {
    return this.imports.enrich(id);
  }

  @Post('imports/:id/reopen')
  reopenImport(@CurrentUser() admin: { userId: string; email: string }, @Param('id') id: string) {
    return this.imports.reopen(admin, id);
  }

  @Post('imports/:id/publish')
  publishImport(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.imports.publish(admin, id, body ?? {});
  }

  @Post('imports/:id/notify-owner')
  notifyImportOwner(@CurrentUser() admin: { userId: string; email: string }, @Param('id') id: string) {
    return this.imports.notifyOwner(admin, id);
  }

  @Post('imports/:id/skip')
  skipImport(@Param('id') id: string) {
    return this.imports.skip(id);
  }

  @Get('companies/pending')
  listPendingCompanies() {
    return this.adminService.listPendingCompanies();
  }

  // ===== Đợt 17 (25/09/2026) — "Nguồn ngoài / Tin tổng hợp" =====
  // Đặt các route literal ('companies/draft', 'companies/sourced') TRƯỚC 'companies/:id/...' — không
  // thật sự xung đột về matching (khác số đoạn/khác method) nhưng đặt gần nhau cho dễ đọc, theo đúng
  // quy ước ghi chú thứ tự route đã dùng xuyên suốt file này.
  @Post('companies/draft')
  createDraftCompany(
    @CurrentUser() admin: { userId: string; email: string },
    @Body() dto: CreateDraftCompanyDto,
  ) {
    return this.adminService.createDraftCompany(admin, dto);
  }

  @Get('companies/sourced')
  listSourcedCompanies(
    @Query('q') q?: string,
    @Query('claimed') claimed?: string,
  ) {
    const claimedFilter =
      claimed === 'true' ? true : claimed === 'false' ? false : undefined;
    return this.adminService.listSourcedCompanies(q, claimedFilter);
  }

  @Get('companies/:id/sourced-detail')
  getSourcedCompanyDetail(@Param('id') id: string) {
    return this.adminService.getSourcedCompanyDetail(id);
  }

  @Post('companies/:id/jobs')
  createJobForCompany(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
    @Body() dto: CreateJobDto,
  ) {
    return this.adminService.createJobForCompany(admin, id, dto);
  }

  @Post('companies/:id/claim')
  claimCompany(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
    @Body() dto: ClaimCompanyDto,
  ) {
    return this.adminService.claimCompany(admin, id, dto);
  }

  @Post('extract-job-url')
  extractJobFromUrl(@Body() dto: ExtractJobUrlDto) {
    return this.adminService.extractJobFromUrlTool(dto.url);
  }

  @Get('claim-requests')
  listClaimRequests(@Query('status') status?: CompanyClaimRequestStatus) {
    return this.adminService.listClaimRequests(status);
  }

  @Patch('claim-requests/:id/approve')
  approveClaimRequest(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
    @Body() dto: ResolveClaimRequestDto,
  ) {
    return this.adminService.approveClaimRequest(admin, id, dto);
  }

  @Patch('claim-requests/:id/reject')
  rejectClaimRequest(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
    @Body() dto: ResolveClaimRequestDto,
  ) {
    return this.adminService.rejectClaimRequest(admin, id, dto);
  }

  // Đợt 12q (21/09/2026) — Batch 5 mục #1: tìm công ty (mọi trạng thái) để bật/tắt "Doanh nghiệp yêu
  // thích" — đặt trước 'companies/pending' về route không xung đột vì có query param riêng.
  @Get('companies')
  searchCompanies(@Query('q') q?: string) {
    return this.adminService.searchCompanies(q);
  }

  // Đợt 114 — danh bạ công ty (tab DN yêu thích & Logo) + đánh dấu yêu thích hàng loạt.
  @Get('companies/directory')
  companyDirectory(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('featured') featured?: string,
    @Query('noLogo') noLogo?: string,
    @Query('attention') attention?: string,
    @Query('hasWebsite') hasWebsite?: string,
  ) {
    return this.adminService.companyDirectory({
      attention: attention === '1',
      hasWebsite: hasWebsite === '1',
      q,
      status,
      featured: featured === '1',
      noLogo: noLogo === '1',
    });
  }

  @Patch('companies/bulk-featured')
  bulkFeatured(
    @CurrentUser() admin: { userId: string; email: string },
    @Body() body: { ids: string[]; featured: boolean },
  ) {
    return this.adminService.bulkSetFeatured(admin, body?.ids ?? [], !!body?.featured);
  }

  @Patch('companies/:id/toggle-featured')
  toggleFeaturedEmployer(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
  ) {
    return this.adminService.toggleFeaturedEmployer(admin, id);
  }

  // Đợt 16 (25/09/2026) — mục 22b: công cụ Admin tìm & gán logo công ty thủ công.
  @Patch('companies/:id/logo')
  updateCompanyLogo(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
    @Body('logoUrl') logoUrl: string,
  ) {
    return this.adminService.updateCompanyLogo(admin, id, logoUrl ?? '');
  }

  @Patch('companies/:id/approve')
  approveCompany(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
  ) {
    return this.adminService.setCompanyStatus(
      admin,
      id,
      CompanyApprovalStatus.APPROVED,
    );
  }

  // Đợt 113 — "Thu hồi": đưa công ty đã duyệt về hàng chờ.
  @Patch('companies/:id/revoke')
  revokeCompany(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
  ) {
    return this.adminService.setCompanyStatus(
      admin,
      id,
      CompanyApprovalStatus.PENDING,
    );
  }

  @Patch('companies/:id/reject')
  rejectCompany(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
  ) {
    return this.adminService.setCompanyStatus(
      admin,
      id,
      CompanyApprovalStatus.REJECTED,
    );
  }

  @Patch('companies/bulk-approve')
  bulkApproveCompanies(
    @CurrentUser() admin: { userId: string; email: string },
    @Body() dto: BulkIdsDto,
  ) {
    return this.adminService.bulkSetCompanyStatus(
      admin,
      dto.ids,
      CompanyApprovalStatus.APPROVED,
    );
  }

  @Patch('companies/bulk-reject')
  bulkRejectCompanies(
    @CurrentUser() admin: { userId: string; email: string },
    @Body() dto: BulkIdsDto,
  ) {
    return this.adminService.bulkSetCompanyStatus(
      admin,
      dto.ids,
      CompanyApprovalStatus.REJECTED,
    );
  }

  @Get('users')
  findUserByEmail(@Query('email') email: string) {
    return this.adminService.findUserByEmail(email);
  }

  @Patch('users/:id/reset-password')
  resetUserPassword(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
  ) {
    return this.adminService.resetUserPassword(admin, id);
  }

  @Get('orders/pending')
  listPendingOrders() {
    return this.adminService.listPendingOrders();
  }

  @Patch('orders/:id/confirm-payment')
  confirmOrderPayment(
    @CurrentUser() admin: { userId: string; email: string },
    @Param('id') id: string,
  ) {
    return this.adminService.confirmOrderPayment(admin, id);
  }
}

// Đợt 120 — địa chỉ cho dịch vụ gọi định kỳ miễn phí (VD cron-job.org): vừa đánh thức Render miễn phí vừa chạy quét email.
// Bảo vệ bằng khoá bí mật MAIL_CRON_KEY (biến môi trường), sai khoá thì báo 404 như không tồn tại.
@Controller('public/mail-scan')
export class MailScanCronController {
  constructor(
    private readonly mailScan: MailScanService,
    private readonly sources: JobSourceService,
    private readonly support: SupportMailService,
  ) {}

  @Get('run')
  run(@Query('key') key?: string) {
    if (!this.mailScan.checkCronKey(key)) throw new NotFoundException();
    this.mailScan.autoPublishTick().catch(() => undefined);
    // Đợt 147 — cùng một lần gọi định kỳ cũng quét các "Nguồn theo dõi" đến hạn (khỏi cần tạo thêm cron).
    this.sources.start();
    this.support.sync().catch(() => undefined); // Đợt 150 — cũng lấy thư hỗ trợ mới
    return this.mailScan.start();
  }
}

// Đợt 147 — địa chỉ riêng chỉ để quét Nguồn theo dõi (dùng cùng khoá MAIL_CRON_KEY).
@Controller('public/source-scan')
export class SourceScanCronController {
  constructor(
    private readonly mailScan: MailScanService,
    private readonly sources: JobSourceService,
  ) {}

  @Get('run')
  run(@Query('key') key?: string) {
    if (!this.mailScan.checkCronKey(key)) throw new NotFoundException();
    this.mailScan.autoPublishTick().catch(() => undefined);
    return this.sources.start();
  }
}

// Đợt 150 — liên kết "Hủy nhận thư" trong thư giới thiệu (công khai, kiểm bằng chữ ký).
@Controller('public/email-unsub')
export class EmailUnsubController {
  constructor(private readonly support: SupportMailService) {}

  @Get()
  async unsub(@Query('e') e: string, @Query('t') t: string, @Res() res: Response) {
    const html = await this.support.unsubscribe(String(e || ''), String(t || ''));
    res.type('html').send(html);
  }
}

// Đợt 153 — web (máy chủ Vercel) hỏi nền ảnh chia sẻ của ngày hôm nay.
@Controller('public/share-bg')
export class ShareBgPublicController {
  constructor(private readonly shareBg: ShareBgService) {}

  @Get()
  pick(@Query('d') d?: string, @Query('only') only?: string, @Query('lite') lite?: string) {
    return lite ? this.shareBg.formatOnly() : this.shareBg.pick(d, only);
  }
}
