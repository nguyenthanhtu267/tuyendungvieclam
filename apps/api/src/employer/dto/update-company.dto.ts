import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  website?: string;

  // Đợt 12ab (24/09/2026) — logo công ty qua link ảnh (URL), theo quyết định đã chốt.
  @IsOptional()
  @IsString()
  logoUrl?: string;

  // Đợt 12ac (24/09/2026) — "Giới thiệu công ty" hiển thị ở tab Tổng quan công ty (trang chi tiết tin).
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  // Đợt 49 — thông tin "Tổng quan công ty".
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  companyType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  vision?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  mission?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12, { message: 'Tối đa 12 ảnh' })
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  galleryUrls?: string[];
}
