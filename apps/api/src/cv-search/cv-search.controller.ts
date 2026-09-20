import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CvSearchService } from './cv-search.service';
import { SearchCandidatesDto } from './dto/search-candidates.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

// Đợt 9 — Tìm kiếm hồ sơ ứng viên cho nhà tuyển dụng (/employer/candidates). Cùng cách bảo vệ như
// EmployerController: JwtAuthGuard + tra bảng company_users trong service (chặn tài khoản ứng viên).
@Controller('employer/candidates')
@UseGuards(JwtAuthGuard)
export class CvSearchController {
  constructor(private readonly cvSearchService: CvSearchService) {}

  @Get()
  search(@CurrentUser() user: { userId: string }, @Query() dto: SearchCandidatesDto) {
    return this.cvSearchService.search(user.userId, dto);
  }

  @Get('credits')
  getCredits(@CurrentUser() user: { userId: string }) {
    return this.cvSearchService.getCredits(user.userId);
  }

  @Get('unlocked')
  listUnlocked(@CurrentUser() user: { userId: string }) {
    return this.cvSearchService.listUnlocked(user.userId);
  }

  @Get(':id')
  getDetail(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.cvSearchService.getDetail(user.userId, id);
  }

  @Post(':id/unlock')
  unlock(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.cvSearchService.unlock(user.userId, id);
  }
}
