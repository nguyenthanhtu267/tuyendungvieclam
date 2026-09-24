import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

// Đợt 12ac (24/09/2026) — "Ghi chú riêng" + "Ẩn khỏi danh sách" (icon hành động NTD ở Tìm hồ sơ).
export class SetCandidateNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}
