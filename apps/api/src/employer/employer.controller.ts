import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EmployerService } from './employer.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateLegalDocLinkDto } from './dto/create-legal-doc-link.dto';
import { CreateSubAccountDto } from './dto/create-sub-account.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { ListApplicantsQueryDto } from './dto/list-applicants-query.dto';
import { RateApplicationDto } from './dto/rate-application.dto';
import { SetApplicationFolderDto } from './dto/set-application-folder.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

const ALLOWED_LEGAL_DOC_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);

@Controller()
@UseGuards(JwtAuthGuard)
export class EmployerController {
  constructor(private readonly employerService: EmployerService) {}

  @Get('employer/company')
  getCompany(@CurrentUser() user: { userId: string }) {
    return this.employerService.getMyCompany(user.userId);
  }

  @Patch('employer/company')
  updateCompany(@CurrentUser() user: { userId: string }, @Body() dto: UpdateCompanyDto) {
    return this.employerService.updateCompany(user.userId, dto);
  }

  @Post('employer/company/legal-doc/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      // Lưu vào bộ nhớ (không ghi ổ đĩa) — service lưu buffer thẳng vào CSDL, xem lý do trong
      // company.entity.ts (đợt 7, 18/09/2026: máy chủ miễn phí không có ổ đĩa cố định).
      storage: memoryStorage(),
      limits: { fileSize: 3 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_LEGAL_DOC_MIME.has(file.mimetype)) {
          cb(new BadRequestException('Chỉ chấp nhận tệp PDF, Word hoặc ảnh (JPG/PNG)'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadLegalDoc(@CurrentUser() user: { userId: string }, @UploadedFile() file: Express.Multer.File) {
    return this.employerService.addLegalDocFromUpload(user.userId, file);
  }

  @Post('employer/company/legal-doc/link')
  addLegalDocLink(@CurrentUser() user: { userId: string }, @Body() dto: CreateLegalDocLinkDto) {
    return this.employerService.addLegalDocFromLink(user.userId, dto.externalLinkUrl);
  }

  @Get('employer/team')
  listTeam(@CurrentUser() user: { userId: string }) {
    return this.employerService.listTeam(user.userId);
  }

  @Post('employer/team')
  addSubAccount(@CurrentUser() user: { userId: string }, @Body() dto: CreateSubAccountDto) {
    return this.employerService.addSubAccount(user.userId, dto);
  }

  @Delete('employer/team/:id')
  removeSubAccount(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.employerService.removeSubAccount(user.userId, id);
  }

  @Get('employer/packages')
  listPackages() {
    return this.employerService.listPackages();
  }

  @Get('employer/orders')
  listOrders(@CurrentUser() user: { userId: string }) {
    return this.employerService.listOrders(user.userId);
  }

  @Post('employer/orders')
  createOrder(@CurrentUser() user: { userId: string }, @Body() dto: CreateOrderDto) {
    return this.employerService.createOrder(user.userId, dto);
  }

  @Get('employer/dashboard')
  getDashboard(@CurrentUser() user: { userId: string }) {
    return this.employerService.getDashboard(user.userId);
  }

  @Get('employer/jobs')
  listJobs(@CurrentUser() user: { userId: string }, @Query() query: ListJobsQueryDto) {
    return this.employerService.listMyJobs(user.userId, query.status);
  }

  // Route tĩnh — phải khai báo TRƯỚC 'employer/jobs/:id' cùng cấp, nếu không Nest sẽ khớp nhầm
  // 'status-counts' vào tham số :id (bài học đã rút ra từ các đợt trước).
  @Get('employer/jobs/status-counts')
  countMyJobsByStatus(@CurrentUser() user: { userId: string }) {
    return this.employerService.countMyJobsByStatus(user.userId);
  }

  @Post('employer/jobs')
  createJob(@CurrentUser() user: { userId: string }, @Body() dto: CreateJobDto) {
    return this.employerService.createJob(user.userId, dto);
  }

  @Get('employer/jobs/:id')
  getJob(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.employerService.getJob(user.userId, id);
  }

  // Đợt 12l (21/09/2026) — NTD sửa tin đã đăng. Lưu xong luôn quay về PENDING chờ Admin duyệt lại.
  @Patch('employer/jobs/:id')
  updateJob(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.employerService.updateJob(user.userId, id, dto);
  }

  @Patch('employer/jobs/:id/pause')
  pauseJob(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.employerService.pauseJob(user.userId, id);
  }

  @Patch('employer/jobs/:id/resume')
  resumeJob(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.employerService.resumeJob(user.userId, id);
  }

  @Post('employer/jobs/:id/duplicate')
  duplicateJob(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.employerService.duplicateJob(user.userId, id);
  }

  @Get('employer/jobs/:id/applicants')
  listApplicants(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Query() query: ListApplicantsQueryDto,
  ) {
    return this.employerService.listApplicants(user.userId, id, query);
  }

  @Get('employer/jobs/:id/applicants/trash')
  listTrashedApplicants(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.employerService.listTrashedApplicants(user.userId, id);
  }

  @Get('employer/folders')
  listFolders(@CurrentUser() user: { userId: string }) {
    return this.employerService.listFolders(user.userId);
  }

  @Patch('employer/applications/:id/status')
  updateApplicationStatus(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.employerService.updateApplicationStatus(user.userId, id, dto.status);
  }

  @Patch('employer/applications/:id/rating')
  rateApplication(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: RateApplicationDto,
  ) {
    return this.employerService.rateApplication(user.userId, id, dto.rating);
  }

  @Patch('employer/applications/:id/folder')
  setApplicationFolder(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: SetApplicationFolderDto,
  ) {
    return this.employerService.setApplicationFolder(user.userId, id, dto.folder);
  }

  @Post('employer/applications/:id/trash')
  trashApplication(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.employerService.trashApplication(user.userId, id);
  }

  @Post('employer/applications/:id/restore')
  restoreApplication(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.employerService.restoreApplication(user.userId, id);
  }

  @Delete('employer/applications/:id')
  permanentlyDeleteApplication(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.employerService.permanentlyDeleteApplication(user.userId, id);
  }
}
