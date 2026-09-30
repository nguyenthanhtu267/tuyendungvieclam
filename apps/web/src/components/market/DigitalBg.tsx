'use client';

import { useBgTheme } from '@/components/bg/BackgroundProvider';
import { ArtScene } from '@/components/bg/ArtScene';
import { BG_THEME_MAP } from '@/lib/bg-themes';

// Đợt 27 → Đợt 29: nền vector chuyển đổi số của khung "Bảng thị trường" nay dùng CHUNG mẫu nền đang chọn cho toàn
// website (xem components/bg). `themeId` chỉ dùng khi muốn ép 1 mẫu cụ thể.
export function DigitalBg({ themeId, className = '' }: { themeId?: string; className?: string }) {
  const cur = useBgTheme();
  const theme = (themeId && BG_THEME_MAP[themeId]) || cur;
  return <ArtScene theme={theme} mode="panel" className={className} />;
}
export type DigitalTone = never;
