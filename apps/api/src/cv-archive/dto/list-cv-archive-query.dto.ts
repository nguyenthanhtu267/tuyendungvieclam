import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Đợt 18a (26/09/2026) — bộ lọc danh sách Kho CV của NTD.
export class ListCvArchiveQueryDto {
  // Từ khoá tự do: tên, SĐT, email, vị trí, kỹ năng, công ty từng làm, trường học… (không dấu vẫn ra).
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  // Chỉ những người đã ứng tuyển vào 1 tin cụ thể.
  @IsOptional()
  @IsUUID()
  jobId?: string;

  // true = xem thùng rác.
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  trash?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}
