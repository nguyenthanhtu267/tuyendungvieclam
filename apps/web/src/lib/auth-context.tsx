'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from './api';

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

  const load = useCallback(async (t: string | null) => {
    if (!t) {
      setMe(null);
      return;
    }
    try {
      const res = await authApi.me(t);
      setMe(res);
    } catch {
      localStorage.removeItem('tvl_token');
      setTokenState(null);
      setMe(null);
    }
  }, []);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('tvl_token') : null;
    setTokenState(stored);
    load(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setToken = useCallback(
    (t: string) => {
      localStorage.setItem('tvl_token', t);
      setTokenState(t);
      load(t);
    },
    [load],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('tvl_token');
    setTokenState(null);
    setMe(null);
  }, []);

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
