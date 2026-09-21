import { IsInt, IsObject, IsOptional, Min } from 'class-validator';

// Đợt 12m (21/09/2026) — "Lưu tìm kiếm" ở trang /viec-lam: lưu nguyên bộ lọc hiện tại (q, provinces,
// industries...) để dùng làm tiêu chí Job alert (xem notifyJobAlertMatches() ở admin.service.ts).
export class SaveSearchDto {
  @IsObject()
  criteria: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  resultCount?: number;
}
