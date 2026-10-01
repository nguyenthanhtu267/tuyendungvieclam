'use client';

import { useEffect, useState } from 'react';
import { adminAnalyticsApi } from '@/lib/api-admin';

// Đợt 93 — tốc độ THẬT từ máy người xem (không phải giả lập). Màu: xanh = đạt mục tiêu Google, vàng = cần cải thiện, đỏ = chậm.
type Rows = Awaited<ReturnType<typeof adminAnalyticsApi.vitals>>;
const tone = (v: number | null, good: number, bad: number) =>
  v === null ? 'text-ink-faint' : v <= good ? 'text-green-700 font-bold' : v <= bad ? 'text-amber-700 font-bold' : 'text-red-700 font-bold';

export function VitalsCard({ token }: { token: string }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Rows | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let off = false;
    setData(null);
    setErr(false);
    adminAnalyticsApi
      .vitals(token, days)
      .then((r) => !off && setData(r))
      .catch(() => !off && setErr(true));
    return () => {
      off = true;
    };
  }, [token, days]);
  return (
    <section className="rounded-xl bg-white border border-border p-4" data-testid="vitals-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-extrabold text-[15px]">Tốc độ thật của người xem</h3>
        <select id="vit-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="tvl-input !w-auto !py-1 !text-[12px]" aria-label="Khoảng ngày">
          <option value={1}>24 giờ</option>
          <option value={7}>7 ngày</option>
          <option value={30}>30 ngày</option>
        </select>
      </div>
      <p className="text-[12px] text-ink-muted mt-1">{data?.note ?? 'Giá trị p75: 75% lượt xem tốt hơn mức này. Mục tiêu: LCP ≤ 2500ms, CLS ≤ 0.1, INP ≤ 200ms.'}</p>
      {err && <p className="text-[13px] text-red-700 mt-2">Chưa lấy được số liệu (API bản cũ chưa có tính năng này, hoặc chưa có ai truy cập).</p>}
      {data && data.items.length === 0 && <p className="text-[13px] text-ink-muted mt-2">Chưa đủ dữ liệu (cần ≥ 3 lượt xem mỗi trang). Số đo bắt đầu ghi sau khi web bản mới được triển khai.</p>}
      {data && data.items.length > 0 && (
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-ink-muted border-b border-border">
                <th className="py-1 pr-2">Trang</th>
                <th className="pr-2">Máy</th>
                <th className="pr-2 text-right">Lượt</th>
                <th className="pr-2 text-right">LCP</th>
                <th className="pr-2 text-right">CLS</th>
                <th className="pr-2 text-right">INP</th>
                <th className="text-right">TTFB</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.path + r.device} className="border-b border-border/60">
                  <td className="py-1 pr-2 font-mono text-[12px]">{r.path}</td>
                  <td className="pr-2">{r.device === 'mobile' ? 'Điện thoại' : 'Máy tính'}</td>
                  <td className="pr-2 text-right tabular-nums">{r.samples}</td>
                  <td className={`pr-2 text-right tabular-nums ${tone(r.lcpMs, 2500, 4000)}`}>{r.lcpMs === null ? '—' : Math.round(r.lcpMs) + ' ms'}</td>
                  <td className={`pr-2 text-right tabular-nums ${tone(r.cls, 0.1, 0.25)}`}>{r.cls === null ? '—' : r.cls}</td>
                  <td className={`pr-2 text-right tabular-nums ${tone(r.inpMs, 200, 500)}`}>{r.inpMs === null ? '—' : Math.round(r.inpMs) + ' ms'}</td>
                  <td className={`text-right tabular-nums ${tone(r.ttfbMs, 800, 1800)}`}>{r.ttfbMs === null ? '—' : Math.round(r.ttfbMs) + ' ms'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
