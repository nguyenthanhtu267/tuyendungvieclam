import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

// Màn B5 "Tài khoản phụ" — Tài khoản Chính tạo trực tiếp thông tin đăng nhập cho Tài khoản Phụ
// (không gửi email mời, vì Giai đoạn 1 không dùng email/SMS cho việc này — theo quyết định đã chốt).
export class CreateSubAccountDto {
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
