'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { smartApi2, type JobForecast } from '@/lib/api';

// Đợt 64 — trước khi gửi tin: dự báo số hồ sơ / thời gian đủ hồ sơ và mức lương so với mặt bằng (từ tin cùng ngành đã đăng).
export default function JobForecastPanel({ industry, level, salaryMin, salaryMax, province }: { province?: string; industry?: string; level?: string; salaryMin?: number; salaryMax?: number }) {
  const { token, me } = useAuth();
  const [f, setF] = useState<JobForecast | null>(null);
  useEffect(() => {
    if (!token || !me?.role.startsWith('employer') || !industry) {
      setF(null);
      return;
    }
    smartApi2.forecast(token, { industry, level, province, salaryMin, salaryMax }).then(setF).catch(() => setF(null));
  }, [token, me?.role, industry, level, province, salaryMin, salaryMax]);
  if (!f || !f.enough) return null;
  return (
    <div className="rounded-lg border border-border bg-white p-3 text-[13px]">
      <div className="font-extrabold text-[13.5px] mb-1">Dự báo cho tin này</div>
      <div className="text-ink-muted">
        Từ {f.sample} tin tương tự ({f.scope}): trong 21 ngày đầu thường nhận khoảng <b className="text-ink">{f.medianApplications21d} hồ sơ</b>
        {f.daysTo10 ? <>, đủ 10 hồ sơ sau ~<b className="text-ink">{f.daysTo10} ngày</b> ({f.shareReaching10}% tin đạt được mức này)</> : f.shareReaching10 === 0 ? ', chưa tin nào đạt 10 hồ sơ' : ''}.
      </div>
      {f.salary && <div className="text-ink-muted mt-0.5">Lương phổ biến: {f.salary.p25}–{f.salary.p75} triệu (trung vị {f.salary.median}).</div>}
      {f.bestTime && (f.bestTime.hours.length > 0 || f.bestTime.days.length > 0) && (
        <div className="text-ink-muted mt-0.5">
          Thời điểm đăng hiệu quả ({f.bestTime.scope}): {f.bestTime.days.length > 0 && <b className="text-ink">{f.bestTime.days.join(', ')}</b>}
          {f.bestTime.hours.length > 0 && <>, khung giờ <b className="text-ink">{f.bestTime.hours.map((h) => `${h}h`).join(', ')}</b></>}.
        </div>
      )}
      {f.competitors && f.competitors.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <div className="font-bold text-[12.5px] mb-1">Tin cạnh tranh đang đăng</div>
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="text-left text-ink-muted"><th className="py-1 pr-2">Chức danh</th><th className="pr-2">Công ty</th><th className="pr-2">Lương (triệu)</th><th className="pr-2">Quyền lợi</th></tr>
            </thead>
            <tbody>
              {f.competitors.map((c, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1 pr-2 font-semibold">{c.title}</td>
                  <td className="pr-2 co-name">{c.company}</td>
                  <td className="pr-2 tabular-nums">{c.salaryMin || c.salaryMax ? `${c.salaryMin ?? '?'}–${c.salaryMax ?? '?'}` : 'Thoả thuận'}</td>
                  <td className="pr-2 tabular-nums">{c.benefitCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {f.advice?.map((a) => (
        <div key={a} className="mt-1 font-semibold text-ink">→ {a}</div>
      ))}
    </div>
  );
}
