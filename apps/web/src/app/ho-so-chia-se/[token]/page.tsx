'use client';

import { useEffect, useState } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { smartApi3, type SharedProfile } from '@/lib/api';

// Đợt 65 — trang công khai xem hồ sơ tóm tắt (noindex qua thẻ meta robots).
export default function SharedProfilePage({ params }: { params: { token: string } }) {
  const [p, setP] = useState<SharedProfile | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex,nofollow';
    document.head.appendChild(m);
    smartApi3.shared(params.token).then(setP).catch((e) => setErr(e instanceof Error ? e.message : 'Liên kết không hợp lệ'));
    return () => { m.remove(); };
  }, [params.token]);

  if (err) return <div className="max-w-[720px] mx-auto p-6 text-[15px] font-bold">{err}</div>;
  if (!p) return <div className="max-w-[720px] mx-auto p-6 text-ink-muted">Đang tải...</div>;
  return (
    <div>
    <BrandBar className="bg-white border-b border-border" />
    <div className="max-w-[720px] mx-auto p-4 flex flex-col gap-3">
      <div className="rounded-xl border border-border bg-white p-5">
        <h1 className="text-[22px] font-extrabold">{p.fullName}</h1>
        <div className="text-[14px] text-ink">{p.title || 'Ứng viên'}</div>
        <div className="text-[13px] text-ink-muted mt-1">
          {[p.province, p.yearsOfExperience != null ? `${p.yearsOfExperience} năm kinh nghiệm` : null, p.desiredLevel].filter(Boolean).join(' · ')}
        </div>
        {p.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {p.skills.map((s) => <span key={s} className="text-[12px] px-2.5 py-1 rounded-full bg-surface-alt text-ink">{s}</span>)}
          </div>
        )}
      </div>
      {p.experiences.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-5">
          <h2 className="font-extrabold text-[15px] mb-2">Kinh nghiệm</h2>
          {p.experiences.map((e, i) => (
            <div key={i} className="mb-2 text-[13.5px]">
              <b>{e.position}</b>{e.company ? ` · ${e.company}` : ''}
              <div className="text-[12px] text-ink-muted">{[e.from, e.to].filter(Boolean).join(' – ')}</div>
            </div>
          ))}
        </div>
      )}
      {p.educations.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-5">
          <h2 className="font-extrabold text-[15px] mb-2">Học vấn</h2>
          {p.educations.map((e, i) => (
            <div key={i} className="mb-1 text-[13.5px]">{[e.school, e.major, e.degree].filter(Boolean).join(' · ')}</div>
          ))}
        </div>
      )}
      <div className="text-[12px] text-ink-faint">Hồ sơ tóm tắt, không kèm thông tin liên hệ. Liên kết tự hết hạn.</div>
    </div>
    </div>
  );
}
