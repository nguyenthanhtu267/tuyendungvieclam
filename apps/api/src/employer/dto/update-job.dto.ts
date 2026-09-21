import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Đợt 12l (21/09/2026) — sửa tin đã đăng. Khác CreateJobDto ở chỗ MỌI trường đều optional (kể cả
// title) — người dùng chỉ gửi những trường thực sự thay đổi trên form; các trường không gửi giữ
// nguyên giá trị cũ. Sau khi lưu, tin luôn quay về PENDING chờ Admin duyệt lại (xem updateJob() ở
// employer.service.ts) — theo quyết định người dùng chốt đợt 12l, nhất quán với "Sao chép tin".
export class UpdateJobDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsArray()
  provinces?: string[];

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  experienceLevel?: string;

  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;

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
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  headcount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsArray()
  benefits?: string[];

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  ageRange?: string;

  @IsOptional()
  @IsString()
  workSchedule?: string;

  // Đợt 12v (21/09/2026) — "JOB TAGS / SKILLS", thẻ tự nhập tự do (không bắt buộc).
  @IsOptional()
  @IsArray()
  tags?: string[];
}
