'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { profileApi } from '@/lib/api';
import { interviewPrep, type PrepItem, type PrepJob } from '@/lib/interview-prep';

// Đợt 64 — Chuẩn bị phỏng vấn: câu hỏi có thể gặp + gợi ý trả lời dựa trên hồ sơ của chính ứng viên.
export default function InterviewPrepPanel({ job }: { job: PrepJob }) {
  const { me, token } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PrepItem[] | null>(null);
  useEffect(() => {
    if (!open || items || !token || me?.role !== 'candidate') return;
    profileApi
      .getFull(token)
      .then((r) => {
        const ex = r.sections.experiences[0];
        setItems(
          interviewPrep(job, {
            fullName: r.profile.fullName,
            yearsOfExperience: r.profile.yearsOfExperience,
            desiredPosition: r.profile.desiredPosition,
            profileTitle: r.profile.profileTitle,
            skillNames: r.sections.skills.map((s) => s.skillName),
            lastCompany: ex?.companyName ?? null,
            lastPosition: ex?.position ?? null,
          }),
        );
      })
      .catch(() => setItems(interviewPrep(job, null)));
  }, [open, items, token, me?.role, job]);
  if (me?.role !== 'candidate') return null;
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between text-left" aria-expanded={open}>
        <span className="text-[13px] font-extrabold text-primary uppercase tracking-wide">Chuẩn bị phỏng vấn</span>
        <span className="text-primary font-bold">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ol className="mt-3 flex flex-col gap-3 list-decimal pl-5">
          {!items && <li className="text-sm text-ink-faint list-none -ml-5">Đang soạn câu hỏi…</li>}
          {items?.map((it) => (
            <li key={it.q} className="text-[13px]">
              <div className="font-bold text-ink">{it.q}</div>
              <div className="text-ink-muted">{it.hint}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
