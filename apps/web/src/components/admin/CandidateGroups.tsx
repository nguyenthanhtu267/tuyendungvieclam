'use client';

import { useEffect, useState } from 'react';
import { CandidatesPanel } from './CandidatesPanel';
import { WorkerCandidatesPanel } from './WorkerCandidatesPanel';

// Đợt 135 — tab "Ứng viên" chia 2 thẻ con: Nhân viên văn phòng (hồ sơ CV) | Công nhân · SV · TTS (hồ sơ lao động phổ thông).
// Mỗi thẻ có đủ: tìm, lọc, thẻ + ghi chú nội bộ, gợi ý tin, mời ứng tuyển. Nhớ thẻ đang mở trên máy này.
export function CandidateGroups({ token }: { token: string }) {
  const [g, setG] = useState<'office' | 'labor'>('office');
  useEffect(() => {
    try {
      if (localStorage.getItem('tvl_admin_cand_group') === 'labor') setG('labor');
    } catch {
      /* bỏ qua */
    }
  }, []);
  const pick = (v: 'office' | 'labor') => {
    setG(v);
    try {
      localStorage.setItem('tvl_admin_cand_group', v);
    } catch {
      /* bỏ qua */
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-bold text-base">Ứng viên</h1>
      <div role="tablist" className="flex gap-1 border-b border-border text-sm font-bold">
        {([['office', '💼 Nhân viên văn phòng'], ['labor', '🧰 Công nhân · SV · TTS']] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={g === k} onClick={() => pick(k)} className={`px-4 py-2.5 border-b-2 -mb-px ${g === k ? 'text-primary border-primary' : 'text-ink-faint border-transparent'}`}>
            {l}
          </button>
        ))}
      </div>
      {g === 'office' ? <CandidatesPanel token={token} embedded /> : <WorkerCandidatesPanel token={token} />}
    </div>
  );
}
