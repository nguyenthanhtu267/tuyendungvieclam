import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../database/entities/user.entity';
import { AdminCandidatesService } from './admin-candidates.service';
import { AdminActor } from './admin-audit';
import {
  CandidatesQueryDto,
  InviteDto,
  SetAdminNoteDto,
} from './dto/admin-tools.dto';

// Đợt 18f (26/09/2026) — Admin "Ứng viên": quản lý thông minh mọi hồ sơ ứng viên (kể cả hồ sơ chưa
// từng nộp cho NTD nào).
@Controller('admin/candidates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AdminCandidatesController {
  constructor(private readonly candidates: AdminCandidatesService) {}

  @Get()
  list(@Query() query: CandidatesQueryDto) {
    return this.candidates.list(query);
  }

  @Get('tags')
  tags() {
    return this.candidates.tags();
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.candidates.detail(id);
  }

  @Put(':id/note')
  setNote(
    @CurrentUser() admin: AdminActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAdminNoteDto,
  ) {
    return this.candidates.setNote(admin, id, dto);
  }

  @Get(':id/suggested-jobs')
  suggestJobs(@Param('id', ParseUUIDPipe) id: string) {
    return this.candidates.suggestJobs(id);
  }

  @Post(':id/invite')
  invite(
    @CurrentUser() admin: AdminActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteDto,
  ) {
    return this.candidates.invite(admin, id, dto.jobPostingId);
  }

  @Post(':id/to-sourced')
  toSourced(
    @CurrentUser() admin: AdminActor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.candidates.toSourced(admin, id);
  }
}
