import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { cvUploadInterceptor } from '../cv-archive/cv-archive.controller';
import { fixMulterFilename } from '../common/multer-filename.util';
import { GuestApplyDto } from './dto/guest-apply.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ApplicationsService } from './applications.service';
import { ChooseInterviewDto } from './dto/choose-interview.dto';
import { ApplyJobDto } from './dto/apply-job.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post('jobs/:id/apply')
  apply(
    @CurrentUser() user: { userId: string },
    @Param('id') jobId: string,
    @Body() dto: ApplyJobDto,
  ) {
    return this.applicationsService.apply(user.userId, jobId, dto);
  }

  @Get('me/applications')
  listOwn(@CurrentUser() user: { userId: string }) {
    return this.applicationsService.listOwn(user.userId);
  }

  @Post('me/applications/:id/interview/choose')
  chooseInterview(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChooseInterviewDto,
  ) {
    return this.applicationsService.chooseInterview(user.userId, id, dto.slot);
  }

  @Get('me/applications/:id/history')
  getHistory(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.applicationsService.getHistory(user.userId, id);
  }
}

// Đợt 22 (29/09/2026) — ứng tuyển KHÔNG cần đăng nhập (công khai). Giới hạn 5 lần/10 phút theo IP để chống
// spam; mỗi email chỉ nộp 1 lần cho 1 tin (kiểm tra ở service). Multipart: các trường chữ + `file` tuỳ chọn.
@Controller('public/jobs')
export class PublicApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post(':id/apply')
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @UseInterceptors(cvUploadInterceptor)
  applyAsGuest(
    @Param('id', ParseUUIDPipe) jobId: string,
    @Body() dto: GuestApplyDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      file.originalname =
        fixMulterFilename(file.originalname) ?? file.originalname;
      if (!file.size) throw new BadRequestException('File CV rỗng');
    }
    return this.applicationsService.applyAsGuest(jobId, dto, file);
  }
}
