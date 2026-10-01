'use client';

import { useRef, useState, type ReactNode } from 'react';
import { candidatesApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { bumpSavedCount } from '@/lib/saved-count';
import { haptic } from '@/lib/haptic';

// Đợt 99 — vuốt trên thẻ tin (cảm ứng): vuốt PHẢI = lưu tin ♥, vuốt TRÁI = ẩn tin (có nút "Hoàn tác"). Chỉ nhận khi vuốt ngang rõ
// ràng (không cản cuộn dọc); thẻ trượt theo ngón tay và gợi ý hành động bằng nền + biểu tượng. Chuột/bàn phím vẫn dùng nút như cũ.
export function SwipeRow({ jobId, onHide, children }: { jobId: string; onHide: (id: string) => void; children: ReactNode }) {
  const { token } = useAuth();
  const [dx, setDx] = useState(0);
  const [msg, setMsg] = useState('');
  const st = useRef<{ x: number; y: number; on: boolean; lock: boolean } | null>(null);
  const LIMIT = 96;

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(''), 1800);
  }

  async function save() {
    if (!token) return flash('Đăng nhập để lưu tin');
    try {
      await candidatesApi.saveJob(token, jobId);
      bumpSavedCount(1);
      haptic();
      flash('♥ Đã lưu tin');
    } catch {
      flash('Không lưu được, thử lại sau');
    }
  }

  return (
    <div className="relative" style={{ touchAction: 'pan-y' }}>
      <div className="absolute inset-0 rounded-xl flex items-center justify-between px-5 text-white font-extrabold text-[15px]" aria-hidden>
        <span className={`transition-opacity ${dx > 12 ? 'opacity-100' : 'opacity-0'}`} style={{ position: 'absolute', left: 16 }}>♥ Lưu</span>
        <span className={`transition-opacity ${dx < -12 ? 'opacity-100' : 'opacity-0'}`} style={{ position: 'absolute', right: 16 }}>Ẩn ✕</span>
        <div className={`absolute inset-0 rounded-xl -z-0 ${dx > 0 ? 'bg-primary' : dx < 0 ? 'bg-ink-muted' : 'bg-transparent'}`} />
      </div>
      <div
        className="relative"
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: st.current?.on ? 'none' : 'transform .18s ease-out' }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          st.current = { x: t.clientX, y: t.clientY, on: true, lock: false };
        }}
        onTouchMove={(e) => {
          const s = st.current;
          if (!s) return;
          const t = e.touches[0];
          const mx = t.clientX - s.x;
          const my = t.clientY - s.y;
          if (!s.lock) {
            if (Math.abs(my) > 14 && Math.abs(my) > Math.abs(mx)) return void (st.current = null);
            if (Math.abs(mx) > 14 && Math.abs(mx) > Math.abs(my) * 1.6) s.lock = true;
            else return;
          }
          setDx(Math.max(-LIMIT * 1.4, Math.min(LIMIT * 1.4, mx)));
        }}
        onTouchEnd={() => {
          const was = dx;
          if (st.current) st.current.on = false;
          st.current = null;
          setDx(0);
          if (was >= LIMIT) void save();
          else if (was <= -LIMIT) {
            haptic();
            onHide(jobId);
          }
        }}
        onTouchCancel={() => {
          st.current = null;
          setDx(0);
        }}
      >
        {children}
      </div>
      {msg && <div className="absolute left-1/2 -translate-x-1/2 bottom-2 z-10 rounded-full bg-ink text-white text-[12.5px] font-bold px-3 py-1 shadow">{msg}</div>}
    </div>
  );
}
