import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ApplicationsService } from './applications.service';
import { ApplyJobDto } from './dto/apply-job.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post('jobs/:id/apply')
  apply(@CurrentUser() user: { userId: string }, @Param('id') jobId: string, @Body() dto: ApplyJobDto) {
    return this.applicationsService.apply(user.userId, jobId, dto);
  }

  @Get('me/applications')
  listOwn(@CurrentUser() user: { userId: string }) {
    return this.applicationsService.listOwn(user.userId);
  }
}
