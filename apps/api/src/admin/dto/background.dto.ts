import { ArrayMaxSize, IsArray, IsIn, IsInt, Max, Min } from 'class-validator';
import { BG_THEME_IDS } from '../bg-themes';

// Đợt 29 — cấu hình nền giao diện: cố định 1 mẫu hoặc tự động đổi mỗi `hours` giờ (mặc định 2) trong danh sách mẫu chọn.
export class UpdateBackgroundDto {
  @IsIn(['fixed', 'auto'])
  mode: 'fixed' | 'auto';

  @IsIn([...BG_THEME_IDS])
  theme: string;

  // [] = xoay vòng cả 15 mẫu.
  @IsArray()
  @ArrayMaxSize(15)
  @IsIn([...BG_THEME_IDS], { each: true })
  autoThemes: string[];

  @IsInt()
  @Min(1)
  @Max(24)
  hours: number;
}
