import { IsOptional, IsString, MaxLength } from 'class-validator';

// Đợt 12ac (24/09/2026) — sửa 1 địa điểm làm việc đã lưu (mọi trường đều optional — chỉ sửa trường
// nào NTD thực sự thay đổi).
export class UpdateWorkLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}
