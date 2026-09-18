import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';
import { JobApprovalStatus } from '../database/entities/job-posting.entity';
import { CompanyApprovalStatus } from '../database/entities/company.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('jobs/pending')
  listPendingJobs() {
    return this.adminService.listPendingJobs();
  }

  @Patch('jobs/:id/approve')
  approveJob(@Param('id') id: string) {
    return this.adminService.setJobStatus(id, JobApprovalStatus.APPROVED);
  }

  @Patch('jobs/:id/reject')
  rejectJob(@Param('id') id: string) {
    return this.adminService.setJobStatus(id, JobApprovalStatus.REJECTED);
  }

  @Get('companies/pending')
  listPendingCompanies() {
    return this.adminService.listPendingCompanies();
  }

  @Patch('companies/:id/approve')
  approveCompany(@Param('id') id: string) {
    return this.adminService.setCompanyStatus(id, CompanyApprovalStatus.APPROVED);
  }

  @Patch('companies/:id/reject')
  rejectCompany(@Param('id') id: string) {
    return this.adminService.setCompanyStatus(id, CompanyApprovalStatus.REJECTED);
  }

  @Get('orders/pending')
  listPendingOrders() {
    return this.adminService.listPendingOrders();
  }

  @Patch('orders/:id/confirm-payment')
  confirmOrderPayment(@Param('id') id: string) {
    return this.adminService.confirmOrderPayment(id);
  }
}
