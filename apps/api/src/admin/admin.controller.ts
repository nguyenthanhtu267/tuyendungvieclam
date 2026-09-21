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

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
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

  @Patch('jobs/:id/reject')
  rejectJob(@CurrentUser() admin: { userId: string; email: string }, @Param('id') id: string) {
    return this.adminService.setJobStatus(admin, id, JobApprovalStatus.REJECTED);
  }

  // Đợt 12q (21/09/2026) — Batch 5 mục #2: duyệt/từ chối hàng loạt (đặt trước 'jobs/:id/...' về mặt
  // route matching không xung đột vì tiền tố khác nhau: 'jobs/bulk-approve' không khớp 'jobs/:id/...').
  @Patch('jobs/bulk-approve')
  bulkApproveJobs(@CurrentUser() admin: { userId: string; email: string }, @Body() dto: BulkIdsDto) {
    return this.adminService.bulkSetJobStatus(admin, dto.ids, JobApprovalStatus.APPROVED);
  }

  @Patch('jobs/bulk-reject')
  bulkRejectJobs(@CurrentUser() admin: { userId: string; email: string }, @Body() dto: BulkIdsDto) {
    return this.adminService.bulkSetJobStatus(admin, dto.ids, JobApprovalStatus.REJECTED);
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
