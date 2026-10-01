import { Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../database/entities/company.entity';
import { CompanyLogoFinder } from './company-logo-finder.service';

// Đợt 67 — Admin bấm "Dò logo tự động ngay" (mặc định hệ thống cũng tự chạy mỗi 6 giờ).
@Controller('admin/companies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class CompanyLogoController {
  constructor(
    private readonly finder: CompanyLogoFinder,
    @InjectRepository(Company) private readonly repo: Repository<Company>,
  ) {}

  // Đợt 116 — Gợi ý vài ảnh logo để Admin bấm chọn (xem CompanyLogoFinder.suggest).
  @Get(':id/logo-suggestions')
  async suggestions(@Param('id') id: string) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Không tìm thấy công ty');
    return { items: await this.finder.suggest(c.name, c.website) };
  }

  @Post('logo-scan')
  scan(@Query('limit') limit?: string) {
    return this.finder.scan(Math.min(100, Math.max(1, Number(limit) || 40)));
  }
}
