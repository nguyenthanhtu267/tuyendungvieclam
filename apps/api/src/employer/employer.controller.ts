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
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { EmployerService } from './employer.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateLegalDocLinkDto } from './dto/create-legal-doc-link.dto';
import { CreateSubAccountDto } from './dto/create-sub-account.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ApplicationStatus } from '../database/entities/application.entity';

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
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'legal'),
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
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
  listJobs(@CurrentUser() user: { userId: string }) {
    return this.employerService.listMyJobs(user.userId);
  }

  @Post('employer/jobs')
  createJob(@CurrentUser() user: { userId: string }, @Body() dto: CreateJobDto) {
    return this.employerService.createJob(user.userId, dto);
  }

  @Get('employer/jobs/:id')
  getJob(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.employerService.getJob(user.userId, id);
  }

  @Get('employer/jobs/:id/applicants')
  listApplicants(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Query('status') status?: ApplicationStatus,
  ) {
    return this.employerService.listApplicants(user.userId, id, status);
  }

  @Patch('employer/applications/:id/status')
  updateApplicationStatus(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.employerService.updateApplicationStatus(user.userId, id, dto.status);
  }
}
