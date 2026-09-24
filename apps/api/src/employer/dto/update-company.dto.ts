import { IsOptional, IsString } from 'class-validator';

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
}
