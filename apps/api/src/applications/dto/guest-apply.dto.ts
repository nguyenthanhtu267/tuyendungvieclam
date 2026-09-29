import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// Đợt 22 (29/09/2026) — ứng tuyển KHÔNG cần đăng nhập. Gửi dạng multipart: các trường chữ dưới đây +
// `file` (tuỳ chọn). Bắt buộc có ĐÚNG 1 trong 2: file CV hoặc `cvLink` (link Google Drive/Dropbox...) — kiểm
// tra ở ApplicationsService.applyAsGuest().
export class GuestApplyDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ và tên' })
  @MinLength(2, { message: 'Họ và tên quá ngắn' })
  @MaxLength(120)
  fullName: string;

  @IsString()
  @Matches(/^[0-9+().\-\s]{8,20}$/, { message: 'Số điện thoại không hợp lệ' })
  phone: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(150)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coverLetter?: string;

  @IsOptional()
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    {
      message:
        'Link CV không hợp lệ (cần bắt đầu bằng http:// hoặc https://, ví dụ link chia sẻ Google Drive)',
    },
  )
  @MaxLength(1000)
  cvLink?: string;
}
