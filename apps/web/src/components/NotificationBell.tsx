'use client';

import { useCallback, useEffect, useState } from 'react';
import { notificationsApi, type AppNotification } from '@/lib/api';
import { formatDate } from '@/lib/format';

// Đợt 12m (21/09/2026) — chuông thông báo hoạt động thật, dùng chung cho SiteHeader (ứng viên) và
// EmployerHeader (NTD): trước đây chuông chỉ hiện tĩnh "Chưa có thông báo nào" dù bảng notifications
// đã tồn tại trong CSDL (không module nào ghi vào bảng này) — nay gọi NotificationsModule thật.
// Poll số chưa đọc mỗi 60s (không cần realtime/websocket cho quy mô hiện tại).
const TYPE_ICON: Record<string, string> = {
  profile_viewed: '👀',
  interview_invite: '📅',
  application_status: '📄',
  job_approved: '✅',
  job_rejected: '⛔',
  company_approved: '✅',
  company_rejected: '⛔',
  job_alert_match: '🔔',
};

// variant "dark" — dùng trên nền primary (EmployerHeader); "light" (mặc định) — dùng trên nền
// trắng (SiteHeader).
export function NotificationBell({ token, variant = 'light' }: { token: string; variant?: 'light' | 'dark' }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(() => {
    notificationsApi
      .unreadCount(token)
      .then(setUnread)
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    loadUnread();
    const timer = setInterval(loadUnread, 60000);
    return () => clearInterval(timer);
  }, [loadUnread]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!(e.target as HTMLElement)?.closest('[data-notif-bell]')) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) {
      try {
        setItems(await notificationsApi.list(token));
      } catch {
        setItems([]);
      }
    }
  }

  async function handleMarkAll() {
    try {
      await notificationsApi.markAllRead(token);
      setUnread(0);
      setItems((prev) => prev?.map((n) => ({ ...n, isRead: true })) ?? prev);
    } catch {
      // im lặng — không chặn UI vì đây là thao tác phụ
    }
  }

  async function handleItemClick(n: AppNotification) {
    if (n.isRead) return;
    setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)) ?? prev);
    setUnread((c) => Math.max(0, c - 1));
    try {
      await notificationsApi.markRead(token, n.id);
    } catch {
      // đã cập nhật lạc quan ở UI — bỏ qua lỗi vặt
    }
  }

  return (
    <div className="relative" data-notif-bell>
      <button
        type="button"
        onClick={handleToggle}
        className={
          variant === 'dark'
            ? 'relative w-9 h-9 rounded-full border border-white/25 bg-white/10 flex items-center justify-center text-sm hover:bg-white/20 transition-colors'
            : 'relative w-9 h-9 rounded-full border border-border-strong flex items-center justify-center text-sm hover:bg-surface-alt transition-colors'
        }
        aria-label="Thông báo"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-critical text-white text-[9.5px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-white shadow-lg overflow-hidden text-sm z-40">
          <div className="px-4 py-3 font-bold border-b border-border flex items-center justify-between">
            <span>Thông báo</span>
            {!!items?.some((n) => !n.isRead) && (
              <button type="button" onClick={handleMarkAll} className="text-[11px] font-semibold text-primary hover:underline">
                Đánh dấu đã đọc hết
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items === null ? (
              <div className="px-4 py-6 text-center text-ink-faint text-xs">Đang tải...</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-6 text-center text-ink-faint text-xs">Chưa có thông báo nào</div>
            ) : (
              items.map((n) => (
                <button
                  type="button"
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`w-full text-left px-4 py-2.5 border-b border-border/60 last:border-0 hover:bg-surface-alt transition-colors ${
                    !n.isRead ? 'bg-primary-tint/40' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm shrink-0">{TYPE_ICON[n.type] ?? '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12.5px] ${!n.isRead ? 'font-semibold text-ink' : 'text-ink-muted'}`}>{n.content}</div>
                      <div className="text-[10.5px] text-ink-faint mt-0.5">{formatDate(n.createdAt)}</div>
                    </div>
                    {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
