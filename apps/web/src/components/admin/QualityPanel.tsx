'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { adminApi, smartApi, smartApi2, type QualityOverview, type SystemHealth } from '@/lib/api';

type Sub = 'system' | 'duplicates' | 'suspicious' | 'lowQuality' | 'spam';

// Đợt 63 — Admin: phát hiện tin trùng, tin đáng ngờ (dùng bộ chấm rủi ro) và chấm chất lượng tin tổng hợp.
export function QualityPanel({ token }: { token: string }) {
  const [data, setData] = useState<QualityOverview | null>(null);
  const [sub, setSub] = useState<Sub>('system');
  const [sys, setSys] = useState<SystemHealth | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    smartApi.qualityOverview(token).then(setData).catch(() => setError('Không tải được dữ liệu chất lượng.'));
    smartApi2.systemHealth(token).then(setSys).catch(() => undefined);
  }, [token]);
  useEffect(load, [load]);

  async function hide(id: string, reason: string) {
    setBusy(id);
    try {
      await adminApi.rejectJob(token, id, { reasons: [reason], note: 'Ẩn từ mục Chất lượng dữ liệu' });
      load();
    } catch {
      setError('Không ẩn được tin, thử lại.');
    } finally {
      setBusy(null);
    }
  }

  const tabs: { id: Sub; label: string; n: number }[] = [
    { id: 'system', label: 'Sức khoẻ hệ thống', n: sys?.alerts.filter((a) => a.level === 'warn').length ?? 0 },
    { id: 'spam', label: 'Nghi spam ứng tuyển', n: (sys?.spam.burst.length ?? 0) + (sys?.spam.sameLetter.length ?? 0) },
    { id: 'lowQuality', label: 'Tin tổng hợp chất lượng thấp', n: data?.lowQuality.length ?? 0 },
    { id: 'duplicates', label: 'Tin trùng', n: data?.duplicates.length ?? 0 },
    { id: 'suspicious', label: 'Tin đáng ngờ', n: data?.suspicious.length ?? 0 },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="font-extrabold text-lg">Chất lượng dữ liệu</h1>
        <div className="text-[13px] text-ink-muted">
          Quét {data?.scanned ?? '…'} tin đang hiển thị. Bấm “Ẩn tin” để chuyển tin sang trạng thái từ chối (có thể duyệt lại sau).
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSub(t.id)}
            className={`rounded-full px-3 py-1 text-[13px] font-bold border ${sub === t.id ? 'bg-primary text-white border-primary' : 'bg-white border-border text-ink'}`}
          >
            {t.label} ({t.n})
          </button>
        ))}
        <button type="button" onClick={load} className="rounded-full px-3 py-1 text-[13px] font-bold border border-border bg-white text-primary">
          Quét lại
        </button>
      </div>
      {error && <div className="text-critical text-sm">{error}</div>}
      {sub === 'system' && sys && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              ['Tin chờ duyệt', sys.metrics.pendingJobs],
              ['Công ty chờ xác thực', sys.metrics.pendingCompanies],
              ['Tài khoản mới 24h', sys.metrics.users24h],
              ['Tin mới 24h', sys.metrics.jobs24h],
              ['Đơn ứng tuyển 24h', sys.metrics.apps24h],
              ['Tin bị từ chối 7 ngày', sys.metrics.rejected7d],
            ].map(([l, v]) => (
              <div key={String(l)} className="rounded-xl bg-white border border-border p-3">
                <div className="text-xl font-extrabold tabular-nums">{v}</div>
                <div className="text-[12.5px] text-ink-muted">{l}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-white border border-border divide-y divide-border">
            {sys.alerts.map((a, i) => (
              <div key={i} className={`p-3 text-[13.5px] font-semibold ${a.level === 'warn' ? 'text-critical' : 'text-ink'}`}>
                {a.level === 'warn' ? '⚠ ' : '✓ '}
                {a.text}
              </div>
            ))}
          </div>
        </div>
      )}
      {sub === 'spam' && sys && (
        <div className="rounded-xl bg-white border border-border divide-y divide-border">
          {sys.spam.burst.length + sys.spam.sameLetter.length === 0 && <Empty />}
          {sys.spam.burst.map((b, i) => (
            <div key={`b${i}`} className="p-3 text-[13.5px]">
              <b>{b.who}</b> nộp <b className="text-critical">{b.count} đơn</b> trong 24 giờ.
            </div>
          ))}
          {sys.spam.sameLetter.map((b, i) => (
            <div key={`s${i}`} className="p-3 text-[13.5px]">
              <b>{b.who}</b> dùng cùng 1 thư ứng tuyển cho <b className="text-critical">{b.count} đơn</b> (7 ngày): “{b.sample}…”
            </div>
          ))}
        </div>
      )}
      {sub !== 'system' && sub !== 'spam' && (!data ? (
        <div className="text-ink-faint text-sm py-6">Đang quét…</div>
      ) : (
        <div className="rounded-xl bg-white border border-border divide-y divide-border">
          {sub === 'lowQuality' &&
            (data.lowQuality.length === 0 ? <Empty /> : data.lowQuality.map((r) => (
              <Row key={r.id} id={r.id} title={r.title} company={r.company} badge={`${r.score}/100`} note={`Thiếu: ${r.missing.join(', ')}`}>
                <Btn busy={busy === r.id} onClick={() => hide(r.id, 'Chất lượng dữ liệu thấp')} />
              </Row>
            )))}
          {sub === 'duplicates' &&
            (data.duplicates.length === 0 ? <Empty /> : data.duplicates.map((g, i) => (
              <div key={i} className="p-3">
                <div className="font-bold text-[13.5px]">{g.title}</div>
                <div className="text-[12.5px] text-ink-muted mb-1">{g.company} · {g.jobs.length} tin giống nhau</div>
                {g.jobs.map((j, k) => (
                  <div key={j.id} className="flex items-center justify-between gap-2 text-[13px] py-0.5">
                    <span>
                      {k === 0 ? 'Mới nhất' : 'Bản cũ'} · {j.source} · {new Date(j.createdAt).toLocaleDateString('vi-VN')}{' '}
                      <Link className="text-primary font-semibold" href={`/admin/xem-tin/${j.id}`}>Xem</Link>
                    </span>
                    {k > 0 && <Btn busy={busy === j.id} onClick={() => hide(j.id, 'Tin trùng')} />}
                  </div>
                ))}
              </div>
            )))}
          {sub === 'suspicious' &&
            (data.suspicious.length === 0 ? <Empty /> : data.suspicious.map((r) => (
              <Row key={r.id} id={r.id} title={r.title} company={r.company} badge={`Rủi ro ${r.score}`} note={r.reasons.join('; ')}>
                <Btn busy={busy === r.id} onClick={() => hide(r.id, 'Nghi ngờ lừa đảo / nội dung không phù hợp')} />
              </Row>
            )))}
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return <div className="p-6 text-center text-sm text-ink-faint">Không có tin nào cần xử lý.</div>;
}
function Btn({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button type="button" disabled={busy} onClick={onClick} className="shrink-0 rounded-lg border border-critical text-critical text-[12.5px] font-bold px-2.5 py-1 disabled:opacity-50">
      Ẩn tin
    </button>
  );
}
function Row({ id, title, company, badge, note, children }: { id: string; title: string; company: string; badge: string; note: string; children: React.ReactNode }) {
  return (
    <div className="p-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="font-bold text-[13.5px]">
          <Link href={`/admin/xem-tin/${id}`} className="hover:underline">{title}</Link>
          <span className="ml-2 rounded bg-surface-alt border border-border px-1.5 py-0.5 text-[11.5px] font-extrabold">{badge}</span>
        </div>
        <div className="text-[12.5px] text-ink-muted">{company}</div>
        <div className="text-[12.5px] text-critical">{note}</div>
      </div>
      {children}
    </div>
  );
}
