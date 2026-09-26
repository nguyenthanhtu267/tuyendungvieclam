import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UserRole, UserStatus } from '../../database/entities/user.entity';
import { ProfileVisibility } from '../../database/entities/candidate-profile.entity';

// Đợt 18c/18e/18f (26/09/2026) — DTO cho module admin-tools.

// ---------- 18c — hàng chờ chia sẻ / yêu cầu gỡ-nhận lại ----------

export class SetAutoShareDto {
  @IsBoolean()
  enabled: boolean;
}

export class QueueQueryDto {
  @IsOptional()
  @IsIn(['pending', 'shared', 'already_public', 'dismissed'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

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

export class ListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

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

export class CreateProfileRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  @MaxLength(120)
  fullName: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(150)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsIn(['remove', 'claim'], { message: 'Vui lòng chọn loại yêu cầu' })
  requestType: 'remove' | 'claim';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class ResolveRequestDto {
  @IsUUID()
  profileId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}

export class RejectRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}

export class RequestsQueryDto {
  @IsOptional()
  @IsIn(['pending', 'resolved', 'rejected'])
  status?: string;
}

// ---------- 18e — quản lý người dùng ----------

export class PeopleQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(['candidate', 'employer', 'admin'])
  role?: 'candidate' | 'employer' | 'admin';

  @IsOptional()
  @IsIn(Object.values(UserStatus))
  status?: UserStatus;

  // Mặc định ẩn tài khoản nội bộ của hồ sơ nguồn tổng hợp (xem ở tab Nguồn ngoài).
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeSourced?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsIn(Object.values(UserStatus))
  status?: UserStatus;

  // Chỉ Admin (không phải Moderator) đổi được, và chỉ giữa 2 vai trò quản trị.
  @IsOptional()
  @IsIn([UserRole.ADMIN, UserRole.MODERATOR])
  role?: UserRole.ADMIN | UserRole.MODERATOR;
}

export class UpdateCompanyInfoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  taxCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  size?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;
}

export class UpdateCandidateBasicDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName?: string;

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
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  desiredPosition?: string;

  @IsOptional()
  @IsIn(Object.values(ProfileVisibility))
  visibility?: ProfileVisibility;

  @IsOptional()
  @IsBoolean()
  hideContactInfo?: boolean;
}

// ---------- 18f — quản lý ứng viên ----------

export class CandidatesQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(['none', 'any'])
  applied?: 'none' | 'any';

  @IsOptional()
  @IsIn(Object.values(ProfileVisibility))
  visibility?: ProfileVisibility;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  completionMin?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  skill?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  tag?: string;

  @IsOptional()
  @IsIn(['only', 'exclude'])
  sourced?: 'only' | 'exclude';
}

export class SetAdminNoteDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;
}

export class InviteDto {
  @IsUUID()
  jobPostingId: string;
}
