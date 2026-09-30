import { Controller, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';
import { CompanyLogoFinder } from './company-logo-finder.service';

// Đợt 67 — Admin bấm "Dò logo tự động ngay" (mặc định hệ thống cũng tự chạy mỗi 6 giờ).
@Controller('admin/companies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class CompanyLogoController {
  constructor(private readonly finder: CompanyLogoFinder) {}

  @Post('logo-scan')
  scan(@Query('limit') limit?: string) {
    return this.finder.scan(Math.min(100, Math.max(1, Number(limit) || 40)));
  }
}
