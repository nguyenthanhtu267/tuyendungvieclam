import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { IsString, IsUrl, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../database/entities/user.entity';
import { CvArchiveService } from './cv-archive.service';
import { ListCvArchiveQueryDto } from './dto/list-cv-archive-query.dto';
import { parseDraftPayload } from '../common/dto/candidate-draft.dto';

// Đợt 18a (26/09/2026) — "Kho CV" của nhà tuyển dụng. Mọi route đều giới hạn trong công ty gắn với tài
// khoản đang đăng nhập (tra bảng company_users, giống EmployerService). Tệp CV trong kho BẮT BUỘC đăng
// nhập mới tải được (khác /files/cv/:id công khai-nếu-có-link) vì đây là dữ liệu lưu trữ riêng của NTD.

// File CV lưu vào kho (NTD nhập, Admin tạo hồ sơ) — cùng giới hạn nhẹ như chiến lược lưu trong CSDL.
export const CV_STORE_MAX_BYTES = 3 * 1024 * 1024;
export const CV_STORE_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);

export const cvUploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: CV_STORE_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!CV_STORE_MIME.has(file.mimetype)) {
      cb(
        new BadRequestException(
          'Chỉ nhận file PDF, Word (.doc/.docx) hoặc ảnh JPG/PNG',
        ),
        false,
      );
      return;
    }
    cb(null, true);
  },
});

@Controller('employer/cv-archive')
@UseGuards(JwtAuthGuard)
export class CvArchiveController {
  constructor(private readonly cvArchiveService: CvArchiveService) {}

  @Get()
  list(
    @CurrentUser() user: { userId: string },
    @Query() query: ListCvArchiveQueryDto,
  ) {
    return this.cvArchiveService.list(user.userId, query);
  }

  // Khai báo TRƯỚC ':id' để "jobs" không bị hiểu là 1 id.
  @Get('jobs')
  listJobs(@CurrentUser() user: { userId: string }) {
    return this.cvArchiveService.listJobs(user.userId);
  }

  // Đợt 18d — NTD tự nhập CV từ nguồn ngoài. multipart: `payload` (JSON bản nháp hồ sơ) + `file` (tuỳ chọn).
  @Post('import')
  @UseInterceptors(cvUploadInterceptor)
  importCv(
    @CurrentUser() user: { userId: string },
    @Body('payload') payload: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const dto = parseDraftPayload(payload);
    return this.cvArchiveService.importFromDraft(user.userId, dto, file);
  }

  @Get('entries/:entryId/file')
  async getFile(
    @CurrentUser() user: { userId: string },
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Res() res: Response,
  ) {
    const entry = await this.cvArchiveService.getFile(user.userId, entryId);
    sendCvFile(res, entry);
  }

  @Get(':id')
  detail(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cvArchiveService.detail(user.userId, id);
  }

  @Post(':id/trash')
  trash(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cvArchiveService.trash(user.userId, id);
  }

  @Post(':id/restore')
  restore(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cvArchiveService.restore(user.userId, id);
  }
}

export function sendCvFile(
  res: Response,
  entry: {
    cvMimeType?: string | null;
    cvFileName?: string | null;
    cvFileData?: Buffer | null;
  },
) {
  res.set({
    'Content-Type': entry.cvMimeType || 'application/octet-stream',
    'Content-Disposition': `inline; filename="${encodeURIComponent(entry.cvFileName || 'cv')}"`,
  });
  res.send(entry.cvFileData);
}

class ParseTextDto {
  @IsString()
  @MaxLength(100_000)
  text: string;
}

class ParseUrlDto {
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    { message: 'Đường link không hợp lệ' },
  )
  @MaxLength(1000)
  url: string;
}

const PARSE_ROLES = new Set<string>([
  UserRole.EMPLOYER_MAIN,
  UserRole.EMPLOYER_SUB,
  UserRole.ADMIN,
  UserRole.MODERATOR,
]);

// Đợt 18b (26/09/2026) — đọc & tách CV cho form "Thêm CV" (NTD — Kho CV) và "Thêm hồ sơ nguồn tổng
// hợp" (Admin). Chỉ trả kết quả để người dùng xem lại, KHÔNG lưu gì.
@Controller('cv-parse')
@UseGuards(JwtAuthGuard)
export class CvParseController {
  constructor(private readonly cvArchiveService: CvArchiveService) {}

  private assertRole(role: string) {
    if (!PARSE_ROLES.has(role))
      throw new ForbiddenException(
        'Chức năng dành cho nhà tuyển dụng và Admin',
      );
  }

  @Post('text')
  parseText(@CurrentUser() user: { role: string }, @Body() dto: ParseTextDto) {
    this.assertRole(user.role);
    return this.cvArchiveService.parseText(dto.text);
  }

  @Post('file')
  @UseInterceptors(cvUploadInterceptor)
  parseFile(
    @CurrentUser() user: { role: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.assertRole(user.role);
    if (!file) throw new BadRequestException('Vui lòng chọn file CV');
    return this.cvArchiveService.parseFile(
      file.buffer,
      file.mimetype,
      file.originalname,
    );
  }

  @Post('url')
  parseUrl(@CurrentUser() user: { role: string }, @Body() dto: ParseUrlDto) {
    this.assertRole(user.role);
    return this.cvArchiveService.parseUrl(dto.url);
  }
}
