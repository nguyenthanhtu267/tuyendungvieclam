'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { cvSearchApi } from '@/lib/api';

type Item = Awaited<ReturnType<typeof cvSearchApi.suggest>>['items'][number];

// Đợt 41 — Hồ sơ gợi ý cho một tin tuyển dụng (chấm điểm ngược) + nút "Mời ứng tuyển".
export default function SuggestedCandidates({ jobId }: { jobId: string }) {
  const { token } = useAuth();
  const [items, setItems] = useState<Item[] | null>(null);
  const [invited, setInvited] = useState<Record<string, 'sending' | 'done' | 'error'>>({});

  useEffect(() => {
    if (!token) return;
    cvSearchApi.suggest(token, jobId).then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [token, jobId]);

  async function invite(id: string) {
    if (!token) return;
    setInvited((s) => ({ ...s, [id]: 'sending' }));
    try {
      await cvSearchApi.invite(token, id, jobId);
      setInvited((s) => ({ ...s, [id]: 'done' }));
    } catch {
      setInvited((s) => ({ ...s, [id]: 'error' }));
    }
  }

  if (items === null) return <div className="text-[15px] text-ink-muted">Đang tìm hồ sơ phù hợp…</div>;
  if (items.length === 0)
    return (
      <div className="text-[15px] text-ink-muted">
        Chưa có hồ sơ nào đủ phù hợp. Bạn có thể{' '}
        <Link href="/nha-tuyen-dung/tim-ho-so" className="underline font-semibold">tìm hồ sơ thủ công</Link>.
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      {items.map((c) => (
        <div key={c.id} className="rounded-xl border border-border bg-white p-3 flex gap-3 items-start">
          <div className="shrink-0 w-14 h-14 rounded-full bg-primary-tint text-primary font-extrabold text-lg flex items-center justify-center">
            {c.match.score}%
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[16px] text-ink">
              {c.fullName} <span className="font-normal text-ink-muted">· {c.profileTitle ?? c.desiredPosition ?? 'Ứng viên'}</span>
            </div>
            <div className="text-[14px] text-ink-muted">
              {[c.province, c.yearsOfExperience != null ? `${c.yearsOfExperience} năm KN` : null, c.desiredLevel].filter(Boolean).join(' · ')}
            </div>
            {c.match.reasons.length > 0 && <div className="text-[14px] text-success mt-0.5">✓ {c.match.reasons.join(' · ')}</div>}
            {c.match.gaps.length > 0 && <div className="text-[14px] text-ink-faint">△ {c.match.gaps.join(' · ')}</div>}
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              onClick={() => invite(c.id)}
              disabled={invited[c.id] === 'sending' || invited[c.id] === 'done'}
              className="tvl-btn-primary !w-auto px-3 py-1.5 text-[14px] disabled:opacity-60"
            >
              {invited[c.id] === 'done' ? 'Đã mời ✓' : invited[c.id] === 'sending' ? 'Đang gửi…' : 'Mời ứng tuyển'}
            </button>
            <Link href={`/nha-tuyen-dung/tim-ho-so/${c.id}`} className="text-[13px] text-center underline text-ink-muted">
              Xem hồ sơ
            </Link>
            {invited[c.id] === 'error' && <span className="text-[12px] text-danger">Không gửi được, thử lại</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
