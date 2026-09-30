import { IsISO8601 } from 'class-validator';

export class ChooseInterviewDto {
  @IsISO8601({}, { message: 'Khung giờ không hợp lệ' })
  slot: string;
}
