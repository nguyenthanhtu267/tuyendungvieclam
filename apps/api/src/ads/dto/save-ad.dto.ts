import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AD_AUDIENCES, AD_SLOTS, AD_THEMES } from '../ad-slots';

// Đợt 24 — tạo/sửa 1 chiến dịch banner (form Admin luôn gửi đủ các trường).
export class SaveAdDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  eyebrow?: string | null;

  @IsString()
  @MinLength(2)
  @MaxLength(90)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  subtitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  ctaText?: string | null;

  // Link ngoài http(s)://… hoặc đường dẫn nội bộ "/…" (không cho "//" hay javascript:).
  @IsString()
  @MaxLength(1000)
  @Matches(/^(https?:\/\/[^\s/$.?#][^\s]*|\/(?!\/)[^\s]*)$/i, {
    message:
      'Link phải bắt đầu bằng https:// (trang ngoài) hoặc / (trang trong web này)',
  })
  url: string;

  @IsBoolean()
  addUtm: boolean;

  @IsIn(['generated', 'image'])
  bgMode: 'generated' | 'image';

  @IsString()
  @MaxLength(300)
  bgPrompt: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsIn(AD_THEMES as unknown as string[])
  bgTheme?: string | null;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  bgSeed: number;

  @IsIn(['auto', 'light', 'dark'])
  textColor: 'auto' | 'light' | 'dark';

  @IsArray()
  @ArrayNotEmpty({ message: 'Chọn ít nhất 1 khu vực hiển thị' })
  @ArrayMaxSize(20)
  @IsIn(['*', ...AD_SLOTS], { each: true })
  slots: string[];

  @IsArray()
  @ArrayMaxSize(3)
  @IsIn(AD_AUDIENCES as unknown as string[], { each: true })
  audiences: string[];

  @IsIn(['all', 'desktop', 'mobile'])
  device: 'all' | 'desktop' | 'mobile';

  @IsInt()
  @Min(1)
  @Max(10)
  weight: number;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsDateString()
  endsAt?: string | null;

  @IsBoolean()
  enabled: boolean;
}

export class AdSettingsDto {
  @IsBoolean()
  enabled: boolean;

  @IsArray()
  @ArrayMaxSize(20)
  @IsIn(AD_SLOTS as unknown as string[], { each: true })
  disabledSlots: string[];
}
