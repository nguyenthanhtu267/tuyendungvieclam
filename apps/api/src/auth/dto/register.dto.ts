import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsString } from 'class-validator';

// Ứng với màn A4 (Đăng ký) trong mockup — đăng ký bằng email/mật khẩu.
export class RegisterDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  password: string;

  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
