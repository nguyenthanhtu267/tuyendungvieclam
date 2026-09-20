import { Controller, Get, Param, Query } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { ListJobsDto } from './dto/list-jobs.dto';

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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }
}
