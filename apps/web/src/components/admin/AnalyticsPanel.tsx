'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  adminAnalyticsApi,
  ApiError,
  type AnalyticsBehavior,
  type AnalyticsContent,
  type AnalyticsDimRow,
  type AnalyticsHeatmap,
  type AnalyticsOverview,
  type AnalyticsRealtime,
} from '@/lib/api';
import { formatDateTime, formatNumber } from '@/lib/format';
import { BarList, ColumnChart, Kpi, LineChart, SERIES, WeekHourGrid, fmtDay, fmtDuration, pct } from './analytics/charts';

// Đợt 19 (26/09/2026) — Admin "🔎 Phân tích truy cập": toàn bộ là dữ liệu THẬT (theo yêu cầu người dùng
// "trong admin toàn bộ là dữ liệu thật hoàn toàn"): lượt xem, người xem, thời gian ở lại, độ cuộn, mọi
// cú click (bản đồ nhiệt), hành động quan trọng, nguồn truy cập, thiết bị. Đã loại Admin/Điều phối viên,
// lúc "Đăng nhập thay" và bot. Số "làm đẹp" của trang chủ KHÔNG bao giờ trộn vào đây — chỉ hiện riêng,
// tách bạch phần thật/phần ảo để Admin biết.

// ---------------------------------------------------------------- Nhãn tiếng Việt
const ROUTE_LABEL: Record<string, string> = {
  '/': 'Trang chủ',
  '/viec-lam': 'Danh sách việc làm',
  '/viec-lam/[id]': 'Chi tiết tin tuyển dụng',
  '/cong-ty/[id]': 'Trang công ty',
  '/dang-nhap': 'Đăng nhập / Đăng ký',
  '/ho-so': 'Ứng viên · Trang hồ sơ',
  '/ho-so/cv': 'Ứng viên · Quản lý CV',
  '/ho-so/truc-tuyen': 'Ứng viên · Hồ sơ trực tuyến',
  '/nha-tuyen-dung/dashboard': 'NTD · Dashboard',
  '/nha-tuyen-dung/dang-tin': 'NTD · Đăng tin',
  '/nha-tuyen-dung/tin-dang': 'NTD · Quản lý tin',
  '/nha-tuyen-dung/ung-vien': 'NTD · Ứng viên',
  '/nha-tuyen-dung/kho-cv': 'NTD · Kho CV',
  '/nha-tuyen-dung/kho-cv/[id]': 'NTD · Chi tiết Kho CV',
  '/nha-tuyen-dung/tim-ho-so': 'NTD · Tìm CV',
  '/nha-tuyen-dung/tim-ho-so/[id]': 'NTD · Xem hồ sơ ứng viên',
  '/nha-tuyen-dung/tai-khoan': 'NTD · Tài khoản',
  '/nha-tuyen-dung/don-hang': 'NTD · Đơn hàng',
  '/nha-tuyen-dung/dang-ky': 'NTD · Đăng ký',
  '/nha-tuyen-dung/xem-tin/[id]': 'NTD · Xem tin',
  '/chinh-sach-bao-mat': 'Chính sách bảo mật',
  '/dieu-khoan-su-dung': 'Điều khoản sử dụng',
  '/yeu-cau-ho-so': 'Yêu cầu gỡ / nhận lại hồ sơ',
};
const routeName = (r: string) => ROUTE_LABEL[r] ?? r;
function RouteCell({ route }: { route: string }) {
  return (
    <span>
      <span className="text-ink">{routeName(route)}</span>
      {ROUTE_LABEL[route] && <span className="ml-1.5 font-mono text-[10.5px] text-ink-faint">{route}</span>}
    </span>
  );
}

const EVENT_LABEL: Record<string, string> = {
  click: 'Click chuột (mọi nơi)',
  apply_click: 'Bấm “Ứng tuyển”',
  apply_submit: 'Nộp đơn thành công',
  save_job: 'Lưu tin',
  unsave_job: 'Bỏ lưu tin',
  follow_company: 'Theo dõi công ty',
  unfollow_company: 'Bỏ theo dõi công ty',
  contact_phone: 'Bấm số điện thoại',
  contact_email: 'Bấm email',
  contact_zalo: 'Bấm Zalo',
  outbound: 'Bấm link ra trang khác',
  search: 'Tìm việc làm',
  cv_search: 'NTD tìm hồ sơ',
  cv_unlock: 'NTD mở khoá hồ sơ',
  signup: 'Đăng ký tài khoản',
  login: 'Đăng nhập',
};
const CHANNEL_LABEL: Record<string, string> = {
  search: 'Công cụ tìm kiếm',
  social: 'Mạng xã hội',
  messaging: 'Tin nhắn / Email',
  referral: 'Website khác dẫn link',
  direct: 'Trực tiếp (gõ địa chỉ, bookmark)',
  campaign: 'Chiến dịch (link có UTM)',
};
const ROLE_LABEL: Record<string, string> = { guest: 'Khách chưa đăng nhập', candidate: 'Ứng viên', employer: 'Nhà tuyển dụng' };
const DEVICE_LABEL: Record<string, string> = { desktop: 'Máy tính', mobile: 'Điện thoại', tablet: 'Máy tính bảng' };

