import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';
import { JobAlertsService } from './job-alerts.service';
import { JobsService } from './jobs.service';
import { ListJobsDto } from './dto/list-jobs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly jobAlerts: JobAlertsService,
  ) {}

  @Get()
  findAll(@Query() query: ListJobsDto) {
    return this.jobsService.findAll(query);
  }

  @Get('facets')
  facets(@Query() query: ListJobsDto) {
    return this.jobsService.facets(query);
  }

  // Chip quận/huyện — chỉ có ý nghĩa khi đã chọn 1 tỉnh/thành (đặc tả mục 3).
  @Get('district-facets')
  districtFacets(
    @Query('province') province: string,
    @Query() query: ListJobsDto,
  ) {
    return this.jobsService.districtFacets(province, query);
  }

  @Get('featured-employers')
  featuredEmployers() {
    return this.jobsService.featuredEmployers();
  }

  // Đợt 13 (24/09/2026) — "Thống kê trang chủ" (mục 7 danh sách lỗi), công khai không cần đăng
  // nhập. Khai TRƯỚC @Get(':id') như các route tĩnh khác ở trên (facets, district-facets,
  // featured-employers) để không bị ':id' (1 đoạn path) nuốt mất — dù 'stats/homepage' là 2 đoạn
  // nên về lý thuyết không đụng ':id', khai trước vẫn là quy ước nhất quán của file này.
  @Get('stats/homepage')
  homepageStats() {
    return this.jobsService.getHomepageStats();
  }

  // Đợt 27 — số liệu thị trường (theo ngày/nhóm) cho bảng ở trang chủ, công khai.
  @Get('stats/market')
  marketStats() {
    return this.jobsService.getMarketStats();
  }

  @Get('stats/salary')
  salaryStats(
    @Query('industry') industry?: string,
    @Query('province') province?: string,
    @Query('level') level?: string,
  ) {
    return this.jobsService.getSalaryStats(industry || undefined, province || undefined, level || undefined);
  }

  // Đợt 29 — từ khoá được tìm nhiều nhất (công khai).
  @Get('stats/popular-keywords')
  async popularKeywords() {
    return { keywords: await this.jobsService.getPopularKeywords() };
  }

  // Đợt 38 — độ phù hợp việc ↔ hồ sơ (ứng viên đăng nhập). Khai TRƯỚC ':id'.
  @Get('match')
  @UseGuards(JwtAuthGuard)
  match(@CurrentUser() user: { userId: string }, @Query('ids') ids = '') {
    return this.jobsService.matchScores(
      user.userId,
      String(ids).split(',').filter(Boolean),
    );
  }

  // Đợt 38 — Admin chạy thử 1 đợt cảnh báo việc mới ngay (bình thường tự chạy mỗi 30 phút).
  @Post('alerts/run')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  runAlerts() {
    return this.jobAlerts.run();
  }

  @Get('recommended')
  @UseGuards(JwtAuthGuard)
  recommended(
    @CurrentUser() user: { userId: string },
    @Query('limit') limit?: string,
  ) {
    return this.jobsService.recommended(
      user.userId,
      limit ? parseInt(limit, 10) || 6 : 6,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  // Đợt 12ab (24/09/2026) — "Đánh giá mức độ tương thích": chỉ ứng viên đã đăng nhập mới xem được
  // (cần hồ sơ để so khớp), khác các route /jobs khác vốn công khai hoàn toàn.
  @Get(':id/compatibility')
  @UseGuards(JwtAuthGuard)
  getCompatibility(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.jobsService.getCompatibility(user.userId, id);
  }
}
