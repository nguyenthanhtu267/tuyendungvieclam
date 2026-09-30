'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { smartApi4, type CvTailor } from '@/lib/api';

// Đợt 75 — "Chỉnh hồ sơ theo tin này": độ phủ từ khoá giống bộ lọc ATS. Mặc định thu gọn.
export default function CvTailorPanel({ jobId }: { jobId: string }) {
  const { me, token } = useAuth();
  const [d, setD] = useState<CvTailor | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!token || me?.role !== 'candidate') return;
    smartApi4.cvTailor(token, jobId).then(setD).catch(() => setD(null));
  }, [token, me?.role, jobId]);
  if (!d?.hasProfile || d.score == null) return null;
  const cls = d.score >= 70 ? 'text-success' : d.score >= 40 ? 'text-warning' : 'text-critical';
  return (
    <div className="rounded-xl border border-border bg-white p-4 flex flex-col gap-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left" aria-expanded={open}>
        <span className="text-[13px] font-extrabold text-primary uppercase tracking-wide">
          Chỉnh hồ sơ theo tin này
          {!open && <span className={`ml-2 normal-case tabular-nums ${cls}`}>Phủ từ khoá {d.score}%</span>}
        </span>
        <span className="text-primary font-bold">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <>
          <div className={`text-2xl font-extrabold tabular-nums ${cls}`}>{d.score}% <span className="text-[13px] font-bold">từ khoá của tin có trong hồ sơ</span></div>
          <div className="flex flex-wrap gap-1.5">
            {d.matched?.map((k) => <span key={k} className="rounded-full bg-success-tint text-success px-2 py-0.5 text-[12.5px] font-bold">✓ {k}</span>)}
            {d.inText?.map((k) => <span key={k} className="rounded-full bg-warning-tint text-[#7A4A00] px-2 py-0.5 text-[12.5px] font-bold">~ {k}</span>)}
            {d.missing?.map((k) => <span key={k} className="rounded-full bg-surface-alt border border-border text-ink px-2 py-0.5 text-[12.5px]">+ {k}</span>)}
          </div>
          <ul className="text-[13px] text-ink list-disc pl-4 flex flex-col gap-0.5">
            {d.tips?.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <div className="text-[11.5px] text-ink-faint">✓ đã có trong Kỹ năng · ~ mới nhắc trong kinh nghiệm · + chưa thấy. Chỉ thêm những gì bạn thật sự có.</div>
          <Link href="/ho-so" className="text-[13px] font-bold text-primary">Mở hồ sơ để chỉnh →</Link>
        </>
      )}
    </div>
  );
}
