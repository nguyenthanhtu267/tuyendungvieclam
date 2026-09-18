import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProfileVisibility } from '../../database/entities/candidate-profile.entity';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  desiredPosition?: string;

  @IsOptional()
  @IsString()
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
  @IsIn(Object.values(ProfileVisibility))
  visibility?: ProfileVisibility;

  @IsOptional()
  @IsBoolean()
  allowJobNotifications?: boolean;
}
