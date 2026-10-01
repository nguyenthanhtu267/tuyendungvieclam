'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, type AdCampaignRow, type AdStats } from '@/lib/api';
import { adminAdsApi } from '@/lib/api-admin';
import { AD_SLOT_DEFS } from '@/lib/ad-slots';
import { formatNumber } from '@/lib/format';
import { AdBanner } from '@/components/ads/AdBanner';
import { AdEditor, reachableSlots } from './AdEditor';

// Đợt 24 (29/09/2026) — Admin "📢 Banner quảng cáo": công tắc chung, danh sách chiến dịch (xem trước, trạng thái,
// hiệu quả 30 ngày), bật/tắt từng KHU VỰC, và biểu đồ lượt hiển thị theo ngày.

const STATUS: Record<AdCampaignRow['status'], { label: string; cls: string }> = {
  running: { label: 'Đang chạy', cls: 'bg-success-tint text-success' },
  scheduled: { label: 'Hẹn lịch', cls: 'bg-info-tint text-info' },
  ended: { label: 'Đã kết thúc', cls: 'bg-surface-alt text-ink-faint' },
  paused: { label: 'Đang tắt', cls: 'bg-warning-tint text-warning' },
};

function pct(clicks: number, views: number) {
  if (!views) return '—';
  return `${((clicks / views) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;
}

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : null;
}

export function AdsPanel({ token }: { token: string }) {
  const [rows, setRows] = useState<AdCampaignRow[] | null>(null);
  const [settings, setSettings] = useState<{ enabled: boolean; disabledSlots: string[] } | null>(null);
  const [stats, setStats] = useState<AdStats | null>(null);
  const [editing, setEditing] = useState<AdCampaignRow | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, s, st] = await Promise.all([adminAdsApi.list(token), adminAdsApi.settings(token), adminAdsApi.stats(token, 30)]);
      setRows(r);
      setSettings(s);
      setStats(st);
      setErr(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Không tải được dữ liệu banner');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Thao tác không thành công');
      await load();
    } finally {
      setBusy(null);
    }
  }

  // Đổi ngay trên giao diện (không chờ máy chủ); lỗi thì act() tải lại trạng thái thật.
  const saveSettings = (next: { enabled: boolean; disabledSlots: string[] }) => {
    setSettings(next);
    return act('settings', () => adminAdsApi.setSettings(token, next));
  };

  const slotStats = useMemo(() => {
    const m = new Map<string, { v: number; c: number }>();
    for (const r of stats?.bySlot ?? []) {
      const cur = m.get(r.slot) ?? { v: 0, c: 0 };
      cur.v += r.impressions;
      cur.c += r.clicks;
      m.set(r.slot, cur);
    }
    return m;
  }, [stats]);

  const totals = useMemo(() => {
    const v = (stats?.daily ?? []).reduce((t, d) => t + d.impressions, 0);
    const c = (stats?.daily ?? []).reduce((t, d) => t + d.clicks, 0);
    return { v, c };
  }, [stats]);

  if (!rows || !settings) {
    return <div className="text-center text-ink-faint text-sm py-16">{err ?? 'Đang tải…'}</div>;
  }

  const running = rows.filter((r) => r.status === 'running');
  // Khu vực đang có ít nhất 1 chiến dịch chạy.
  const coverage = (slot: string) => running.filter((r) => reachableSlots(r).some((s) => s.id === slot)).length;
  const maxDay = Math.max(1, ...(stats?.daily ?? []).map((d) => d.impressions));

  return (
    <div className="flex flex-col gap-6" data-testid="ads-panel">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-bold text-base">Banner quảng cáo</h1>
          <p className="text-xs text-ink-faint mt-1 max-w-2xl">
            Mỗi <b>chiến dịch</b> là 1 banner (chữ + nền + link) chạy ở 1 hoặc nhiều <b>khu vực</b> trên web. Nhiều chiến dịch
            chung khu vực sẽ xoay vòng theo mức ưu tiên; cùng 1 trang không hiện trùng banner. Người xem luôn thấy nhãn
            &quot;Quảng cáo&quot; và có thể bấm × để ẩn.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            id="ads-master"
            disabled={busy === 'settings'}
            onClick={() => saveSettings({ ...settings, enabled: !settings.enabled })}
            className={`flex items-center gap-2 text-xs font-bold rounded-lg px-3 py-2 border disabled:opacity-50 ${
              settings.enabled ? 'bg-success-tint text-success border-success/30' : 'bg-surface-alt text-ink-faint border-border'
            }`}
          >
            <span className={`inline-block shrink-0 w-8 h-4 rounded-full relative ${settings.enabled ? 'bg-success' : 'bg-ink-faint/40'}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </span>
            Quảng cáo trên web: {settings.enabled ? 'ĐANG BẬT' : 'đang tắt'}
          </button>
          <button type="button" id="ads-new" onClick={() => setEditing('new')} className="tvl-btn-primary !w-auto px-4 py-2 text-xs">
            + Tạo chiến dịch
          </button>
        </div>
      </div>

      {err && <div className="text-critical text-xs font-semibold">{err}</div>}

      {/* ---------------------------------------------------------- tổng quan 30 ngày */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Đang chạy', `${running.length}/${rows.length}`],
          ['Lượt hiển thị (30 ngày)', formatNumber(totals.v)],
          ['Lượt bấm (30 ngày)', formatNumber(totals.c)],
          ['Tỷ lệ bấm', pct(totals.c, totals.v)],
        ].map(([l, val]) => (
          <div key={l} className="rounded-xl bg-white border border-border p-3.5">
            <div className="text-[11px] text-ink-faint">{l}</div>
            <div className="font-extrabold text-lg tabular-nums mt-0.5">{val}</div>
          </div>
        ))}
      </div>
      {stats && stats.daily.length > 0 && (
        <div className="rounded-xl bg-white border border-border p-4">
          <div className="text-[11px] font-bold text-primary uppercase tracking-wide mb-3">Lượt hiển thị theo ngày</div>
          <div className="flex items-end gap-[3px] h-24" role="img" aria-label="Biểu đồ lượt hiển thị banner theo ngày">
            {stats.daily.map((d) => (
              <div
                key={d.day}
                title={`${d.day.split('-').reverse().join('/')}: ${formatNumber(d.impressions)} lượt hiển thị · ${formatNumber(d.clicks)} lượt bấm`}
                className="flex-1 min-w-[4px] max-w-[22px] rounded-t-[4px] bg-primary/80 hover:bg-accent"
                style={{ height: `${Math.max(3, (d.impressions / maxDay) * 100)}%` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- danh sách chiến dịch */}
      <section className="flex flex-col gap-3">
        <h2 className="font-bold text-sm">Chiến dịch ({rows.length})</h2>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong bg-white p-8 text-center text-sm text-ink-muted">
            Chưa có chiến dịch nào. Bấm <b>+ Tạo chiến dịch</b> — có sẵn mẫu &quot;Phần mềm nhân sự&quot;, &quot;Đăng tin miễn
            phí&quot;, &quot;Mùa Tết&quot;… để bắt đầu nhanh.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {rows.map((r) => {
              const reach = reachableSlots(r);
              const views = r.impressions ?? 0;
              const clicks = r.clicks ?? 0;
              return (
                <div key={r.id} className="rounded-xl bg-white border border-border p-4 flex flex-col gap-3" data-testid="ad-row">
                  <AdBanner ad={{ ...r, slug: 'xem-truoc' }} variant="wide" slot="home-top" preview />
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-bold text-[13px]">{r.name}</div>
                      <div className="text-[11.5px] text-ink-faint mt-0.5">
                        {r.slots.includes('*') ? 'Tất cả khu vực' : `${r.slots.length} khu vực`}
                        {` · hiện được ở ${reach.length}`}
                        {' · '}
                        {r.audiences.length ? r.audiences.map((a) => ({ guest: 'khách', candidate: 'ứng viên', employer: 'NTD' })[a] ?? a).join(', ') : 'mọi người'}
                        {r.device !== 'all' ? ` · ${r.device === 'desktop' ? 'máy tính' : 'điện thoại'}` : ''}
                        {` · ưu tiên ${r.weight}`}
                      </div>
                      {(r.startsAt || r.endsAt) && (
                        <div className="text-[11.5px] text-ink-faint">
                          {r.startsAt ? `Từ ${fmtDate(r.startsAt)}` : 'Từ bây giờ'} {r.endsAt ? `→ ${fmtDate(r.endsAt)}` : '→ không hạn'}
                        </div>
                      )}
                    </div>
                    <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-[11.5px] text-ink-muted tabular-nums">
                      👁 {formatNumber(views)} · 👆 {formatNumber(clicks)} · CTR {pct(clicks, views)}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <button type="button" onClick={() => setEditing(r)} className="text-[11.5px] font-bold rounded-md bg-primary-tint text-primary px-2.5 py-1.5">
                        Sửa
                      </button>
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => act(r.id, () => adminAdsApi.setEnabled(token, r.id, !r.enabled))}
                        className="text-[11.5px] font-bold rounded-md bg-surface-alt px-2.5 py-1.5 disabled:opacity-50"
                      >
                        {r.enabled ? 'Tắt' : 'Bật'}
                      </button>
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => act(r.id, () => adminAdsApi.duplicate(token, r.id))}
                        className="text-[11.5px] font-bold rounded-md bg-surface-alt px-2.5 py-1.5 disabled:opacity-50"
                      >
                        Nhân bản
                      </button>
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => {
                          if (window.confirm(`Xoá hẳn chiến dịch "${r.name}" và số liệu của nó?`))
                            act(r.id, () => adminAdsApi.remove(token, r.id));
                        }}
                        className="text-[11.5px] font-bold rounded-md bg-critical-tint text-critical px-2.5 py-1.5 disabled:opacity-50"
                      >
                        Xoá
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------- khu vực */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-bold text-sm">Khu vực đặt banner ({AD_SLOT_DEFS.length})</h2>
          <p className="text-[11.5px] text-ink-faint mt-0.5">
            Tắt 1 khu vực = không banner nào hiện ở đó (dù chiến dịch có chọn). Vùng cột phải chỉ có trên máy tính; điện thoại tối đa 1 banner/trang.
          </p>
        </div>
        <div className="rounded-xl bg-white border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink-faint bg-surface-alt">
                  <th className="py-2.5 px-4 font-semibold">Trang · vị trí</th>
                  <th className="py-2.5 px-3 font-semibold">Khổ</th>
                  <th className="py-2.5 px-3 font-semibold">Thiết bị</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Đang chạy</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Hiển thị · Bấm (30 ngày)</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Bật</th>
                </tr>
              </thead>
              <tbody>
                {AD_SLOT_DEFS.map((s) => {
                  const on = !settings.disabledSlots.includes(s.id);
                  const st = slotStats.get(s.id);
                  const cov = coverage(s.id);
                  return (
                    <tr key={s.id} className="border-t border-border">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold">{s.page}</div>
                        <div className="text-ink-faint">{s.label}</div>
                      </td>
                      <td className="py-2.5 px-3 text-ink-muted whitespace-nowrap">{s.size}</td>
                      <td className="py-2.5 px-3 text-ink-muted whitespace-nowrap">
                        {s.devices === 'all' ? 'Mọi thiết bị' : s.devices === 'desktop' ? 'Máy tính' : 'Điện thoại'}
                      </td>
                      <td className={`py-2.5 px-3 text-right tabular-nums ${cov ? '' : 'text-ink-faint'}`}>{cov || 'trống'}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                        {formatNumber(st?.v ?? 0)} · {formatNumber(st?.c ?? 0)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <input
                          type="checkbox"
                          id={`slot-on-${s.id}`}
                          aria-label={`Bật khu vực ${s.page} – ${s.label}`}
                          checked={on}
                          disabled={busy === 'settings'}
                          onChange={() =>
                            saveSettings({
                              ...settings,
                              disabledSlots: on ? [...settings.disabledSlots, s.id] : settings.disabledSlots.filter((x) => x !== s.id),
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {editing && (
        <AdEditor
          token={token}
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
