import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../database/entities/user.entity';
import { SmartService } from './smart.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SmartController {
  constructor(private readonly smart: SmartService) {}

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
  forecast(@Query('industry') industry?: string, @Query('level') level?: string, @Query('salaryMin') salaryMin?: string, @Query('salaryMax') salaryMax?: string) {
    return this.smart.jobForecast({
      industry: industry || undefined,
      level: level || undefined,
      salaryMin: salaryMin ? Number(salaryMin) || undefined : undefined,
      salaryMax: salaryMax ? Number(salaryMax) || undefined : undefined,
    });
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
