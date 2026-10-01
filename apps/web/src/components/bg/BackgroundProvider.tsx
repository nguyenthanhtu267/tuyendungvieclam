'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { publicSettingsApi } from '@/lib/api';
import { BG_THEMES, DEFAULT_BG_SETTING, currentBgTheme, nextBgChange, type BgSetting, type BgTheme } from '@/lib/bg-themes';
import { ArtScene } from './ArtScene';
import { useDataSaver } from '@/lib/data-saver';
import { whenPageReady } from '@/lib/page-ready';
import { readCachedBg, writeCachedBg } from '@/lib/boot';

// Đợt 29 (30/09/2026) — nền vector TOÀN website. Admin chọn 1 mẫu cố định hoặc "tự động đổi mỗi N giờ (mặc định 2 giờ)":
// mẫu đang hiển thị được tính từ giờ hiện tại nên MỌI người xem cùng thấy 1 mẫu, tới mốc giờ thì tự chuyển (mờ dần) —
// không cần tải lại trang. Khung số liệu trang chủ dùng cùng mẫu (bản tối đậm), nền toàn trang dùng bản sáng nhạt.
const Ctx = createContext<BgTheme>(BG_THEMES[0]);
export const useBgTheme = () => useContext(Ctx);

let cached: BgSetting | null = null;

// Đợt 93 — SỬA lỗi "F5 thấy 2 hình nền": trước đây trang vẽ nền MẶC ĐỊNH rồi vài trăm ms sau mới có cài đặt thật và chuyển
// mờ dần sang nền đúng (1,6 giây có 2 lớp nền chồng nhau + tải/vẽ 2 lần). Nay: không vẽ nền cho tới khi biết đúng nền cần hiện —
// ưu tiên cài đặt đã nhớ ở máy (localStorage, vẽ ngay), sau đó đối chiếu với máy chủ; chỉ khi Admin vừa đổi nền mới chuyển mờ.
export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [setting, setSetting] = useState<BgSetting>(cached ?? DEFAULT_BG_SETTING);
  const [now, setNow] = useState(0);
  const [prev, setPrev] = useState<BgTheme | null>(null);
  const [shown, setShown] = useState<BgTheme | null>(null);
  const saver = useDataSaver();

  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setInterval> | undefined;
    // Đợt 91 — chờ trang hydrate xong rồi mới đổi nền (xem lib/page-ready.ts); điểm chờ chỉ ảnh hưởng lần mở đầu.
    const cancel = whenPageReady(() => {
      setNow(Date.now());
      const local = cached ?? readCachedBg();
      if (local) {
        cached = local;
        setSetting(local);
        setReady(true);
      }
      const load = () =>
        publicSettingsApi
          .background()
          .then((s) => {
            cached = s;
            writeCachedBg(s);
            if (alive) {
              setSetting(s);
              setReady(true);
            }
          })
          .catch(() => {
            if (alive) setReady(true); // lỗi mạng + chưa có bản nhớ → dùng nền mặc định
          });
      load();
      // Đợt 91 — chỉ làm mới cài đặt nền khi tab đang mở.
      t = setInterval(() => document.visibilityState === 'visible' && load(), 10 * 60 * 1000);
    });
    return () => {
      alive = false;
      cancel();
      if (t) clearInterval(t);
    };
  }, []);

  // hẹn giờ tới mốc đổi mẫu kế tiếp (chỉ khi ở chế độ tự động)
  useEffect(() => {
    if (!ready || setting.mode !== 'auto') return;
    const wait = Math.max(1000, nextBgChange(setting, Date.now()) - Date.now() + 500);
    const t = setTimeout(() => setNow(Date.now()), Math.min(wait, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [ready, setting, now]);

  const theme = ready ? currentBgTheme(setting, now || Date.now()) : null;
  useEffect(() => {
    if (!theme) return;
    if (!shown) {
      setShown(theme); // lần đầu: vẽ thẳng nền đúng, KHÔNG chuyển mờ từ nền khác
      return;
    }
    if (theme.id === shown.id && theme.image?.url === shown.image?.url) return;
    setPrev(shown);
    setShown(theme);
    const t = setTimeout(() => setPrev(null), 1600);
    return () => clearTimeout(t);
  }, [theme, shown]);

  return (
    <Ctx.Provider value={shown ?? BG_THEMES[0]}>
      {/* Chế độ "none" (Admin tắt nền): không vẽ lớp nền, trang dùng nền trơn; khung số liệu vẫn dùng mẫu mặc định. */}
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true" hidden={setting.mode === 'none' || saver}>
        {prev && (
          <div className="absolute inset-0">
            <ArtScene theme={prev} mode="page" />
          </div>
        )}
        {shown && (
          <div key={shown.image ? `${shown.id}-${shown.image.url}` : shown.id} className={prev ? 'absolute inset-0 bg-fade-in' : 'absolute inset-0'}>
            <ArtScene theme={shown} mode="page" />
          </div>
        )}
      </div>
      {children}
    </Ctx.Provider>
  );
}
