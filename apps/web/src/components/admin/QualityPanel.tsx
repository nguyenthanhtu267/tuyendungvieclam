'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { adminApi, smartApi, smartApi2, smartApi3, smartApi6, workersApi, type AdminTodo, type DupJobGroup, type ProvinceBalance, type SuspiciousAccount, type SuspiciousWorkerGroup, type QualityOverview, type SystemHealth, type ReportGroup, type WeeklyReport, type AdTargeting } from '@/lib/api';

type Sub = 'reports' | 'weekly' | 'ads' | 'system' | 'duplicates' | 'suspicious' | 'lowQuality' | 'spam' | 'accounts' | 'workers';

// Đợt 63 — Admin: phát hiện tin trùng, tin đáng ngờ (dùng bộ chấm rủi ro) và chấm chất lượng tin tổng hợp.
export function QualityPanel({ token }: { token: string }) {
  const [data, setData] = useState<QualityOverview | null>(null);
  const [sub, setSub] = useState<Sub>('system');
  const [sys, setSys] = useState<SystemHealth | null>(null);
  const [reports, setReports] = useState<ReportGroup[] | null>(null);
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [ads, setAds] = useState<AdTargeting | null>(null);
  const [accts, setAccts] = useState<SuspiciousAccount[]>([]);
  const [wg, setWg] = useState<SuspiciousWorkerGroup[]>([]);
  const [wstats, setWstats] = useState<{ items: { kind: string; n: number; fresh: number; hidden: number }[]; apps: number; contacts: number; provinces?: ProvinceBalance[] } | null>(null);
  const [todo, setTodo] = useState<AdminTodo | null>(null);
  const [dups, setDups] = useState<DupJobGroup[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    smartApi.qualityOverview(token).then(setData).catch(() => setError('Không tải được dữ liệu chất lượng.'));
    smartApi2.systemHealth(token).then(setSys).catch(() => undefined);
    smartApi3.reports(token).then((r) => setReports(r.items)).catch(() => setReports([]));
    smartApi3.weekly(token).then(setWeekly).catch(() => undefined);
    smartApi6.suspicious(token).then((r) => setAccts(r.items)).catch(() => setAccts([]));
    workersApi.adminSuspicious(token).then((r) => setWg(r.items)).catch(() => setWg([]));
    workersApi.adminStats(token).then(setWstats).catch(() => undefined);
    workersApi.adminTodo(token).then(setTodo).catch(() => undefined);
    workersApi.adminDuplicateJobs(token).then((r) => setDups(r.items)).catch(() => setDups([]));
    smartApi3.adTargeting(token).then(setAds).catch(() => undefined);
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
    { id: 'reports', label: 'Người dùng báo cáo', n: reports?.length ?? 0 },
    { id: 'weekly', label: 'Báo cáo tuần', n: 0 },
    { id: 'ads', label: 'Gợi ý nhắm quảng cáo', n: ads?.items.length ?? 0 },
    { id: 'system', label: 'Sức khoẻ hệ thống', n: sys?.alerts.filter((a) => a.level === 'warn').length ?? 0 },
    { id: 'accounts', label: 'Tài khoản nhà tuyển dụng đáng ngờ', n: accts.length },
    { id: 'workers', label: 'Hồ sơ lao động phổ thông nghi ảo', n: wg.length },
    { id: 'spam', label: 'Nghi spam ứng tuyển', n: (sys?.spam.burst.length ?? 0) + (sys?.spam.sameLetter.length ?? 0) },
    { id: 'lowQuality', label: 'Tin tổng hợp chất lượng thấp', n: data?.lowQuality.length ?? 0 },
    { id: 'duplicates', label: 'Tin trùng', n: data?.duplicates.length ?? 0 },
    { id: 'suspicious', label: 'Tin đáng ngờ', n: data?.suspicious.length ?? 0 },
  ];
  async function resolve(id: string) {
    setBusy(id);
    try {
      await smartApi3.resolveReports(token, id);
      load();
    } catch {
      setError('Không đánh dấu được, thử lại.');
    } finally {
      setBusy(null);
    }
  }

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
      {sub === 'reports' && (
        <div className="rounded-xl bg-white border border-border divide-y divide-border">
          {!reports && <div className="p-4 text-ink-faint text-sm">Đang tải…</div>}
          {reports?.length === 0 && <div className="p-4 text-ink-faint text-sm">Chưa có báo cáo nào đang mở.</div>}
          {reports?.map((r) => (
            <Row key={r.jobId} id={r.jobId} title={r.title} company={r.company} badge={`${r.count} báo cáo${r.priority === 'high' ? ' · khẩn cấp' : ''}`} note={`${r.categories.join(', ')}${r.notes[0] ? ` — “${r.notes[0]}”` : ''}`}>
              <div className="flex gap-2 shrink-0">
                <button type="button" disabled={busy === r.jobId} onClick={() => resolve(r.jobId)} className="rounded-lg border border-border text-[12.5px] font-bold px-2.5 py-1 disabled:opacity-50">Đã xử lý</button>
                <Btn busy={busy === r.jobId} onClick={() => hide(r.jobId, 'Người dùng báo cáo vi phạm').then(() => resolve(r.jobId))} />
              </div>
            </Row>
          ))}
        </div>
      )}
      {sub === 'weekly' && weekly && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {weekly.metrics.map((m) => (
              <div key={m.key} className="rounded-xl bg-white border border-border p-3">
                <div className="text-xl font-extrabold tabular-nums">{m.cur}</div>
                <div className="text-[12.5px] text-ink-muted">{m.label}</div>
                <div className={`text-[12px] font-bold tabular-nums ${m.changePct >= 0 ? 'text-[#0B5D2A]' : 'text-critical'}`}>
                  {m.changePct >= 0 ? '▲' : '▼'} {Math.abs(m.changePct)}% so với tuần trước ({m.prev})
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-white border border-border p-3">
            <div className="font-extrabold text-[13.5px] mb-1">Nhận xét tự động</div>
            <ul className="list-disc pl-5 text-[13px] leading-relaxed">{weekly.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </div>
        </div>
      )}
      {sub === 'ads' && (
        <div className="rounded-xl bg-white border border-border overflow-x-auto">
          {!ads || ads.items.length === 0 ? (
            <div className="p-4 text-ink-faint text-sm">Chưa đủ dữ liệu truy cập để gợi ý.</div>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead><tr className="text-left text-ink-muted"><th className="p-2">Khu vực</th><th className="p-2">Vị trí</th><th className="p-2">Lượt</th><th className="p-2">Đối tượng</th><th className="p-2">Gợi ý</th></tr></thead>
              <tbody>
                {ads.items.map((a, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2 font-bold">{a.area}</td><td className="p-2">{a.slot}</td><td className="p-2 tabular-nums">{a.total}</td>
                    <td className="p-2">{a.audience}</td><td className="p-2">{a.suggestion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
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
      {sub === 'accounts' && (
        <div className="rounded-xl border border-border bg-white divide-y divide-border">
          {accts.length === 0 ? <Empty /> : accts.map((a) => (
            <div key={a.companyId} className="p-3">
              <div className="font-bold text-[13.5px]">
                <Link href={`/cong-ty/${a.companyId}`} className="hover:underline">{a.name}</Link>
                <span className="ml-2 rounded bg-surface-alt border border-border px-1.5 py-0.5 text-[11.5px] font-extrabold">Điểm {a.score}</span>
              </div>
              <div className="text-[12.5px] text-ink-soft mt-0.5">{a.reasons.join('; ')}</div>
            </div>
          ))}
        </div>
      )}
      {sub === 'workers' && (
        <div className="flex flex-col gap-2">
          {todo && (
            <div className="rounded-xl border-2 border-primary bg-white p-3 text-[13.5px] text-ink flex flex-col gap-1.5">
              <div className="font-extrabold text-[15px]">Việc cần xử lý hôm nay (kênh lao động phổ thông)</div>
              <ul className="list-disc pl-5">
                <li><b>{todo.openReports}</b> tin đang bị người dùng báo cáo — xem tab “Người dùng báo cáo”.</li>
                <li><b>{todo.suspicious}</b> nhóm hồ sơ nghi ảo/môi giới — xem danh sách bên dưới.</li>
                <li><b>{todo.duplicates}</b> nhóm tin lặp / trùng nội dung — xem “Tin lặp” bên dưới.</li>
                <li><b>{todo.riskyPending.length}</b> tin đang chờ duyệt có điểm rủi ro cao (trên tổng {todo.pendingTotal} tin chờ duyệt).</li>
              </ul>
              {todo.riskyPending.map((j) => (
                <div key={j.id} className="rounded border border-critical bg-critical-tint px-2 py-1"><a href={`/admin/sua-tin/${j.id}`} className="font-bold text-critical underline">{j.title}</a> — điểm {j.score}: {j.reasons.join('; ')}</div>
              ))}
              {todo.imbalance.length > 0 && <div>Lệch cung–cầu lớn nhất: {todo.imbalance.map((p) => `${p.province} (${p.seekers} người / ${p.slots} chỗ)`).join(' · ')}.</div>}
              {todo.openReports + todo.suspicious + todo.duplicates + todo.riskyPending.length === 0 && <div className="font-bold text-success">Không có việc tồn đọng.</div>}
            </div>
          )}
          {dups.length > 0 && (
            <div className="rounded-xl border border-border bg-white p-3 text-[13.5px] text-ink flex flex-col gap-2">
              <div className="font-extrabold text-[14px]">Tin lặp / nghi môi giới ({dups.length})</div>
              {dups.map((g) => (
                <div key={g.key} className="rounded-lg border border-border p-2">
                  <div className="font-bold">{g.reason}</div>
                  <ul className="mt-0.5">{g.jobs.map((j) => (<li key={j.id}><a href={`/admin/sua-tin/${j.id}`} className="text-primary underline">{j.title}</a> — {j.company ?? '—'} · {j.province ?? '—'}</li>))}</ul>
                </div>
              ))}
            </div>
          )}
          {wstats && (
            <div className="rounded-xl border border-border bg-white p-3 text-[13.5px] text-ink flex flex-wrap gap-x-5 gap-y-1">
              {wstats.items.map((r) => (
                <span key={r.kind}><b>{r.kind === 'worker' ? 'Công nhân' : r.kind === 'student' ? 'Sinh viên' : 'Thực tập sinh'}:</b> {r.n} hồ sơ ({r.fresh} cập nhật 30 ngày, {r.hidden} đã ẩn)</span>
              ))}
              <span><b>Ứng tuyển nhanh:</b> {wstats.apps}</span>
              <span><b>Lượt NTD ghi sổ gọi:</b> {wstats.contacts}</span>
            </div>
          )}
          {wstats?.provinces && wstats.provinces.length > 0 && (
            <div className="rounded-xl border border-border bg-white p-3 overflow-x-auto">
              <div className="font-extrabold text-[14px] text-ink">Cung – cầu theo tỉnh (người đang tìm việc 45 ngày so với chỗ còn trống ở tin đang mở)</div>
              <table className="w-full text-[13.5px] text-ink mt-1">
                <thead><tr className="text-left text-ink-muted"><th className="p-1.5">Tỉnh/thành</th><th className="p-1.5">Người tìm việc</th><th className="p-1.5">Chỗ trống</th><th className="p-1.5">Số tin</th><th className="p-1.5">Nhận định</th></tr></thead>
                <tbody>
                  {wstats.provinces.map((p) => (
                    <tr key={p.province} className="border-t border-border">
                      <td className="p-1.5 font-bold">{p.province}</td>
                      <td className="p-1.5 tabular-nums">{p.seekers}</td>
                      <td className="p-1.5 tabular-nums">{p.slots}</td>
                      <td className="p-1.5 tabular-nums">{p.jobs}</td>
                      <td className={`p-1.5 font-bold ${p.label.startsWith('Chỗ trống') ? 'text-critical' : p.label.startsWith('Người') ? 'text-primary' : ''}`}>{p.label}{p.label.startsWith('Chỗ trống') ? ' → cần kêu gọi thêm ứng viên' : p.label.startsWith('Người') ? ' → cần mời thêm nhà tuyển dụng' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="rounded-xl border border-border bg-white divide-y divide-border">
            {wg.length === 0 ? <div className="p-6 text-center text-sm text-ink-faint">Không phát hiện nhóm hồ sơ đáng ngờ.</div> : wg.map((g) => (
              <div key={g.key} className="p-3 flex flex-col gap-1">
                <div className="font-bold text-[13.5px]">{g.reason} <span className="ml-1 rounded bg-surface-alt border border-border px-1.5 py-0.5 text-[11.5px] font-extrabold">Điểm {g.score}</span></div>
                <ul className="flex flex-col gap-0.5">
                  {g.profiles.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-2 text-[13px] text-ink">
                      <span className={p.isHidden ? 'line-through text-ink-faint' : ''}>{p.fullName} · {p.phone} · {p.province}</span>
                      <button
                        type="button"
                        onClick={() => workersApi.adminHide(token, p.id, !p.isHidden).then(() => setWg((l) => l.map((x) => ({ ...x, profiles: x.profiles.map((y) => (y.id === p.id ? { ...y, isHidden: !p.isHidden } : y)) }))))}
                        className={`rounded border px-1.5 py-0.5 text-[12px] font-bold ${p.isHidden ? 'border-border-strong text-ink' : 'border-critical text-critical'}`}
                      >
                        {p.isHidden ? 'Hiện lại' : 'Ẩn hồ sơ'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {sub !== 'workers' && sub !== 'accounts' && sub !== 'system' && sub !== 'spam' && sub !== 'reports' && sub !== 'weekly' && sub !== 'ads' && (!data ? (
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
