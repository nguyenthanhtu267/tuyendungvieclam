// Đợt 18e (26/09/2026) — "Đăng nhập thay": Admin mở tài khoản ứng viên/NTD bằng token riêng (2 giờ) để
// sửa 100% mọi thông tin qua đúng giao diện của họ. Token Admin được cất tạm ở trình duyệt này, bấm
// "Quay lại Admin" (hoặc Đăng xuất) là trở về đúng phiên Admin cũ.
const BACKUP_KEY = 'tvl_admin_token_backup';
const INFO_KEY = 'tvl_impersonation';

export interface ImpersonationInfo {
  email: string;
  role: string;
  expiresAt: number;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function startImpersonation(adminToken: string, info: { email: string; role: string; expiresInMinutes: number }) {
  safe(() => {
    localStorage.setItem(BACKUP_KEY, adminToken);
    localStorage.setItem(
      INFO_KEY,
      JSON.stringify({ email: info.email, role: info.role, expiresAt: Date.now() + info.expiresInMinutes * 60_000 }),
    );
  }, undefined);
}

export function getImpersonation(): ImpersonationInfo | null {
  return safe(() => {
    if (!localStorage.getItem(BACKUP_KEY)) return null;
    const raw = localStorage.getItem(INFO_KEY);
    return raw ? (JSON.parse(raw) as ImpersonationInfo) : null;
  }, null);
}

export function getAdminBackupToken(): string | null {
  return safe(() => localStorage.getItem(BACKUP_KEY), null);
}

// Kết thúc phiên đăng nhập thay → trả về token Admin đã cất (nếu có).
export function endImpersonation(): string | null {
  return safe(() => {
    const t = localStorage.getItem(BACKUP_KEY);
    localStorage.removeItem(BACKUP_KEY);
    localStorage.removeItem(INFO_KEY);
    return t;
  }, null);
}
