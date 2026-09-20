import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

// Nhận cả 2 kiểu query string: ?provinces=a&provinces=b  hoặc  ?provinces=a,b
function toArray({ value }: { value: unknown }): string[] | undefined {
  if (value == null || value === '') return undefined;
  const arr = Array.isArray(value) ? value : String(value).split(',');
  const cleaned = arr.map((v) => String(v).trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
}

function toBool({ value }: { value: unknown }): boolean | undefined {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
}

export const POSTED_WITHIN_DAYS: Record<string, number> = {
  '3d': 3,
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

export class ListJobsDto {
  @IsOptional()
  @IsString()
  q?: string;

  // Giữ lại cho tương thích ngược (trang chủ/tin cũ dùng ?location=)
  @IsOptional()
  @IsString()
  location?: string;

  // Giữ lại cho tương thích ngược (?industry= đơn)
  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @Transform(toArray)
  provinces?: string[];

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @Transform(toArray)
  industries?: string[];

  // Mức lương tối thiểu mong muốn (triệu VNĐ) — khớp nếu tin trả >= mức này (theo mức lương Min hoặc Max).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryTier?: number;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsIn(Object.keys(POSTED_WITHIN_DAYS))
  postedWithin?: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsString()
  experienceLevel?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  urgentOnly?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  featuredEmployerOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 10;
}
