import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsString } from 'class-validator';

// Đăng ký tài khoản Nhà tuyển dụng (màn B — chưa có trong mockup 11 màn hình gốc, bổ sung
// theo nhu cầu tất yếu: NTD cần tài khoản riêng để đăng tin). Tạo đồng thời User(employer_main)
// + Company + liên kết CompanyUser(main).
export class RegisterEmployerDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  password: string;

  @IsNotEmpty({ message: 'Vui lòng nhập họ tên người liên hệ' })
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsNotEmpty({ message: 'Vui lòng nhập tên công ty' })
  companyName: string;

  @IsNotEmpty({ message: 'Vui lòng nhập mã số thuế' })
  taxCode: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  website?: string;
}
