import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Đợt 12ac (24/09/2026) — "Quản lý địa điểm làm việc": NTD lưu sẵn các địa điểm hay dùng (tên gợi
// nhớ + tỉnh/thành + quận/huyện + địa chỉ chi tiết, đều là text thuần — CHƯA tích hợp bản đồ thật
// vì Goong Maps là API trả phí, theo quyết định đã chốt là dùng text đơn giản trước).
export class CreateWorkLocationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  province: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}
