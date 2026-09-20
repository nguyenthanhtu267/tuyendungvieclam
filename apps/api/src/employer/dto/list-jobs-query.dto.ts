import { IsIn, IsOptional } from 'class-validator';

export const EMPLOYER_JOB_STATUSES = ['dang_dang', 'cho_dang', 'tam_ngung', 'het_han', 'khac'] as const;
export type EmployerJobStatus = (typeof EMPLOYER_JOB_STATUSES)[number];

// Đợt 11b — Mục #4 ATS: 4 trạng thái tin cho NTD tự quản lý (đang đăng/chờ đăng/tạm ngưng/hết hạn),
// tính từ approvalStatus + isPaused + deadline — xem computeEmployerStatus() trong employer.service.ts.
export class ListJobsQueryDto {
  @IsOptional()
  @IsIn(EMPLOYER_JOB_STATUSES, { message: 'Trạng thái không hợp lệ' })
  status?: EmployerJobStatus;
}
