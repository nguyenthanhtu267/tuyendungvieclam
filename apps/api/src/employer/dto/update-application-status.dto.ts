import { IsEnum } from 'class-validator';
import { ApplicationStatus } from '../../database/entities/application.entity';

export class UpdateApplicationStatusDto {
  @IsEnum(ApplicationStatus, { message: 'Trạng thái không hợp lệ' })
  status: ApplicationStatus;
}
