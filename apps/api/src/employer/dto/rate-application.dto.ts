import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

// Đợt 11b — Mục #4 ATS: đánh giá ứng viên 1-5 sao.
export class RateApplicationDto {
  @Type(() => Number)
  @IsInt({ message: 'Số sao phải là số nguyên' })
  @Min(1, { message: 'Số sao tối thiểu là 1' })
  @Max(5, { message: 'Số sao tối đa là 5' })
  rating: number;
}
