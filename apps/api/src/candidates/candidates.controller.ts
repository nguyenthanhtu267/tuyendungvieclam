import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CandidatesService } from './candidates.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateCvLinkDto } from './dto/create-cv-link.dto';
import { BlockCompanyDto } from './dto/block-company.dto';
import { SaveSearchDto } from './dto/save-search.dto';

const ALLOWED_CV_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

@Controller()
@UseGuards(JwtAuthGuard)
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get('me/profile')
  getProfile(@CurrentUser() user: { userId: string }) {
    return this.candidatesService.getOwnProfile(user.userId);
  }

  @Patch('me/profile')
  updateProfile(@CurrentUser() user: { userId: string }, @Body() dto: UpdateProfileDto) {
    return this.candidatesService.updateOwnProfile(user.userId, dto);
  }

  @Get('me/cvs')
  listCvs(@CurrentUser() user: { userId: string }) {
    return this.candidatesService.listOwnCvs(user.userId);
  }

  @Post('me/cvs/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      // Lưu vào bộ nhớ (không ghi ổ đĩa) — service sẽ lưu buffer thẳng vào CSDL, xem lý do trong
      // cv.entity.ts (đợt 7, 18/09/2026: máy chủ miễn phí không có ổ đĩa cố định).
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_CV_MIME.has(file.mimetype)) {
          cb(new BadRequestException('Chỉ chấp nhận tệp PDF hoặc Word (.doc, .docx)'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadCv(@CurrentUser() user: { userId: string }, @UploadedFile() file: Express.Multer.File) {
    return this.candidatesService.addCvFromUpload(user.userId, file);
  }

  @Post('me/cvs/link')
  addCvLink(@CurrentUser() user: { userId: string }, @Body() dto: CreateCvLinkDto) {
    return this.candidatesService.addCvFromLink(user.userId, dto.externalLinkUrl);
  }

  @Delete('me/cvs/:id')
  removeCv(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.candidatesService.removeCv(user.userId, id);
  }

  @Patch('me/cvs/:id/primary')
  setPrimaryCv(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.candidatesService.setPrimaryCv(user.userId, id);
  }

  @Get('me/saved-jobs')
  listSavedJobs(@CurrentUser() user: { userId: string }) {
    return this.candidatesService.listSavedJobs(user.userId);
  }

  @Post('me/saved-jobs/:jobId')
  saveJob(@CurrentUser() user: { userId: string }, @Param('jobId') jobId: string) {
    return this.candidatesService.saveJob(user.userId, jobId);
  }

  @Delete('me/saved-jobs/:jobId')
  unsaveJob(@CurrentUser() user: { userId: string }, @Param('jobId') jobId: string) {
    return this.candidatesService.unsaveJob(user.userId, jobId);
  }

  @Get('me/blocked-companies')
  listBlockedCompanies(@CurrentUser() user: { userId: string }) {
    return this.candidatesService.listBlockedCompanies(user.userId);
  }

  @Post('me/blocked-companies')
  blockCompany(@CurrentUser() user: { userId: string }, @Body() dto: BlockCompanyDto) {
    return this.candidatesService.blockCompany(user.userId, dto);
  }

  @Delete('me/blocked-companies/:id')
  unblockCompany(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.candidatesService.unblockCompany(user.userId, id);
  }

  @Get('me/saved-searches')
  listSavedSearches(@CurrentUser() user: { userId: string }) {
    return this.candidatesService.listSavedSearches(user.userId);
  }

  @Post('me/saved-searches')
  saveSearch(@CurrentUser() user: { userId: string }, @Body() dto: SaveSearchDto) {
    return this.candidatesService.saveSearch(user.userId, dto);
  }

  @Delete('me/saved-searches/:id')
  removeSavedSearch(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.candidatesService.removeSavedSearch(user.userId, id);
  }

  // Đợt 12p (21/09/2026) — Batch 4 mục #2: gợi ý việc làm chấm điểm đa tiêu chí, xem
  // CandidatesService.getRecommendedJobs().
  @Get('me/job-recommendations')
  getRecommendedJobs(@CurrentUser() user: { userId: string }) {
    return this.candidatesService.getRecommendedJobs(user.userId);
  }
}
