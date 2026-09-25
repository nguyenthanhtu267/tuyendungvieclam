import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { ListJobsDto } from './dto/list-jobs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

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
  districtFacets(@Query('province') province: string, @Query() query: ListJobsDto) {
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  // Đợt 12ab (24/09/2026) — "Đánh giá mức độ tương thích": chỉ ứng viên đã đăng nhập mới xem được
  // (cần hồ sơ để so khớp), khác các route /jobs khác vốn công khai hoàn toàn.
  @Get(':id/compatibility')
  @UseGuards(JwtAuthGuard)
  getCompatibility(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.jobsService.getCompatibility(user.userId, id);
  }
}
