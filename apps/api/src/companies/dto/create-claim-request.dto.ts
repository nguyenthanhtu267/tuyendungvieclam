import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Đợt 17 (25/09/2026) — form công khai "Đây là công ty của bạn?" ở trang /cong-ty/[id], hiện khi
// company.isAdminSourced && !company.claimedAt. Không yêu cầu đăng nhập (công ty thật chưa có tài
// khoản vào lúc này) — Admin xác minh thông tin NGOÀI hệ thống trước khi duyệt (xem
// AdminService.approveClaimRequest()), nên các trường ở đây chỉ cần đủ để Admin liên hệ lại.
export class CreateClaimRequestDto {
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  @MaxLength(200)
  requesterName: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  requesterEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  requesterPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
