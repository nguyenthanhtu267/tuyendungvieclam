import { IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, MaritalStatus, ProfileVisibility } from '../../database/entities/candidate-profile.entity';
import { LanguageLevel, SkillLevel } from '../../database/entities/candidate-sections.entity';

// Đợt 8 — DTO cho các mục hồ sơ 13 mục. Vì 1 route dùng chung cho 8 mục dạng danh sách, việc
// kiểm tra dữ liệu (validate) được gọi thủ công ở ProfileService theo từng loại mục thay vì để
// Nest tự áp ValidationPipe theo route.

export class UpdatePersonalInfoDto {
  @IsOptional() @IsString() profileTitle?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsDateString({}, { message: 'Ngày sinh không hợp lệ' }) dateOfBirth?: string;
  @IsOptional() @IsIn(Object.values(Gender), { message: 'Giới tính không hợp lệ' }) gender?: Gender;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail({}, { message: 'Email liên hệ không hợp lệ' }) contactEmail?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsIn(Object.values(MaritalStatus), { message: 'Tình trạng hôn nhân không hợp lệ' }) maritalStatus?: MaritalStatus;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsBoolean() hideContactInfo?: boolean;
}

export class UpdateCareerInfoDto {
  @IsOptional() @IsString() careerObjective?: string;
  @IsOptional() @IsString() desiredPosition?: string;
  @IsOptional() @IsString() desiredLevel?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) desiredSalaryMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) desiredSalaryMax?: number;
  @IsOptional() @IsString() salaryCurrency?: string;
  @IsOptional() @IsArray() desiredIndustries?: string[];
  @IsOptional() @IsArray() desiredLocations?: string[];
  @IsOptional() @IsArray() desiredJobTypes?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) yearsOfExperience?: number;
  @IsOptional() @IsString() currentLevel?: string;
  @IsOptional() @IsString() highestDegree?: string;
}

export class QuickFieldsDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() desiredPosition?: string;
  @IsOptional() @IsString() desiredLevel?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) desiredSalaryMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) desiredSalaryMax?: number;
  @IsOptional() @IsIn(Object.values(ProfileVisibility)) visibility?: ProfileVisibility;
  @IsOptional() @IsBoolean() allowJobNotifications?: boolean;
}

export class ExperienceDto {
  @IsNotEmpty({ message: 'Vui lòng nhập chức danh' }) @IsString() position: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsDateString({}, { message: 'Từ ngày không hợp lệ' }) startDate?: string;
  @IsOptional() @IsDateString({}, { message: 'Đến ngày không hợp lệ' }) endDate?: string;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
  @IsOptional() @IsString() description?: string;
}

export class EducationDto {
  @IsOptional() @IsString() schoolName?: string;
  @IsOptional() @IsString() degree?: string;
  @IsOptional() @IsString() major?: string;
  @IsOptional() @IsDateString({}, { message: 'Từ ngày không hợp lệ' }) startDate?: string;
  @IsOptional() @IsDateString({}, { message: 'Đến ngày không hợp lệ' }) endDate?: string;
}

export class CertificateDto {
  @IsNotEmpty({ message: 'Vui lòng nhập tên chứng chỉ' }) @IsString() name: string;
  @IsOptional() @IsString() issuer?: string;
  @IsOptional() @IsDateString({}, { message: 'Ngày cấp không hợp lệ' }) issueDate?: string;
}

export class LanguageDto {
  @IsNotEmpty({ message: 'Vui lòng nhập tên ngôn ngữ' }) @IsString() language: string;
  @IsNotEmpty({ message: 'Vui lòng chọn trình độ' }) @IsIn(Object.values(LanguageLevel)) level: LanguageLevel;
}

export class SkillDto {
  @IsNotEmpty({ message: 'Vui lòng nhập tên kỹ năng' }) @IsString() skillName: string;
  @IsNotEmpty({ message: 'Vui lòng chọn mức độ' }) @IsIn(Object.values(SkillLevel)) level: SkillLevel;
}

export class AchievementDto {
  @IsNotEmpty({ message: 'Vui lòng nhập tên thành tích' }) @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString({}, { message: 'Ngày không hợp lệ' }) date?: string;
}

export class ActivityDto {
  @IsNotEmpty({ message: 'Vui lòng nhập tên hoạt động' }) @IsString() title: string;
  @IsOptional() @IsString() organizationName?: string;
  @IsOptional() @IsDateString({}, { message: 'Từ ngày không hợp lệ' }) startDate?: string;
  @IsOptional() @IsDateString({}, { message: 'Đến ngày không hợp lệ' }) endDate?: string;
  @IsOptional() @IsString() description?: string;
}

export class ReferenceDto {
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên người tham khảo' }) @IsString() fullName: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail({}, { message: 'Email không hợp lệ' }) email?: string;
}