// ---------------------------------------------------------------- Khoảng ngày
function vnToday(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const PRESETS: { key: string; label: string; days: number }[] = [
  { key: 'today', label: 'Hôm nay', days: 1 },
  { key: '7', label: '7 ngày', days: 7 },
  { key: '30', label: '30 ngày', days: 30 },
  { key: '90', label: '90 ngày', days: 90 },
  { key: '365', label: '12 tháng', days: 365 },
];

type Sub = 'overview' | 'content' | 'behavior' | 'heatmap';

export function AnalyticsPanel({ token }: { token: string }) {
  const [sub, setSub] = useState<Sub>('overview');
  const [preset, setPreset] = useState('7');
  const [from, setFrom] = useState(addDays(vnToday(), -6));
  const [to, setTo] = useState(vnToday());

  function pickPreset(key: string) {
    const p = PRESETS.find((x) => x.key === key);
    setPreset(key);
    if (!p) return;
    const t = vnToday();
    setTo(t);
    setFrom(addDays(t, -(p.days - 1)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bold text-base">🔎 Phân tích truy cập</h1>
          <p className="text-xs text-ink-faint mt-0.5 max-w-2xl">
            100% dữ liệu thật ghi nhận từ trình duyệt người xem — đã loại tài khoản Admin/Điều phối viên, lúc “Đăng nhập thay” và bot.
            Thời gian ở lại chỉ tính lúc tab đang mở trước mắt người xem. Không lưu địa chỉ IP.
          </p>
        </div>
      </div>

      <RealtimeCard token={token} />

      <div className="rounded-xl bg-white border border-border p-3 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {(
            [
              ['overview', 'Tổng quan'],
              ['content', 'Tin & công ty'],
              ['behavior', 'Hành vi người dùng'],
              ['heatmap', 'Bản đồ nhiệt click'],
            ] as [Sub, string][]
          ).map(([k, l]) => (
            <button
              key={k}
              role="tab"
              aria-selected={sub === k}
              onClick={() => setSub(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${sub === k ? 'bg-primary text-white' : 'bg-surface-alt text-ink-muted hover:text-ink'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => pickPreset(p.key)}
              className={`px-2.5 py-1 rounded-md text-[11.5px] font-semibold border ${
                preset === p.key ? 'border-primary text-primary bg-primary-tint' : 'border-border text-ink-muted bg-white'
              }`}
            >
              {p.label}
            </button>
          ))}
          <input
            id="an-from"
            type="date"
            value={from}
            max={to}
            onChange={(e) => {
              setPreset('custom');
              if (e.target.value) setFrom(e.target.value);
            }}
            className="tvl-input !w-auto !py-1 !text-[11.5px]"
            aria-label="Từ ngày"
          />
          <span className="text-ink-faint text-xs">→</span>
          <input
            id="an-to"
            type="date"
            value={to}
            min={from}
            max={vnToday()}
            onChange={(e) => {
              setPreset('custom');
              if (e.target.value) setTo(e.target.value);
            }}
            className="tvl-input !w-auto !py-1 !text-[11.5px]"
            aria-label="Đến ngày"
          />
        </div>
      </div>

      {sub === 'overview' && <OverviewView token={token} from={from} to={to} />}
      {sub === 'content' && <ContentView token={token} from={from} to={to} />}
      {sub === 'behavior' && <BehaviorView token={token} from={from} to={to} />}
      {sub === 'heatmap' && <HeatmapView token={token} from={from} to={to} />}
    </div>
  );
}

// ---------------------------------------------------------------- Dùng chung
function useReport<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    load()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : 'Không tải được báo cáo'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error, loading };
}

function Card({ title, hint, children, className = '' }: { title: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl bg-white border border-border p-4 min-w-0 ${className}`}>
      <div className="mb-3">
        <h2 className="font-bold text-[13px] text-ink">{title}</h2>
        {hint && <div className="text-[11px] text-ink-faint mt-0.5">{hint}</div>}
      </div>
      {children}
    </section>
  );
}

function State({ loading, error, children }: { loading: boolean; error: string | null; children: React.ReactNode }) {
  if (error) return <div className="rounded-xl bg-critical-tint text-critical text-xs p-4">{error}</div>;
  if (loading) return <div className="rounded-xl bg-white border border-border p-8 text-center text-xs text-ink-faint">Đang tính số liệu…</div>;
  return <>{children}</>;
}

function ModeNote({ mode, retentionStart, clamped }: { mode: 'raw' | 'daily'; retentionStart: string; clamped?: boolean }) {
  if (clamped)
    return (
      <div className="rounded-lg bg-info-tint text-info text-[11.5px] px-3 py-2">
        Mục này cần dữ liệu chi tiết, chỉ lưu 90 ngày gần nhất — đang hiển thị từ {fmtDay(retentionStart)}.
      </div>
    );
  if (mode === 'daily')
    return (
      <div className="rounded-lg bg-info-tint text-info text-[11.5px] px-3 py-2">
        Khoảng ngày có phần cũ hơn 90 ngày → đọc số tổng hợp theo ngày (giữ vĩnh viễn). “Người xem” lúc này là cộng dồn theo từng ngày (1 người
        xem 3 ngày tính 3).
      </div>
    );
  return null;
}

function Table({ head, children, minW = 640 }: { head: React.ReactNode[]; children: React.ReactNode; minW?: number }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[12px] border-collapse" style={{ minWidth: minW }}>
        <thead>
          <tr className="text-left text-[11px] text-ink-faint border-b border-border">
            {head.map((h, i) => (
              <th key={i} className={`py-1.5 px-1 font-semibold ${i ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">{children}</tbody>
      </table>
    </div>
  );
}
const td = 'py-1.5 px-1 border-b border-border/60';
const tdr = `${td} text-right`;

// ---------------------------------------------------------------- Thời gian thực
function RealtimeCard({ token }: { token: string }) {
  const [rt, setRt] = useState<AnalyticsRealtime | null>(null);
  const [showFeed, setShowFeed] = useState(false);
  const load = useCallback(() => {
    adminAnalyticsApi
      .realtime(token)
      .then(setRt)
      .catch(() => undefined);
  }, [token]);
  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <section className="rounded-xl bg-white border border-border p-4">
      <div className="flex flex-wrap gap-x-8 gap-y-3 items-start">
        <div>
          <div className="text-[11.5px] text-ink-muted flex items-center gap-1.5">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            Đang online THẬT (75 giây qua)
          </div>
          <div className="text-[30px] font-extrabold tabular-nums leading-none mt-1">{rt ? formatNumber(rt.online.visitors) : '…'}</div>
          {rt && (
            <div className="text-[11px] text-ink-faint mt-1">
              {formatNumber(rt.online.byRole.candidate)} ứng viên · {formatNumber(rt.online.byRole.employer)} NTD ·{' '}
              {formatNumber(rt.online.byRole.guest)} khách — {formatNumber(rt.online.byDevice.mobile + rt.online.byDevice.tablet)} dùng điện thoại/tablet
            </div>
          )}
        </div>
        <div>
          <div className="text-[11.5px] text-ink-muted">Hôm nay (từ 0h)</div>
          <div className="text-[20px] font-extrabold tabular-nums leading-tight mt-1">
            {rt ? formatNumber(rt.today.views) : '…'} <span className="text-[12px] font-semibold text-ink-muted">lượt xem</span>
          </div>
          <div className="text-[11px] text-ink-faint">{rt ? formatNumber(rt.today.visitors) : '…'} người xem</div>
        </div>
        <div className="max-w-sm">
          <div className="text-[11.5px] text-ink-muted">Banner trang chủ đang hiển thị cho khách</div>
          <div className="text-[20px] font-extrabold tabular-nums leading-tight mt-1">{rt ? formatNumber(rt.homepageBanner.displayed) : '…'}</div>
          {rt && (
            <div className="text-[11px] text-ink-faint">
              = {formatNumber(rt.homepageBanner.real)} phiên thật đang mở trang chủ + {formatNumber(rt.homepageBanner.virtual)} số nền “làm đẹp” (theo
              lựa chọn trước đây). Số nền này KHÔNG tính vào bất kỳ số liệu nào trong Admin.
            </div>
          )}
        </div>
        <div className="flex-1 min-w-[220px]">
          <div className="text-[11.5px] text-ink-muted mb-1">Đang xem trang nào</div>
          {rt && rt.activePages.length ? (
            <ul className="text-[11.5px] flex flex-col gap-0.5">
              {rt.activePages.slice(0, 5).map((p) => (
                <li key={p.path} className="flex justify-between gap-2">
                  <span className="truncate">
                    {routeName(p.route)} <span className="text-ink-faint font-mono text-[10px]">{p.path !== p.route ? p.path.slice(0, 40) : ''}</span>
                  </span>
                  <b className="tabular-nums">{p.count}</b>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-[11.5px] text-ink-faint">Chưa có ai đang xem</div>
          )}
        </div>
      </div>
      {rt && rt.perMinute.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] text-ink-muted mb-1">Lượt xem trang mỗi phút — 30 phút qua</div>
          <ColumnChart height={48} items={last30Minutes(rt.perMinute)} valueLabel="lượt xem" />
        </div>
      )}
      <button onClick={() => setShowFeed((v) => !v)} className="mt-3 text-[11.5px] font-semibold text-primary hover:underline">
        {showFeed ? '▾ Ẩn' : '▸ Xem'} hành động mới nhất (24 giờ qua)
      </button>
      {showFeed && rt && (
        <ul className="mt-2 text-[11.5px] divide-y divide-border/60">
          {rt.recentActions.length === 0 && <li className="py-2 text-ink-faint">Chưa có hành động nào.</li>}
          {rt.recentActions.map((a, i) => (
            <li key={i} className="py-1.5 flex flex-wrap gap-x-2">
              <span className="text-ink-faint tabular-nums">{formatDateTime(a.at)}</span>
              <b className="text-ink">{EVENT_LABEL[a.type] ?? a.type}</b>
              <span className="text-ink-muted">
                {a.jobTitle ? `· ${a.jobTitle}` : a.companyName ? `· ${a.companyName}` : ''}
                {a.type === 'search' || a.type === 'cv_search'
                  ? `· “${String((a.meta as { q?: string } | null)?.q ?? '')}” (${formatNumber(Number((a.meta as { total?: number } | null)?.total ?? 0))} kết quả)`
                  : ''}
                {a.label && !a.jobTitle && a.type !== 'search' ? `· ${a.label}` : ''}
              </span>
              <span className="text-ink-faint">
                — {ROLE_LABEL[a.role] ?? a.role}, {DEVICE_LABEL[a.device] ?? a.device}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Đủ 30 cột phút (phút không có ai xem = 0) theo giờ Việt Nam.
function last30Minutes(rows: { minute: string; views: number }[]) {
  const map = new Map(rows.map((r) => [r.minute, r.views]));
  const now = Date.now() + 7 * 3600_000;
  return Array.from({ length: 30 }, (_, i) => {
    const m = new Date(now - (29 - i) * 60_000).toISOString().slice(11, 16);
    return { label: i % 5 === 4 || i === 29 ? m : '', value: map.get(m) ?? 0, title: m };
  });
}

// ---------------------------------------------------------------- Tổng quan
function OverviewView({ token, from, to }: { token: string; from: string; to: string }) {
  const { data, error, loading } = useReport(() => adminAnalyticsApi.overview(token, from, to), [token, from, to]);
  return (
    <State loading={loading} error={error}>
      {data && <Overview d={data} />}
    </State>
  );
}

function dimRows(rows: AnalyticsDimRow[] | undefined, label: (k: string) => string = (k) => k) {
  return (rows ?? []).map((r) => ({
    key: r.key,
    label: label(r.key),
    value: r.sessions,
    sub: `${formatNumber(r.visitors)} người · ${formatNumber(r.views)} lượt xem · ${fmtDuration(r.avgSessionTimeMs)}/phiên · thoát ${pct(r.bounceRate, 0)}${
      r.conversions ? ` · ${formatNumber(r.conversions)} phiên có nộp đơn` : ''
    }`,
  }));
}

function Overview({ d }: { d: AnalyticsOverview }) {
  const k = d.kpis;
  const p = d.prevKpis;
  const prevLabel = `${fmtDay(d.prevRange.from)}–${fmtDay(d.prevRange.to)}`;
  const empty = k.views === 0 && k.sessions === 0;
  return (
    <div className="flex flex-col gap-4">
      <ModeNote mode={d.range.mode} retentionStart={d.range.retentionStart} />
      {empty && (
        <div className="rounded-lg bg-warning-tint text-ink text-[12px] px-3 py-2">
          Chưa có lượt truy cập nào được ghi nhận trong khoảng ngày này. Bộ ghi bắt đầu đếm từ lúc bản cập nhật này lên web thật — số liệu sẽ
          xuất hiện ngay khi có người xem.
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Lượt xem trang" value={formatNumber(k.views)} raw={k.views} prevRaw={p.views} prev={prevLabel} />
        <Kpi
          label={k.visitorsApprox ? 'Người xem (cộng dồn theo ngày)' : 'Người xem duy nhất'}
          value={formatNumber(k.visitors)}
          raw={k.visitors}
          prevRaw={p.visitors}
          hint="Mỗi trình duyệt tính 1 người (mã ẩn danh)"
        />
        <Kpi label="Phiên truy cập" value={formatNumber(k.sessions)} raw={k.sessions} prevRaw={p.sessions} hint="Hết phiên sau 30 phút không hoạt động" />
        <Kpi label="Thời gian ở lại TB / trang" value={fmtDuration(k.avgPageTimeMs)} raw={k.avgPageTimeMs} prevRaw={p.avgPageTimeMs} />
        <Kpi label="Thời gian TB / phiên" value={fmtDuration(k.avgSessionTimeMs)} raw={k.avgSessionTimeMs} prevRaw={p.avgSessionTimeMs} />
        <Kpi label="Số trang / phiên" value={k.pagesPerSession.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} raw={k.pagesPerSession} prevRaw={p.pagesPerSession} />
        <Kpi
          label="Tỷ lệ thoát (xem 1 trang rồi đi)"
          value={pct(k.bounceRate)}
          raw={k.bounceRate}
          prevRaw={p.bounceRate}
          lowerIsBetter
        />
        <Kpi label="Tổng click chuột thật" value={formatNumber(k.clicks)} raw={k.clicks} prevRaw={p.clicks} />
        <Kpi label="Khách mới" value={pct(k.newVisitorRate, 0)} raw={k.newVisitorRate} prevRaw={p.newVisitorRate} hint="% người xem lần đầu đến web" />
        <Kpi label="Đã đăng nhập" value={pct(k.loggedInRate, 0)} raw={k.loggedInRate} prevRaw={p.loggedInRate} hint="% người xem đang đăng nhập tài khoản" />
        <Kpi label="Click / lượt xem" value={k.clicksPerView.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} raw={k.clicksPerView} prevRaw={p.clicksPerView} />
        <Kpi label="Bot đã chặn (không tính)" value={formatNumber(d.bots.reduce((s, b) => s + b.hits, 0))} raw={0} />
      </div>

      <Card title="Lượt xem & người xem theo ngày">
        <LineChart
          labels={d.daily.map((x) => fmtDay(x.day))}
          titleFor={(i) => d.daily[i].day.split('-').reverse().join('/')}
          series={[
            { name: 'Lượt xem trang', values: d.daily.map((x) => x.views), color: SERIES[0] },
            { name: 'Người xem', values: d.daily.map((x) => x.visitors), color: SERIES[1] },
            { name: 'Phiên', values: d.daily.map((x) => x.sessions), color: SERIES[2] },
          ]}
        />
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Giờ nào đông người xem nhất" hint="Lượt xem trang theo giờ (giờ Việt Nam)">
          <ColumnChart items={d.hours.map((h) => ({ label: `${h.hour}h`, value: h.views, title: `${h.hour}h–${h.hour + 1}h` }))} valueLabel="lượt xem" />
        </Card>
        <Card title="Ngày trong tuần × giờ" hint={d.weekHour ? 'Đậm = đông người' : undefined}>
          {d.weekHour ? <WeekHourGrid grid={d.weekHour} /> : <div className="text-xs text-ink-faint">Chỉ có trong 90 ngày gần nhất.</div>}
        </Card>
      </div>

      <Card title="Trang được xem nhiều nhất" hint="Thời gian ở lại = lúc tab đang mở trước mắt; Cuộn = trung bình người xem cuộn tới bao nhiêu % trang">
        <Table head={['Trang', 'Lượt xem', 'Người xem', 'Ở lại TB', 'Cuộn TB', 'Vào web từ đây', 'Tỷ lệ rời web']}>
          {d.topPages.map((r) => (
            <tr key={r.route}>
              <td className={td}>
                <RouteCell route={r.route} />
              </td>
              <td className={tdr}>{formatNumber(r.views)}</td>
              <td className={tdr}>{formatNumber(r.visitors)}</td>
              <td className={tdr}>{fmtDuration(r.avgTimeMs)}</td>
              <td className={tdr}>{r.avgScroll}%</td>
              <td className={tdr}>{formatNumber(r.entries)}</td>
              <td className={tdr}>{pct(r.exitRate, 0)}</td>
            </tr>
          ))}
          {!d.topPages.length && (
            <tr>
              <td colSpan={7} className="py-4 text-center text-ink-faint">
                Chưa có dữ liệu
              </td>
            </tr>
          )}
        </Table>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Nguồn truy cập" hint="Số phiên theo nơi người xem đến từ (Google, Facebook, Zalo, link UTM...)">
          <BarList rows={dimRows(d.dims.source)} />
        </Card>
        <Card title="Nhóm kênh">
          <BarList rows={dimRows(d.dims.channel, (k) => CHANNEL_LABEL[k] ?? k)} />
          {!!d.dims.campaign?.length && (
            <div className="mt-4">
              <div className="text-[11.5px] font-semibold text-ink-muted mb-2">Chiến dịch (utm_campaign)</div>
              <BarList rows={dimRows(d.dims.campaign)} />
            </div>
          )}
        </Card>
        <Card title="Thiết bị">
          <BarList rows={dimRows(d.dims.device, (k) => DEVICE_LABEL[k] ?? k)} />
          <div className="mt-4 text-[11.5px] font-semibold text-ink-muted mb-2">Hệ điều hành</div>
          <BarList rows={dimRows(d.dims.os)} />
        </Card>
        <Card title="Trình duyệt">
          <BarList rows={dimRows(d.dims.browser)} />
        </Card>
        <Card title="Tỉnh / thành (ước lượng)" hint="Theo vị trí mạng lúc bắt đầu phiên, không lưu IP. Chạy thử trên máy cá nhân sẽ là “Không rõ”.">
          <BarList rows={dimRows(d.dims.city)} />
        </Card>
        <Card title="Loại người xem">
          <BarList rows={dimRows(d.dims.role, (k) => ROLE_LABEL[k] ?? k)} />
        </Card>
      </div>

      <Card title="Bot / công cụ tự động đã ghé (KHÔNG tính vào số liệu trên)">
        <BarList rows={d.bots.map((b) => ({ key: b.bot, label: b.bot, value: b.hits }))} empty="Chưa ghi nhận bot nào" />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- Tin & công ty
type JobSort = 'views' | 'visitors' | 'avgTimeMs' | 'applyClicks' | 'applications' | 'conversionRate';

function ContentView({ token, from, to }: { token: string; from: string; to: string }) {
  const { data, error, loading } = useReport(() => adminAnalyticsApi.content(token, from, to), [token, from, to]);
  return (
    <State loading={loading} error={error}>
      {data && <Content d={data} />}
    </State>
  );
}

function Content({ d }: { d: AnalyticsContent }) {
  const [sort, setSort] = useState<JobSort>('views');
  const jobs = useMemo(() => [...d.jobs].sort((a, b) => (b[sort] as number) - (a[sort] as number)), [d.jobs, sort]);
  const f = d.funnel;
  const steps = [
    { label: 'Người vào web', value: f.siteVisitors },
    { label: 'Người xem ít nhất 1 tin', value: f.jobVisitors },
    { label: 'Người bấm “Ứng tuyển”', value: f.applyClickVisitors },
    { label: 'Nộp đơn thành công trên web', value: f.applySubmitsTracked },
  ];
  const maxStep = Math.max(1, ...steps.map((s) => s.value));
  const sortBtn = (k: JobSort, l: string) => (
    <button onClick={() => setSort(k)} className={`underline-offset-2 ${sort === k ? 'text-primary font-bold underline' : 'hover:underline'}`}>
      {l}
    </button>
  );
  return (
    <div className="flex flex-col gap-4">
      <ModeNote mode={d.range.mode} retentionStart={d.range.retentionStart} />
      <Card
        title="Phễu ứng tuyển"
        hint="Từ lúc vào web đến khi nộp đơn — cùng 1 nhóm người xem được bộ ghi truy cập ghi nhận."
      >
        <div className="flex flex-col gap-2.5">
          {steps.map((s, i) => (
            <div key={s.label} className="grid grid-cols-[150px_1fr_auto] md:grid-cols-[200px_1fr_140px] items-center gap-3 text-[12px]">
              <div className="text-ink">{s.label}</div>
              <div className="h-5 rounded bg-surface-alt overflow-hidden">
                <div className="h-full rounded" style={{ width: `${(s.value / maxStep) * 100}%`, background: SERIES[0] }} />
              </div>
              <div className="text-right tabular-nums">
                <b>{formatNumber(s.value)}</b>
                {i > 0 && steps[i - 1].value > 0 && (
                  <span className="text-ink-faint text-[11px]"> · {pct(s.value / steps[i - 1].value, 0)} bước trước</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[11.5px] text-ink-muted">
          Tổng đơn ứng tuyển thật trong CSDL cùng kỳ: <b className="text-ink">{formatNumber(f.applicationsDb)}</b> (gồm cả đơn nộp lúc bộ ghi chưa chạy
          hoặc từ trình duyệt chặn ghi nhận).
          <br />
          {formatNumber(f.jobViews)} lượt xem tin · {formatNumber(f.applyClicks)} lần bấm Ứng tuyển · {formatNumber(f.applySubmitsTracked)} lần nộp thành công ghi
          nhận trên web · {formatNumber(f.searches)} lượt tìm việc
        </div>
      </Card>

      <Card title="Hiệu quả từng tin tuyển dụng" hint="Bấm tiêu đề cột để sắp xếp. Tỷ lệ chuyển đổi = đơn thật ÷ người xem tin.">
        <Table
          minW={900}
          head={[
            'Tin',
            sortBtn('views', 'Lượt xem'),
            sortBtn('visitors', 'Người xem'),
            sortBtn('avgTimeMs', 'Đọc TB'),
            'Cuộn',
            sortBtn('applyClicks', 'Bấm ứng tuyển'),
            sortBtn('applications', 'Đơn thật'),
            sortBtn('conversionRate', 'Chuyển đổi'),
            'Lưu / Liên hệ',
          ]}
        >
          {jobs.map((j) => (
            <tr key={j.id}>
              <td className={`${td} max-w-[280px]`}>
                <Link href={`/admin/xem-tin/${j.id}`} className="text-primary hover:underline line-clamp-1">
                  {j.title}
                </Link>
                <div className="text-[10.5px] text-ink-faint truncate">{j.companyName ?? ''}</div>
              </td>
              <td className={tdr}>{formatNumber(j.views)}</td>
              <td className={tdr}>{formatNumber(j.visitors)}</td>
              <td className={tdr}>{fmtDuration(j.avgTimeMs)}</td>
              <td className={tdr}>{j.avgScroll ? `${j.avgScroll}%` : '—'}</td>
              <td className={tdr}>{formatNumber(j.applyClicks)}</td>
              <td className={tdr}>{formatNumber(j.applications)}</td>
              <td className={tdr}>{pct(j.conversionRate)}</td>
              <td className={tdr}>
                {formatNumber(j.saves)} / {formatNumber(j.contacts)}
              </td>
            </tr>
          ))}
          {!jobs.length && (
            <tr>
              <td colSpan={9} className="py-4 text-center text-ink-faint">
                Chưa có lượt xem tin nào
              </td>
            </tr>
          )}
        </Table>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Ngành nghề được quan tâm" hint="Cộng từ các tin được xem nhiều nhất ở bảng trên">
          <BarList
            rows={d.industries.map((i) => ({
              key: i.industry,
              label: i.industry,
              value: i.views,
              sub: `${formatNumber(i.visitors)} người xem · ${formatNumber(i.applications)} đơn · ${formatNumber(i.jobs)} tin`,
            }))}
          />
        </Card>
        <Card title="Công ty được xem nhiều" hint="Lượt xem trang công ty + lượt xem các tin của công ty; theo dõi và đơn lấy từ CSDL">
          <BarList
            rows={d.companies.map((c) => ({
              key: c.id,
              label: c.name,
              value: c.pageViews + c.jobViews,
              sub: `${formatNumber(c.pageViews)} xem trang công ty · ${formatNumber(c.jobViews)} xem tin · ${formatNumber(c.follows)} theo dõi mới · ${formatNumber(
                c.applications,
              )} đơn`,
            }))}
          />
        </Card>
        <Card title="Từ khoá tìm việc phổ biến">
          <Table head={['Từ khoá', 'Lượt tìm', 'Người tìm', 'Không ra kết quả']} minW={360}>
            {d.searches.map((s) => (
              <tr key={s.q}>
                <td className={td}>{s.q}</td>
                <td className={tdr}>{formatNumber(s.count)}</td>
                <td className={tdr}>{formatNumber(s.visitors)}</td>
                <td className={tdr}>{s.zero ? formatNumber(s.zero) : '—'}</td>
              </tr>
            ))}
            {!d.searches.length && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-ink-faint">
                  Chưa có lượt tìm có từ khoá
                </td>
              </tr>
            )}
          </Table>
        </Card>
        <Card title="Tìm mà KHÔNG ra kết quả" hint="Nhu cầu thật chưa được đáp ứng — gợi ý nên tìm thêm tin/công ty cho các từ khoá này">
          <BarList
            color={SERIES[1]}
            rows={d.zeroSearches.map((s) => ({ key: s.q, label: `“${s.q}”`, value: s.zero, sub: `${formatNumber(s.count)} lượt tìm tổng` }))}
            empty="Chưa có từ khoá nào tìm mà không ra kết quả"
          />
        </Card>
        <Card title="NTD tìm hồ sơ ứng viên (Tìm CV)">
          <BarList
            rows={d.cvSearches.map((s) => ({
              key: s.q,
              label: s.q,
              value: s.count,
              sub: `${formatNumber(s.visitors)} NTD${s.zero ? ` · ${formatNumber(s.zero)} lần không ra hồ sơ nào` : ''}`,
            }))}
            empty="Chưa có lượt tìm hồ sơ có từ khoá"
          />
        </Card>
        <Card title="Mọi hành động ghi nhận">
          <BarList
            rows={d.events.map((e) => ({
              key: e.type,
              label: EVENT_LABEL[e.type] ?? e.type,
              value: e.count,
              sub: `${formatNumber(e.visitors)} người`,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Hành vi
function BehaviorView({ token, from, to }: { token: string; from: string; to: string }) {
  const { data, error, loading } = useReport(() => adminAnalyticsApi.behavior(token, from, to), [token, from, to]);
  return (
    <State loading={loading} error={error}>
      {data && <Behavior d={data} />}
    </State>
  );
}

function Behavior({ d }: { d: AnalyticsBehavior }) {
  return (
    <div className="flex flex-col gap-4">
      <ModeNote mode="raw" retentionStart={d.range.retentionStart} clamped={d.range.clamped} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Người quay lại" value={pct(d.returning.returningRate, 0)} raw={d.returning.returningRate} hint="% người xem đã từng vào web trước đó" />
        <Kpi label="Vào web ≥ 2 lần trong kỳ" value={formatNumber(d.returning.multiSessionVisitors)} raw={0} />
        <Kpi label="Ứng viên đăng ký mới (CSDL)" value={formatNumber(d.registrations.candidates)} raw={0} />
        <Kpi label="NTD đăng ký mới (CSDL)" value={formatNumber(d.registrations.employers)} raw={0} />
      </div>

      <Card title="Người xem mỗi ngày theo loại" hint="Người xem duy nhất trong ngày">
        <LineChart
          labels={d.dailyRoles.map((x) => fmtDay(x.day))}
          titleFor={(i) => d.dailyRoles[i].day.split('-').reverse().join('/')}
          series={[
            { name: 'Khách chưa đăng nhập', values: d.dailyRoles.map((x) => x.guest), color: SERIES[0] },
            { name: 'Ứng viên', values: d.dailyRoles.map((x) => x.candidate), color: SERIES[1] },
            { name: 'Nhà tuyển dụng', values: d.dailyRoles.map((x) => x.employer), color: SERIES[2] },
          ]}
        />
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Số lần vào web / người">
          <ColumnChart items={d.frequency.map((b) => ({ label: b.bucket, value: b.count, title: `${b.bucket} lần` }))} valueLabel="người" />
        </Card>
        <Card title="Số trang xem / phiên">
          <ColumnChart items={d.depth.map((b) => ({ label: b.bucket, value: b.count, title: `${b.bucket} trang` }))} valueLabel="phiên" />
        </Card>
        <Card title="Thời gian thật / phiên">
          <ColumnChart items={d.sessionLength.map((b) => ({ label: b.bucket.replace(' giây', 's').replace(' phút', 'p'), value: b.count, title: b.bucket }))} valueLabel="phiên" />
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Nhà tuyển dụng dùng web thế nào">
          <div className="grid grid-cols-2 gap-2 text-[12px] mb-3">
            <Stat label="NTD hoạt động" value={d.employer.active} />
            <Stat label="Lượt tìm hồ sơ" value={d.employer.cvSearches} />
            <Stat label="Hồ sơ mở khoá (CSDL)" value={d.employer.cvUnlocks} />
            <Stat label="Tin đăng mới (CSDL)" value={d.employer.jobsPosted} />
          </div>
          <BarList
            rows={d.employer.routes.map((r) => ({ key: r.route, label: routeName(r.route), value: r.views, sub: `${formatNumber(r.visitors)} NTD` }))}
            empty="Chưa có NTD nào đăng nhập xem web"
          />
        </Card>
        <Card title="Ứng viên dùng web thế nào">
          <div className="grid grid-cols-2 gap-2 text-[12px] mb-3">
            <Stat label="Ứng viên hoạt động" value={d.candidate.active} />
            <Stat label="Đơn ứng tuyển (CSDL)" value={d.candidate.applications} />
            <Stat label="Người nộp đơn (CSDL)" value={d.candidate.applicants} />
            <Stat label="Lưu tin / theo dõi" value={d.candidate.saves + d.candidate.follows} />
          </div>
          <BarList
            rows={d.candidate.routes.map((r) => ({ key: r.route, label: routeName(r.route), value: r.views, sub: `${formatNumber(r.visitors)} ứng viên` }))}
            empty="Chưa có ứng viên nào đăng nhập xem web"
          />
        </Card>
      </div>

      <Card title="Đường đi phổ biến" hint="Từ trang này người xem đi tiếp sang trang nào">
        <Table head={['Từ trang', 'Sang trang', 'Số lần']} minW={520}>
          {d.paths.map((p, i) => (
            <tr key={i}>
              <td className={td}>{routeName(p.from)}</td>
              <td className={tdr}>→ {routeName(p.to)}</td>
              <td className={tdr}>{formatNumber(p.count)}</td>
            </tr>
          ))}
          {!d.paths.length && (
            <tr>
              <td colSpan={3} className="py-4 text-center text-ink-faint">
                Chưa có dữ liệu
              </td>
            </tr>
          )}
        </Table>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Trang vào web đầu tiên">
          <BarList rows={d.entryPages.map((e) => ({ key: e.route, label: routeName(e.route), value: e.count }))} />
        </Card>
        <Card title="Trang rời web nhiều nhất" hint="Tỷ lệ = số lần rời web ở trang này ÷ lượt xem trang">
          <BarList
            color={SERIES[1]}
            rows={d.exitPages.map((e) => ({ key: e.route, label: routeName(e.route), value: e.count, sub: `${pct(e.exitRate, 0)} lượt xem kết thúc ở đây` }))}
          />
        </Card>
      </div>

      <Card title="Tài khoản hoạt động nhiều nhất" hint={`${pct(d.loggedInSessionRate, 0)} số phiên có đăng nhập`}>
        <Table head={['Tài khoản', 'Loại', 'Lượt xem', 'Phiên', 'Tổng thời gian', 'Lần cuối']} minW={640}>
          {d.topUsers.map((u) => (
            <tr key={u.userId}>
              <td className={td}>{u.email}</td>
              <td className={tdr}>{ROLE_LABEL[u.role] ?? u.role}</td>
              <td className={tdr}>{formatNumber(u.views)}</td>
              <td className={tdr}>{formatNumber(u.sessions)}</td>
              <td className={tdr}>{fmtDuration(u.totalTimeMs)}</td>
              <td className={tdr}>{formatDateTime(u.lastSeen)}</td>
            </tr>
          ))}
          {!d.topUsers.length && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-ink-faint">
                Chưa có dữ liệu
              </td>
            </tr>
          )}
        </Table>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-alt px-3 py-2">
      <div className="text-[10.5px] text-ink-muted">{label}</div>
      <div className="font-extrabold text-[16px] tabular-nums">{formatNumber(value)}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Bản đồ nhiệt
function HeatmapView({ token, from, to }: { token: string; from: string; to: string }) {
  const pages = useReport(() => adminAnalyticsApi.heatmapPages(token, from, to), [token, from, to]);
  const [sel, setSel] = useState<{ route: string; device: 'desktop' | 'mobile' } | null>(null);
  const [path, setPath] = useState<string>('');
  const [hm, setHm] = useState<AnalyticsHeatmap | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!sel && pages.data?.pages.length) {
      const first = pages.data.pages[0];
      setSel({ route: first.route, device: first.device === 'mobile' ? 'mobile' : 'desktop' });
    }
  }, [pages.data, sel]);

  useEffect(() => {
    if (!sel) return;
    setErr(null);
    adminAnalyticsApi
      .heatmap(token, { route: sel.route, device: sel.device, from, to, path: path || undefined })
      .then(setHm)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Không tải được bản đồ nhiệt'));
  }, [token, sel, from, to, path]);

  return (
    <State loading={pages.loading} error={pages.error}>
      {pages.data && !pages.data.pages.length ? (
        <div className="rounded-xl bg-white border border-border p-6 text-center text-xs text-ink-faint">
          Chưa có cú click nào được ghi nhận trong khoảng ngày này.
        </div>
      ) : (
        <div className="grid lg:grid-cols-[260px_1fr] gap-4">
          <Card title="Chọn trang">
            <div className="flex flex-col gap-1 max-h-[560px] overflow-y-auto">
              {pages.data?.pages.map((p) => {
                const active = sel?.route === p.route && sel.device === p.device;
                return (
                  <button
                    key={p.route + p.device}
                    onClick={() => {
                      setPath('');
                      setSel({ route: p.route, device: p.device === 'mobile' ? 'mobile' : 'desktop' });
                    }}
                    className={`text-left rounded-lg px-2.5 py-1.5 text-[12px] ${active ? 'bg-primary-tint text-primary font-semibold' : 'hover:bg-surface-alt'}`}
                  >
                    <div className="truncate">{routeName(p.route)}</div>
                    <div className="text-[10.5px] text-ink-faint">
                      {p.device === 'mobile' ? '📱 Điện thoại' : '🖥️ Máy tính'} · {formatNumber(p.clicks)} click
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
          <div className="flex flex-col gap-4 min-w-0">
            {err && <div className="rounded-xl bg-critical-tint text-critical text-xs p-3">{err}</div>}
            {hm && sel && (
              <>
                <div className="rounded-xl bg-white border border-border p-3 flex flex-wrap gap-3 items-center text-[12px]">
                  <div className="flex gap-1">
                    {(['desktop', 'mobile'] as const).map((dv) => (
                      <button
                        key={dv}
                        onClick={() => setSel({ route: sel.route, device: dv })}
                        className={`px-2.5 py-1 rounded-md text-[11.5px] font-semibold border ${
                          sel.device === dv ? 'border-primary text-primary bg-primary-tint' : 'border-border text-ink-muted'
                        }`}
                      >
                        {dv === 'mobile' ? '📱 Điện thoại' : '🖥️ Máy tính'}
                      </button>
                    ))}
                  </div>
                  {hm.samplePaths.length > 1 && (
                    <select
                      id="hm-path"
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      className="tvl-input !w-auto !py-1 !text-[11.5px] max-w-[320px]"
                      aria-label="Chọn trang cụ thể"
                    >
                      <option value="">Gộp mọi trang cùng loại</option>
                      {hm.samplePaths.map((s) => (
                        <option key={s.path} value={s.path}>
                          {s.path} ({formatNumber(s.views)} lượt xem)
                        </option>
                      ))}
                    </select>
                  )}
                  <span className="text-ink-muted">
                    <b className="text-ink">{formatNumber(hm.clicks)}</b> click · {formatNumber(hm.visitors)} người · {formatNumber(hm.pageviews)} lượt xem · ở lại TB{' '}
                    {fmtDuration(hm.avgTimeMs)}
                  </span>
                </div>
                <div className="grid xl:grid-cols-[1fr_280px] gap-4">
                  <HeatCanvas hm={hm} />
                  <div className="flex flex-col gap-4">
                    <Card title="Được bấm nhiều nhất">
                      <BarList
                        rows={hm.elements.map((e) => ({ key: e.label, label: e.label, value: e.count, sub: `${formatNumber(e.visitors)} người` }))}
                        color={SERIES[1]}
                      />
                    </Card>
                    <Card title="Người xem cuộn tới đâu" hint="% lượt xem cuộn tới ít nhất mức này">
                      <div className="flex flex-col gap-1">
                        {hm.scrollReach.map((s) => (
                          <div key={s.depth} className="grid grid-cols-[42px_1fr_44px] items-center gap-2 text-[11.5px]">
                            <span className="text-ink-muted tabular-nums">{s.depth}%</span>
                            <div className="h-2.5 rounded bg-surface-alt overflow-hidden">
                              <div className="h-full rounded" style={{ width: `${s.rate * 100}%`, background: SERIES[0] }} />
                            </div>
                            <span className="text-right tabular-nums">{pct(s.rate, 0)}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </State>
  );
}

// Trang thật hiển thị trong khung (không bấm được) + lớp màu các điểm được click, đúng bề ngang thiết bị.
function HeatCanvas({ hm }: { hm: AnalyticsHeatmap }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [frameH, setFrameH] = useState(Math.max(900, hm.docHeight || 0));
  const W = hm.device === 'mobile' ? 390 : 1280;
  const src = hm.path ?? (hm.route.includes('[id]') ? hm.samplePaths[0]?.path ?? '/' : hm.route);
  const H = Math.max(frameH, ...hm.points.map((p) => p.y + 40));

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const upd = () => setScale(Math.min(1, el.clientWidth / W));
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    // Bước 1: cộng dồn độ đậm (kênh alpha) bằng các đốm tròn mờ.
    const tmp = document.createElement('canvas');
    tmp.width = W;
    tmp.height = H;
    const t = tmp.getContext('2d');
    if (!t) return;
    const max = Math.max(1, ...hm.points.map((p) => p.n));
    const R = hm.device === 'mobile' ? 22 : 30;
    for (const p of hm.points) {
      const x = p.x * W;
      const y = p.y + 8;
      const g = t.createRadialGradient(x, y, 0, x, y, R);
      const a = Math.min(1, 0.25 + 0.75 * (p.n / max));
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      t.fillStyle = g;
      t.fillRect(x - R, y - R, R * 2, R * 2);
    }
    // Bước 2: tô màu theo độ đậm — 1 dải ấm (vàng nhạt → đỏ) có độ trong suốt để vẫn thấy trang bên dưới.
    const img = t.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3] / 255;
      if (a < 0.02) continue;
      d[i] = 245;
      d[i + 1] = Math.round(200 - 170 * a);
      d[i + 2] = Math.round(40 - 20 * a);
      d[i + 3] = Math.round(60 + 170 * a);
    }
    ctx.clearRect(0, 0, W, H);
    ctx.putImageData(img, 0, 0);
  }, [hm, W, H]);

  return (
    <div className="rounded-xl bg-white border border-border p-3 min-w-0">
      <div className="text-[11px] text-ink-faint mb-2">
        Trang thật đang hiển thị: <span className="font-mono">{src}</span> (bề ngang {W}px). Vị trí đỏ = được bấm nhiều. Nội dung trang có thể đã thay đổi so với lúc
        người xem bấm.
      </div>
      <div ref={wrapRef} className="w-full overflow-hidden rounded-lg border border-border bg-surface-alt" style={{ height: H * scale }}>
        <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'relative' }}>
          <iframe
            src={src}
            title="Xem trước trang"
            className="absolute inset-0 border-0 bg-white"
            style={{ width: W, height: H, pointerEvents: 'none' }}
            onLoad={(e) => {
              try {
                const doc = (e.currentTarget as HTMLIFrameElement).contentDocument;
                const h = doc?.documentElement.scrollHeight;
                if (h && h > 200) setFrameH(Math.min(h, 20000));
              } catch {
                /* khác nguồn — giữ chiều cao ước lượng */
              }
            }}
          />
          <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: W, height: H }} />
        </div>
      </div>
    </div>
  );
}
