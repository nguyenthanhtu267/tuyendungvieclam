import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApplicationStatus } from '../../database/entities/application.entity';

// Đợt 11b — Mục #4 ATS: bộ lọc nâng cao cho danh sách ứng viên theo tin (trạng thái, thư mục, đánh
// giá tối thiểu, từ khoá tên/vị trí mong muốn, khoảng ngày nộp).
export class ListApplicantsQueryDto {
  @IsOptional()
  @IsEnum(ApplicationStatus, { message: 'Trạng thái không hợp lệ' })
  status?: ApplicationStatus;

  @IsOptional()
  @IsString()
  folder?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  ratingMin?: number;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}
