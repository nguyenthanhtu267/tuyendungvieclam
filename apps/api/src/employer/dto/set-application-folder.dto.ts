import { IsOptional, IsString, MaxLength } from 'class-validator';

// Đợt 11b — Mục #4 ATS: gán/gỡ thư mục hồ sơ (chữ tự do NTD đặt tên, ví dụ "Ứng viên tiềm năng").
// Gửi folder rỗng/không gửi = gỡ khỏi thư mục hiện tại.
export class SetApplicationFolderDto {
  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'Tên thư mục tối đa 60 ký tự' })
  folder?: string;
}
