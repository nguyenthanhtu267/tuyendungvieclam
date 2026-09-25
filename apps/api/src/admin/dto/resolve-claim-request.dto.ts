import { IsOptional, IsString } from 'class-validator';

// Đợt 17 (25/09/2026) — Admin duyệt/từ chối yêu cầu "Đây là công ty của bạn?". `adminNote` dùng cho
// cả 2 trường hợp (VD lý do từ chối, hoặc ghi chú nội bộ khi duyệt) — không bắt buộc. `taxCode` chỉ
// có ý nghĩa khi duyệt (approve) — cho phép Admin nhập luôn mã số thuế thật nếu đã có, bỏ qua khi từ
// chối (reject).
export class ResolveClaimRequestDto {
  @IsOptional()
  @IsString()
  adminNote?: string;

  @IsOptional()
  @IsString()
  taxCode?: string;
}
