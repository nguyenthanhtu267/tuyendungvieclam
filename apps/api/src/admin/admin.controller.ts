import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../database/entities/user.entity';
import { JobApprovalStatus } from '../database/entities/job-posting.entity';
import { CompanyApprovalStatus } from '../database/entities/company.entity';
import { BulkIdsDto } from './dto/bulk-ids.dto';
import { RejectJobDto } from './dto/reject-job.dto';
import { UpdateJobDto } from '../employer/dto/update-job.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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

  // Đợt 12q (21/09/2026) — Batch 5 mục #3: chuỗi thời gian cho biểu đồ dashboard, mặc định 14 ngày.
  @Get('stats/timeseries')
  getStatsTimeSeries(@Query('days') days?: string) {
    return this.adminService.getStatsTimeSeries(days ? Number(days) : undefined);
  }

  // Đợt 12q (21/09/2026) — Batch 5 mục #4: nhật ký thao tác admin, phân trang.
  @Get('audit-log')
  getAuditLog(@Query('page') page?: string) {
    return this.adminService.getAuditLog(page ? Number(page) : undefined);
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
  approveJob(@CurrentUser() admin: { userId: string; email: string }, @Param('id') id: string) {
    return this.adminService.setJobStatus(admin, id, JobApprovalStatus.APPROVED);
  }

  // Đợt 15 (25/09/2026) — nút "Tin đã kiểm tra": chỉ dùng cho tin đã được TỰ ĐỘNG duyệt (còn hiện
  // trong tab "Duyệt tin" chờ Admin xem lại lần 2) — bấm xong thì dòng tin biến mất khỏi danh sách.
  @Patch('jobs/:id/mark-reviewed')
  markJobReviewed(@CurrentUser() admin: { userId: string; email: string }, @Param('id') id: string) {
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
  bulkApproveJobs(@CurrentUser() admin: { userId: string; email: string }, @Body() dto: BulkIdsDto) {
    return this.adminService.bulkSetJobStatus(admin, dto.ids, JobApprovalStatus.APPROVED);
  }

  @Patch('jobs/bulk-reject')
  bulkRejectJobs(@CurrentUser() admin: { userId: string; email: string }, @Body() dto: BulkIdsDto) {
    return this.adminService.bulkSetJobStatus(admin, dto.ids, JobApprovalStatus.REJECTED);
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

  @Get('companies/pending')
  listPendingCompanies() {
    return this.adminService.listPendingCompanies();
  }

  // Đợt 12q (21/09/2026) — Batch 5 mục #1: tìm công ty (mọi trạng thái) để bật/tắt "Doanh nghiệp yêu
  // thích" — đặt trước 'companies/pending' về route không xung đột vì có query param riêng.
  @Get('companies')
  searchCompanies(@Query('q') q?: string) {
    return this.adminService.searchCompanies(q);
  }

  @Patch('companies/:id/toggle-featured')
  toggleFeaturedEmployer(@CurrentUser() admin: { userId: string; email: string }, @Param('id') id: string) {
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
  approveCompany(@CurrentUser() admin: { userId: string; email: string }, @Param('id') id: string) {
    return this.adminService.setCompanyStatus(admin, id, CompanyApprovalStatus.APPROVED);
  }

  @Patch('companies/:id/reject')
  rejectCompany(@CurrentUser() admin: { userId: string; email: string }, @Param('id') id: string) {
    return this.adminService.setCompanyStatus(admin, id, CompanyApprovalStatus.REJECTED);
  }

  @Patch('companies/bulk-approve')
  bulkApproveCompanies(@CurrentUser() admin: { userId: string; email: string }, @Body() dto: BulkIdsDto) {
    return this.adminService.bulkSetCompanyStatus(admin, dto.ids, CompanyApprovalStatus.APPROVED);
  }

  @Patch('companies/bulk-reject')
  bulkRejectCompanies(@CurrentUser() admin: { userId: string; email: string }, @Body() dto: BulkIdsDto) {
    return this.adminService.bulkSetCompanyStatus(admin, dto.ids, CompanyApprovalStatus.REJECTED);
  }

  @Get('users')
  findUserByEmail(@Query('email') email: string) {
    return this.adminService.findUserByEmail(email);
  }

  @Patch('users/:id/reset-password')
  resetUserPassword(@CurrentUser() admin: { userId: string; email: string }, @Param('id') id: string) {
    return this.adminService.resetUserPassword(admin, id);
  }

  @Get('orders/pending')
  listPendingOrders() {
    return this.adminService.listPendingOrders();
  }

  @Patch('orders/:id/confirm-payment')
  confirmOrderPayment(@CurrentUser() admin: { userId: string; email: string }, @Param('id') id: string) {
    return this.adminService.confirmOrderPayment(admin, id);
  }
}
