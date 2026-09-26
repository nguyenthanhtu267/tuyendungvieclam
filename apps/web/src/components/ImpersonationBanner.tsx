'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { endImpersonation, getAdminBackupToken, getImpersonation, type ImpersonationInfo } from '@/lib/impersonation';

// Đợt 18e (26/09/2026) — thanh cảnh báo luôn hiện khi Admin đang "Đăng nhập thay" 1 người dùng.
export default function ImpersonationBanner() {
  const { me, token } = useAuth();
  const [info, setInfo] = useState<ImpersonationInfo | null>(null);

  useEffect(() => {
    const i = getImpersonation();
    if (!i) {
      setInfo(null);
      return;
    }
    // So khớp với TOKEN hiện tại (đồng bộ ngay khi setToken chạy) chứ không so `me.role` — `me` cập
    // nhật KHÔNG đồng bộ (còn phải gọi /auth/me), nên ngay sau khi bấm "Đăng nhập thay" `me` vẫn còn
    // là Admin trong 1-2 lần render đầu; so theo role ở đây từng xoá nhầm dấu vết đăng nhập thay vừa
    // tạo. Chỉ dọn dấu vết khi token hiện tại đã quay về đúng token Admin đã cất (hoặc mất dấu backup).
    const backup = getAdminBackupToken();
    if (!backup || token === backup) {
      endImpersonation();
      setInfo(null);
      return;
    }
    setInfo(i);
  }, [me, token]);

  if (!info || !me) return null;

  function backToAdmin() {
    const t = endImpersonation();
    setInfo(null);
    if (t) {
      // Đợt 19 — tải lại trang mới hoàn toàn với token Admin (cùng lý do như lúc bắt đầu "Đăng nhập thay").
      localStorage.setItem('tvl_token', t);
      window.location.assign('/admin/dashboard');
    }
  }

  return (
    <div className="relative z-[60] bg-warning text-white text-[12.5px] font-semibold px-4 py-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      <span>
        👤 Bạn (Admin) đang đăng nhập thay <b>{info.email}</b> — mọi thay đổi được ghi nhật ký. Hết hạn lúc{' '}
        {new Date(info.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}.
      </span>
      <button onClick={backToAdmin} className="rounded-md bg-white text-warning font-bold px-3 py-1 text-xs">
        Quay lại Admin
      </button>
    </div>
  );
}
