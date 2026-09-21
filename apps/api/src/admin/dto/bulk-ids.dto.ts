import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

// Đợt 12q (21/09/2026) — Batch 5 mục #2 "Duyệt/từ chối hàng loạt": body chung cho các route
// bulk-approve/bulk-reject của tin và công ty. Giới hạn 100 id/lần — đủ dùng cho 1 trang danh sách
// đang chờ duyệt, tránh 1 request xử lý quá nhiều bản ghi cùng lúc.
export class BulkIdsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids: string[];
}
