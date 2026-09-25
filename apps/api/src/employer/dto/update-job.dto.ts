import { IsArray, IsBoolean, IsEmail, IsInt, IsOptional, IsString, Min } from 'class-validator';
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

  // Đợt 14 (25/09/2026) — mục 15: "Quyền lợi được hưởng" đổi từ mảng chip sang rich text tự do (HTML).
  @IsOptional()
  @IsString()
  benefits?: string;

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
