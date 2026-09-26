import { BadRequestException } from '@nestjs/common';
import { plainToInstance, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  validateSync,
} from 'class-validator';

// Đợt 18c/18d (26/09/2026) — "bản nháp hồ sơ ứng viên": dữ liệu đã được tách tự động (từ nội dung dán
// vào / file CV / đường link) rồi người dùng xem lại & sửa trên form trước khi lưu. Dùng CHUNG cho:
//  - Admin tạo "hồ sơ nguồn tổng hợp" (18c)
//  - NTD tự nhập CV từ nguồn ngoài vào Kho CV (18d)

export class DraftExperienceDto {
  @IsString()
  @IsNotEmpty({ message: 'Kinh nghiệm: vui lòng nhập chức danh' })
  @MaxLength(150)
  position: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}

export class DraftEducationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  degree?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  major?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;
}

export class DraftLanguageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  language: string;

  @IsOptional()
  @IsIn(['native', 'excellent', 'good', 'fair', 'beginner'])
  level?: string;
}

export class CandidateDraftDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên ứng viên' })
  @MaxLength(120)
  fullName: string;

  // Tiêu đề hồ sơ (VD "Kế toán tổng hợp 5 năm kinh nghiệm") — bắt buộc với hồ sơ nguồn tổng hợp vì
  // Tìm CV chỉ hiện hồ sơ có tiêu đề (kiểm tra ở tầng service tuỳ nơi dùng).
  @IsOptional()
  @IsString()
  @MaxLength(200)
  profileTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsISO8601()
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(['male', 'female', 'other'])
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  desiredPosition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  desiredLevel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  desiredSalaryMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  desiredSalaryMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  yearsOfExperience?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  highestDegree?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  careerObjective?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  desiredIndustries?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  desiredLocations?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => DraftExperienceDto)
  experiences?: DraftExperienceDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @ValidateNested({ each: true })
  @Type(() => DraftEducationDto)
  educations?: DraftEducationDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @ValidateNested({ each: true })
  @Type(() => DraftLanguageDto)
  languages?: DraftLanguageDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  certificates?: string[];

  // Toàn văn gốc (nội dung dán vào hoặc chữ đọc từ file) — lưu kèm để không bao giờ "sót nội dung"
  // và để tìm kiếm theo bất kỳ chữ nào trong CV.
  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  rawText?: string;

  // Nhãn nguồn nội bộ (VD "LinkedIn", "Nhóm Facebook Tuyển dụng Kế toán") — chỉ Admin/NTD sở hữu thấy.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  sourceUrl?: string;

  // Chỉ dùng cho NTD nhập CV (18d): gắn CV này vào 1 tin đang tuyển của công ty (không bắt buộc).
  @IsOptional()
  @IsUUID()
  jobPostingId?: string;
}

// Form gửi kèm file (multipart) → phần dữ liệu nằm trong 1 trường JSON `payload`, phải tự kiểm tra lại
// bằng class-validator (ValidationPipe toàn cục không tự áp dụng cho chuỗi JSON lồng bên trong).
export function parseDraftPayload(payload: unknown): CandidateDraftDto {
  let obj: unknown = payload;
  if (typeof payload === 'string') {
    try {
      obj = JSON.parse(payload);
    } catch {
      throw new BadRequestException('Dữ liệu hồ sơ không hợp lệ');
    }
  }
  if (!obj || typeof obj !== 'object')
    throw new BadRequestException('Thiếu dữ liệu hồ sơ');
  const dto = plainToInstance(CandidateDraftDto, obj);
  const errors = validateSync(dto, { whitelist: true });
  if (errors.length > 0) {
    const messages = errors.flatMap((e) => [
      ...Object.values(e.constraints ?? {}),
      ...(e.children ?? []).flatMap((c) =>
        (c.children ?? []).flatMap((cc) => Object.values(cc.constraints ?? {})),
      ),
    ]);
    throw new BadRequestException(
      messages.length ? messages : 'Dữ liệu hồ sơ không hợp lệ',
    );
  }
  return dto;
}
