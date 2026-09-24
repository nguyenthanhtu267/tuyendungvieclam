import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

// Đợt 12x (21/09/2026) — theo yêu cầu người dùng: từ chối tin BẮT BUỘC chọn ít nhất 1 lý do từ danh
// mục cố định (JOB_REJECTION_REASONS ở catalogs.ts phía frontend), thay vì từ chối "trống không" như
// trước — để NTD biết chính xác cần sửa gì trước khi gửi duyệt lại. `note` là ghi chú thêm, tự do,
// không bắt buộc (dùng khi lý do trong danh mục chưa đủ rõ).
export class RejectJobDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Vui lòng chọn ít nhất 1 lý do từ chối' })
  @IsString({ each: true })
  reasons: string[];

  @IsOptional()
  @IsString()
  note?: string;
}
