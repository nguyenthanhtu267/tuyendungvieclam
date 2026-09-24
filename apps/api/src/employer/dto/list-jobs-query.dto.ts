import { IsIn, IsOptional } from 'class-validator';

// Đợt 12x (21/09/2026) — tách riêng 'bi_tu_choi' khỏi 'khac' (trước đây REJECTED bị gộp chung với
// draft vào "khac", NTD không biết tin của mình đã bị từ chối) — đi kèm tính năng "Bắt buộc nhập lý
// do khi Từ chối", để NTD thấy rõ trạng thái + lý do cần sửa.
export const EMPLOYER_JOB_STATUSES = ['dang_dang', 'cho_dang', 'tam_ngung', 'het_han', 'bi_tu_choi', 'khac'] as const;
export type EmployerJobStatus = (typeof EMPLOYER_JOB_STATUSES)[number];

// Đợt 11b — Mục #4 ATS: 4 trạng thái tin cho NTD tự quản lý (đang đăng/chờ đăng/tạm ngưng/hết hạn),
// tính từ approvalStatus + isPaused + deadline — xem computeEmployerStatus() trong employer.service.ts.
export class ListJobsQueryDto {
  @IsOptional()
  @IsIn(EMPLOYER_JOB_STATUSES, { message: 'Trạng thái không hợp lệ' })
  status?: EmployerJobStatus;
}
