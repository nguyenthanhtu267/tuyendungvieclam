import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

// Nhận cả 2 kiểu query string: ?skills=a&skills=b  hoặc  ?skills=a,b
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

export class SearchCandidatesDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(toArray)
  industries?: string[];

  @IsOptional()
  @Transform(toArray)
  locations?: string[];

  // Kỹ năng — phải khớp TẤT CẢ (theo quyết định đã chốt), không phải khớp bất kỳ.
  @IsOptional()
  @Transform(toArray)
  skills?: string[];

  @IsOptional()
  @IsString()
  desiredLevel?: string;

  @IsOptional()
  @IsString()
  highestDegree?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  experienceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  experienceMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  urgentOnly?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  unlockedOnly?: boolean;

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
