import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

// Đợt 23 (29/09/2026) — cấu hình nhãn quảng bá cạnh logo. `url` cho phép rỗng (xoá link) nhưng nếu có
// thì phải là http/https (chặn javascript:).
export class UpdatePromoBadgeDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  text: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== '' && v !== null)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Link phải bắt đầu bằng http:// hoặc https://' },
  )
  @MaxLength(1000)
  url?: string | null;
}
