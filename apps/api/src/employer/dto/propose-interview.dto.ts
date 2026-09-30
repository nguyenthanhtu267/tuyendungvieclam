import { ArrayMaxSize, ArrayMinSize, IsArray, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

// Đợt 46 — NTD đề xuất 1–3 khung giờ phỏng vấn.
export class ProposeInterviewDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 khung giờ' })
  @ArrayMaxSize(3, { message: 'Tối đa 3 khung giờ' })
  @IsISO8601({}, { each: true, message: 'Khung giờ không hợp lệ' })
  slots: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  place?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
