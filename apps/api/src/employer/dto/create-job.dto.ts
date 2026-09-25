import { IsArray, IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Ứng với màn B2 (Đăng tin tuyển dụng) trong mockup — wizard 4 bước, gửi 1 lần khi hoàn tất.
export class CreateJobDto {
  @IsNotEmpty({ message: 'Vui lòng nhập chức danh' })
  title: string;

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

  // Đợt 14 (25/09/2026) — mục 15: "Quyền lợi được hưởng" đổi từ mảng chip sang rich text tự do
  // (HTML), giống `description`/`requirements`.
  @IsOptional()
  @IsString()
  benefits?: string;

  @IsOptional()
  @IsString()
  deadline?: string;

  // Đợt 12k (21/09/2026) — khối "Địa điểm làm việc" (địa chỉ chi tiết) và "Thông tin khác" trên
  // trang chi tiết tin, theo mẫu careerviet.vn. Đều không bắt buộc.
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

  // Đợt 12aa (24/09/2026) — "Thông tin liên hệ" (không bắt buộc), theo mẫu careerviet.vn.
  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email liên hệ không hợp lệ' })
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  // Đợt 14 (25/09/2026) — mục 15: khung mô tả thêm tự do cạnh 3 trường liên hệ có cấu trúc ở trên.
  @IsOptional()
  @IsString()
  contactNote?: string;
}
