import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Đợt 29/30b — cấu hình nền giao diện: cố định 1 mẫu · tự động đổi mỗi `hours` giờ · không dùng nền.
// Mã mẫu là mẫu vector ("neural-1"…) hoặc ảnh tải lên ("img-<uuid>") — service kiểm tra lại có tồn tại.
export class UpdateBackgroundDto {
  @IsIn(['fixed', 'auto', 'none'])
  mode: 'fixed' | 'auto' | 'none';

  @IsString()
  @MaxLength(60)
  theme: string;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  autoThemes: string[];

  @IsInt()
  @Min(1)
  @Max(24)
  hours: number;
}

export class UpdateBgImageDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  overlay?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

export class UploadBgImageDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Matches(/^\d{1,2}$/)
  overlay?: string;

  @IsOptional()
  @Matches(/^\d{1,5}$/)
  width?: string;

  @IsOptional()
  @Matches(/^\d{1,5}$/)
  height?: string;
}
