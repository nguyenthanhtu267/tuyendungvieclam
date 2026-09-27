import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class ApplyJobDto {
  // Đợt 21 (27/09/2026) — "2 cách chia sẻ hồ sơ": chọn 1 CV có sẵn (file/link) HOẶC dùng thẳng
  // "Hồ sơ trực tuyến" (useOnlineProfile=true, không cần file) — đúng 1 trong 2, không bắt buộc cvId
  // nữa (ApplicationsService.apply() tự kiểm tra đủ 1 trong 2 cách).
  @IsOptional()
  @IsUUID()
  cvId?: string;

  @IsOptional()
  @IsBoolean()
  useOnlineProfile?: boolean;

  @IsOptional()
  @IsString()
  coverLetter?: string;
}
