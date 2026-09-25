import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Đợt 17 (25/09/2026) — "Chuyển giao thủ công" (Admin đã xác minh công ty thật ngoài hệ thống —
// điện thoại/Zalo — nay chuyển tài khoản NTD nháp cho họ): đổi email đăng nhập + đặt lại mật khẩu tạm
// (kiểu resetUserPassword sẵn có), đặt company.claimedAt = now để ẩn badge "chưa xác thực". Dùng
// chung cho cả claim trực tiếp (AdminController POST companies/:id/claim) LẪN duyệt yêu cầu công khai
// "Đây là công ty của bạn?" (approveClaimRequest() gọi lại đúng hàm claimCompany() này).
export class ClaimCompanyDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  // Mã số thuế thật — không bắt buộc ngay lúc claim (công ty có thể cập nhật sau ở trang Hồ sơ công
  // ty NTD như bình thường), nhưng cho phép nhập luôn nếu Admin đã có sẵn.
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  taxCode?: string;
}
