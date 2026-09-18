import { IsUrl } from 'class-validator';

// Dùng khi ứng viên dán link Google Drive thay vì tải tệp trực tiếp
// (áp dụng khi CV nặng hơn ngưỡng 2MB — theo quyết định Mục 9 SRS).
export class CreateCvLinkDto {
  @IsUrl({}, { message: 'Vui lòng nhập link hợp lệ (ví dụ: link chia sẻ Google Drive)' })
  externalLinkUrl: string;
}
