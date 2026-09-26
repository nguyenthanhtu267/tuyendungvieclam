import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../database/entities/user.entity';
import { AdminPeopleService } from './admin-people.service';
import { AdminActor } from './admin-audit';
import {
  PeopleQueryDto,
  UpdateCandidateBasicDto,
  UpdateCompanyInfoDto,
  UpdateUserDto,
} from './dto/admin-tools.dto';

// Đợt 18e (26/09/2026) — Admin "Người dùng": sửa nhanh mọi tài khoản + "Đăng nhập thay".
@Controller('admin/people')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AdminPeopleController {
  constructor(private readonly people: AdminPeopleService) {}

  @Get()
  list(@Query() query: PeopleQueryDto) {
    return this.people.list(query);
  }

  // Các route literal đặt TRƯỚC ':userId'.
  @Patch('companies/:companyId')
  updateCompany(
    @CurrentUser() admin: AdminActor,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateCompanyInfoDto,
  ) {
    return this.people.updateCompany(admin, companyId, dto);
  }

  @Patch('candidates/:profileId')
  updateCandidate(
    @CurrentUser() admin: AdminActor,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: UpdateCandidateBasicDto,
  ) {
    return this.people.updateCandidate(admin, profileId, dto);
  }

  @Get(':userId')
  detail(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.people.detail(userId);
  }

  @Patch(':userId')
  updateUser(
    @CurrentUser() admin: AdminActor,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.people.updateUser(admin, userId, dto);
  }

  @Post(':userId/impersonate')
  impersonate(
    @CurrentUser() admin: AdminActor,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.people.impersonate(admin, userId);
  }
}
