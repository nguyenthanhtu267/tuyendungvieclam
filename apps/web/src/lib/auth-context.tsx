'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, authApi } from './api';
import { endImpersonation, getAdminBackupToken } from './impersonation';
import { clearAllDrafts } from './use-draft';
import { clearSavedCount } from './saved-count';
import { whenPageReady } from './page-ready';

export interface MeInfo {
  id: string;
  email: string;
  role: string;
  status: string;
}

interface AuthContextValue {
  me: MeInfo | null | undefined; // undefined = đang tải lần đầu
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeInfo | null | undefined>(undefined);
  const [token, setTokenState] = useState<string | null>(null);

  const load = useCallback(async function loadMe(t: string | null, attempt = 0): Promise<void> {
    if (!t) {
      setMe(null);
      return;
    }
    try {
      const res = await authApi.me(t);
      setMe(res);
    } catch (err) {
      // Đợt 19 (26/09/2026) — sửa lỗi: trước đây MỌI lỗi khi gọi /auth/me (mất mạng chốc lát, máy chủ đang
      // khởi động/triển khai trả 502, người dùng chuyển trang giữa chừng làm yêu cầu bị huỷ...) đều bị coi là
      // "token hỏng" → xoá token → người dùng bị đăng xuất oan. Nay chỉ đăng xuất khi máy chủ TRẢ LỜI RÕ token
      // không hợp lệ (401/403); lỗi tạm thời thì tự thử lại, vẫn giữ nguyên phiên đăng nhập.
      if (!(err instanceof ApiError && (err.status === 401 || err.status === 403))) {
        if (attempt < 2) setTimeout(() => loadMe(t, attempt + 1), attempt === 0 ? 2000 : 6000);
        else setMe(null);
        return;
      }
      // Đợt 18e — token "Đăng nhập thay" hết hạn (2 giờ) → tự quay về phiên Admin đã cất.
      const backup = getAdminBackupToken();
      if (backup && backup !== t) {
        endImpersonation();
        localStorage.setItem('tvl_token', backup);
        setTokenState(backup);
        setMe(undefined);
        try {
          setMe(await authApi.me(backup));
          return;
        } catch {
          /* token Admin cũng hết hạn → đăng xuất hẳn */
        }
      }
      localStorage.removeItem('tvl_token');
      setTokenState(null);
      setMe(null);
    }
  }, []);

  useEffect(() => {
    // Đợt 91 — chờ trang hydrate xong rồi mới đặt trạng thái đăng nhập (xem lib/page-ready.ts) để không làm nháy cả trang.
    return whenPageReady(() => {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('tvl_token') : null;
      setTokenState(stored);
      load(stored);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Đợt 91 — ĐỒNG BỘ GIỮA CÁC TAB: đăng nhập / đăng xuất / đổi tài khoản ở 1 tab → các tab khác cập nhật ngay
  // (trước đây tab cũ vẫn hiện "đã đăng nhập" rồi báo lỗi 401 khi bấm). Sự kiện `storage` chỉ bắn ở tab KHÁC nên không lặp vòng.
  const tokenRef = useRef<string | null>(null);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'tvl_token' && e.key !== null) return;
      const next = localStorage.getItem('tvl_token');
      if (next === tokenRef.current) return;
      tokenRef.current = next;
      setTokenState(next);
      if (next) {
        setMe(undefined);
        load(next);
      } else setMe(null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [load]);

  const setToken = useCallback(
    (t: string) => {
      localStorage.setItem('tvl_token', t);
      setTokenState(t);
      // Đợt 18e — chuyển sang token KHÁC (VD "Đăng nhập thay"): đặt `me` về undefined (đang tải)
      // ngay lập tức, tránh 1-2 lần render còn giữ danh tính CŨ (VD vẫn là Admin) trong lúc /auth/me
      // với token mới chưa trả về — nếu không, các trang tự chuyển hướng theo `me.role` (VD
      // /nha-tuyen-dung/dashboard) sẽ đọc nhầm vai trò cũ và đá người dùng về sai trang.
      setMe(undefined);
      load(t);
    },
    [load],
  );

  const logout = useCallback(() => {
    // Đợt 18e — đang "Đăng nhập thay" thì Đăng xuất = quay lại phiên Admin (không đăng xuất Admin).
    const backup = endImpersonation();
    if (backup) {
      localStorage.setItem('tvl_token', backup);
      setTokenState(backup);
      setMe(undefined);
      load(backup);
      return;
    }
    localStorage.removeItem('tvl_token');
    // Đợt 91 — máy dùng chung: xoá nháp + số đếm cục bộ của người vừa đăng xuất.
    clearAllDrafts();
    clearSavedCount();
    try {
      localStorage.removeItem('tvl_saved_cache');
    } catch {
      /* bỏ qua */
    }
    setTokenState(null);
    setMe(null);
  }, [load]);

  const refresh = useCallback(() => load(token), [load, token]);

  const value = useMemo(
    () => ({ me, token, setToken, logout, refresh }),
    [me, token, setToken, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải được dùng bên trong <AuthProvider>');
  return ctx;
}
