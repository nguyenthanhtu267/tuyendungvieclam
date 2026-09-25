import { IsNotEmpty, IsUrl } from 'class-validator';

// Đợt 17 (25/09/2026) — "Dán URL → trích xuất tự động" (1 trong 2 cách nhập nội dung đã chốt qua
// AskUserQuestion, cách còn lại là nhập tay). Chỉ trích xuất TỐT NHẤT CÓ THỂ (best-effort) từ dữ liệu
// schema.org JobPosting (JSON-LD) nếu trang nguồn có nhúng — Admin luôn xem lại/sửa trước khi lưu
// (xem AdminService.extractJobFromUrl()), không tự động đăng thẳng.
export class ExtractJobUrlDto {
  @IsNotEmpty({ message: 'Vui lòng nhập URL' })
  @IsUrl({ require_protocol: true }, { message: 'URL không hợp lệ' })
  url: string;
}
