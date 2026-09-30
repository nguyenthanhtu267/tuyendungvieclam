import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApplicationStatus } from '../../database/entities/application.entity';

export class UpdateApplicationStatusDto {
  @IsEnum(ApplicationStatus, { message: 'Trạng thái không hợp lệ' })
  status: ApplicationStatus;

  // Đợt 64 — lời nhắn kèm theo (mẫu phản hồi): gửi cho ứng viên qua thông báo.
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
