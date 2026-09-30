'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { publicSettingsApi } from '@/lib/api';
import { BG_THEMES, DEFAULT_BG_SETTING, currentBgTheme, nextBgChange, type BgSetting, type BgTheme } from '@/lib/bg-themes';
import { ArtScene } from './ArtScene';

// Đợt 29 (30/09/2026) — nền vector TOÀN website. Admin chọn 1 mẫu cố định hoặc "tự động đổi mỗi N giờ (mặc định 2 giờ)":
// mẫu đang hiển thị được tính từ giờ hiện tại nên MỌI người xem cùng thấy 1 mẫu, tới mốc giờ thì tự chuyển (mờ dần) —
// không cần tải lại trang. Khung số liệu trang chủ dùng cùng mẫu (bản tối đậm), nền toàn trang dùng bản sáng nhạt.
const Ctx = createContext<BgTheme>(BG_THEMES[0]);
export const useBgTheme = () => useContext(Ctx);

let cached: BgSetting | null = null;

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [setting, setSetting] = useState<BgSetting>(cached ?? DEFAULT_BG_SETTING);
  const [now, setNow] = useState(0);
  const [prev, setPrev] = useState<BgTheme | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    let alive = true;
    const load = () =>
      publicSettingsApi
        .background()
        .then((s) => {
          cached = s;
          if (alive) setSetting(s);
        })
        .catch(() => undefined);
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // hẹn giờ tới mốc đổi mẫu kế tiếp (chỉ khi ở chế độ tự động)
  useEffect(() => {
    if (!mounted || setting.mode !== 'auto') return;
    const wait = Math.max(1000, nextBgChange(setting, Date.now()) - Date.now() + 500);
    const t = setTimeout(() => setNow(Date.now()), Math.min(wait, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [mounted, setting, now]);

  const theme = mounted ? currentBgTheme(setting, now || Date.now()) : BG_THEMES[0];
  const [shown, setShown] = useState<BgTheme>(theme);
  useEffect(() => {
    if (theme.id === shown.id && theme.image?.url === shown.image?.url) return;
    setPrev(shown);
    setShown(theme);
    const t = setTimeout(() => setPrev(null), 1600);
    return () => clearTimeout(t);
  }, [theme, shown]);

  return (
    <Ctx.Provider value={shown}>
      {/* Chế độ "none" (Admin tắt nền): không vẽ lớp nền, trang dùng nền trơn; khung số liệu vẫn dùng mẫu mặc định. */}
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true" hidden={setting.mode === 'none'}>
        {prev && (
          <div className="absolute inset-0">
            <ArtScene theme={prev} mode="page" />
          </div>
        )}
        <div key={shown.image ? `${shown.id}-${shown.image.url}` : shown.id} className="absolute inset-0 bg-fade-in">
          <ArtScene theme={shown} mode="page" />
        </div>
      </div>
      {children}
    </Ctx.Provider>
  );
}
