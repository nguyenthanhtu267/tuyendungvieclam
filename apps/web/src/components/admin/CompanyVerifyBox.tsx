'use client';

import { useEffect, useState } from 'react';
import { smartApi5, type VerifyCheck } from '@/lib/api';

const LV = { high: ['Khả năng thật cao', 'text-success'], medium: ['Cần xem thêm', 'text-warning'], low: ['Nhiều điểm đáng ngờ', 'text-critical'] } as const;

// Đợt 75 — trợ lý kiểm tra nhanh công ty chờ duyệt. Chỉ là gợi ý từ quy tắc, Admin vẫn quyết định.
export default function CompanyVerifyBox({ token, companyId }: { token: string; companyId: string }) {
  const [d, setD] = useState<VerifyCheck | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    smartApi5.verifyCheck(token, companyId).then(setD).catch(() => setErr('Không kiểm tra được'));
  }, [token, companyId]);
  if (err) return <div className="text-critical text-[13px]">{err}</div>;
  if (!d) return <div className="text-[13px] text-ink-muted">Đang kiểm tra (có thể mất vài giây)…</div>;
  const [label, cls] = LV[d.level];
  return (
    <div className="text-[13px]">
      <div className="flex items-baseline gap-2"><span className={`text-xl font-extrabold tabular-nums ${cls}`}>{d.score}/100</span><span className={`font-bold ${cls}`}>{label}</span></div>
      <ul className="mt-1 flex flex-col gap-0.5">
        {d.checks.map((c) => (
          <li key={c.key} className={c.ok === false ? 'text-critical' : c.ok ? 'text-ink' : 'text-ink-muted'}>{c.ok === false ? '✗' : c.ok ? '✓' : '–'} {c.label}</li>
        ))}
      </ul>
      {d.duplicates.length > 0 && <div className="mt-1 text-critical">Trùng: {d.duplicates.map((x) => `${x.name} (${x.why})`).join('; ')}</div>}
      <div className="mt-1 text-ink-faint">Chỉ kiểm tra định dạng/tính nhất quán, không tra cứu cơ quan thuế. Hãy xác minh ngoài hệ thống trước khi duyệt.</div>
    </div>
  );
}
