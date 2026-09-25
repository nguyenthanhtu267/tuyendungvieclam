import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateClaimRequestDto } from './dto/create-claim-request.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get(':id')
  getProfile(@Param('id') id: string) {
    return this.companiesService.getProfile(id);
  }

  // Đợt 17 (25/09/2026) — "Đây là công ty của bạn?": công khai, không cần đăng nhập (xem ghi chú ở
  // CompaniesService.submitClaimRequest()).
  @Post(':id/claim-request')
  submitClaimRequest(@Param('id') id: string, @Body() dto: CreateClaimRequestDto) {
    return this.companiesService.submitClaimRequest(id, dto);
  }
}
