import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Đợt 17 (25/09/2026) — "Nguồn ngoài / Tin tổng hợp": Admin tạo hộ 1 hồ sơ công ty + tài khoản NTD
// (employer_main) chưa từng đăng nhập, để đăng tin hộ trước khi công ty thật "nhận lại" (xem
// AdminService.createDraftCompany()). Không cần mã số thuế thật (tự sinh "DRAFT-xxxxxx", đúng theo
// lựa chọn người dùng qua AskUserQuestion) — công ty cập nhật mã số thuế thật khi claim.
export class CreateDraftCompanyDto {
  @IsNotEmpty({ message: 'Vui lòng nhập tên công ty' })
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Nhãn nguồn tự do (VD "Tổng hợp từ careerviet.vn", "Nhóm Facebook ...") — hiển thị cạnh badge FE.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceLabel?: string;
}
