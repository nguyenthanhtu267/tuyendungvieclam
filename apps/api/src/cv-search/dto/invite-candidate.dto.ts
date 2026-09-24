import { IsNotEmpty, IsString } from 'class-validator';

// Đợt 12ac (24/09/2026) — "Mời ứng tuyển" (icon hành động NTD ở Tìm hồ sơ, theo mẫu careerviet.vn).
export class InviteCandidateDto {
  @IsString()
  @IsNotEmpty()
  jobPostingId: string;
}
