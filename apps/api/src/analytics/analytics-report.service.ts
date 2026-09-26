import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PresenceService } from '../presence/presence.service';
import {
  AnalyticsRollupService,
  addDays,
  retentionStartDay,
  vnDayStart,
  vnToday,
} from './analytics-rollup.service';

// Đợt 19 (26/09/2026) — báo cáo "Phân tích truy cập" cho Admin. 100% dữ liệu thật: chỉ đọc từ bảng
// analytics_* (ghi nhận từ trình duyệt người thật, đã loại Admin/bot) và từ các bảng nghiệp vụ thật
// (đơn ứng tuyển, đăng ký, mở khoá hồ sơ...). KHÔNG dùng bất kỳ số "làm đẹp" nào của trang chủ.
//
// Khoảng ngày nằm trọn trong 90 ngày gần nhất → tính thẳng từ dữ liệu chi tiết (chính xác tuyệt đối,
// kể cả "người xem duy nhất" cả khoảng). Khoảng cũ hơn → đọc số tổng hợp theo ngày (analytics_daily);
// khi đó "người xem" là cộng dồn theo từng ngày (1 người xem 3 ngày tính 3) — giao diện ghi chú rõ.

const TZ = 'Asia/Ho_Chi_Minh';
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

type Mode = 'raw' | 'daily';
interface Range {
  from: string;
  to: string;
  F: Date;
  T: Date;
  days: number;
  mode: Mode;
}

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

@Injectable()
export class AnalyticsReportService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly rollup: AnalyticsRollupService,
    private readonly presence: PresenceService,
  ) {}

  range(from?: string, to?: string): Range {
    const today = vnToday();
    const t = to && DAY_RE.test(to) ? to : today;
    const f = from && DAY_RE.test(from) ? from : addDays(t, -6);
    if (f > t)
      throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    const days =
      Math.round(
        (vnDayStart(t).getTime() - vnDayStart(f).getTime()) / 86_400_000,
      ) + 1;
    if (days > 3700) throw new BadRequestException('Khoảng ngày quá dài');
    return {
      from: f,
      to: t,
      F: vnDayStart(f),
      T: vnDayStart(addDays(t, 1)),
      days,
      mode: f >= retentionStartDay() ? 'raw' : 'daily',
    };
  }

  private prevRange(r: Range): Range {
    return this.range(addDays(r.from, -r.days), addDays(r.from, -1));
  }

  // ------------------------------------------------------------------ Thời gian thực
  async realtime() {
    const [online] = await this.ds.query(
      `SELECT count(*) AS sessions, count(DISTINCT visitor_id) AS visitors,
         count(*) FILTER (WHERE role = 'candidate') AS candidates,
         count(*) FILTER (WHERE role = 'employer') AS employers,
         count(*) FILTER (WHERE role = 'guest') AS guests,
         count(*) FILTER (WHERE device = 'mobile') AS mobile,
         count(*) FILTER (WHERE device = 'tablet') AS tablet,
         count(*) FILTER (WHERE device = 'desktop') AS desktop
       FROM analytics_sessions WHERE last_seen_at > now() - interval '75 seconds'`,
    );
    const pages = await this.ds.query(
      `SELECT route, path, count(*) AS n FROM (
         SELECT DISTINCT ON (p.session_id) p.route, p.path
         FROM analytics_pageviews p JOIN analytics_sessions s ON s.id = p.session_id
         WHERE s.last_seen_at > now() - interval '75 seconds' AND p.started_at > now() - interval '1 day'
         ORDER BY p.session_id, p.started_at DESC) z
       GROUP BY route, path ORDER BY n DESC LIMIT 15`,
    );
    const perMinute = await this.ds.query(
      `SELECT to_char(date_trunc('minute', started_at) AT TIME ZONE '${TZ}', 'HH24:MI') AS m, count(*) AS views
       FROM analytics_pageviews WHERE started_at > now() - interval '30 minutes' GROUP BY 1 ORDER BY 1`,
    );
    const recent = await this.ds.query(
      `SELECT e.type, e.route, e.path, e.label, e.role, e.device, e.created_at AS "at", e.meta,
         jp.title AS "jobTitle", c.name AS "companyName"
       FROM analytics_events e
       LEFT JOIN job_postings jp ON e.entity_type = 'job' AND jp.id = e.entity_id
       LEFT JOIN companies c ON e.entity_type = 'company' AND c.id = e.entity_id
       WHERE e.type <> 'click' AND e.created_at > now() - interval '24 hours'
       ORDER BY e.created_at DESC LIMIT 20`,
    );
    const [today] = await this.ds.query(
      `SELECT count(*) AS views, count(DISTINCT visitor_id) AS visitors FROM analytics_pageviews WHERE started_at >= $1`,
      [vnDayStart(vnToday())],
    );
    return {
      online: {
        sessions: n(online.sessions),
        visitors: n(online.visitors),
        byRole: {
          candidate: n(online.candidates),
          employer: n(online.employers),
          guest: n(online.guests),
        },
        byDevice: {
          desktop: n(online.desktop),
          mobile: n(online.mobile),
          tablet: n(online.tablet),
        },
      },
      homepageBanner: this.presence.getBreakdown(),
      activePages: pages.map((p: any) => ({
        route: p.route,
        path: p.path,
        count: n(p.n),
      })),
      perMinute: perMinute.map((r: any) => ({
        minute: r.m,
        views: n(r.views),
      })),
      recentActions: recent,
      today: { views: n(today.views), visitors: n(today.visitors) },
      at: new Date().toISOString(),
    };
  }

  // ------------------------------------------------------------------ Tổng quan
  private async kpis(r: Range) {
    if (r.mode === 'raw') {
      const [k] = await this.ds.query(
        `WITH pv AS (SELECT * FROM analytics_pageviews WHERE started_at >= $1 AND started_at < $2),
              s AS (SELECT * FROM analytics_sessions WHERE started_at >= $1 AND started_at < $2)
         SELECT
           (SELECT count(*) FROM pv) AS views,
           (SELECT count(DISTINCT visitor_id) FROM pv) AS visitors,
           (SELECT count(*) FROM s) AS sessions,
           (SELECT coalesce(sum(duration_ms), 0) FROM pv) AS dur,
           (SELECT count(*) FROM pv WHERE duration_ms > 0) AS durn,
           (SELECT count(*) FROM (SELECT s.id FROM s JOIN analytics_pageviews p ON p.session_id = s.id GROUP BY s.id HAVING count(*) = 1) z) AS bounces,
           (SELECT count(DISTINCT visitor_id) FROM s WHERE is_new_visitor) AS new_visitors,
           (SELECT count(DISTINCT visitor_id) FROM s) AS session_visitors,
           (SELECT count(DISTINCT visitor_id) FROM s WHERE user_id IS NOT NULL) AS logged_in,
           (SELECT count(*) FROM analytics_events WHERE type = 'click' AND created_at >= $1 AND created_at < $2) AS clicks`,
        [r.F, r.T],
      );
      return this.shapeKpis(k, false);
    }
    await this.rollup.refreshToday();
    const [k] = await this.ds.query(
      `SELECT coalesce(sum(views), 0) AS views, coalesce(sum(visitors), 0) AS visitors, coalesce(sum(sessions), 0) AS sessions,
         coalesce(sum(duration_ms), 0) AS dur, coalesce(sum(duration_n), 0) AS durn, coalesce(sum(bounces), 0) AS bounces,
         coalesce(sum((extra->>'newVisitors')::int), 0) AS new_visitors,
         coalesce(sum((extra->>'sessionVisitors')::int), 0) AS session_visitors,
         coalesce(sum((extra->>'loggedInVisitors')::int), 0) AS logged_in,
         coalesce(sum(events), 0) AS clicks
       FROM analytics_daily WHERE kind = 'site' AND day >= $1 AND day <= $2`,
      [r.from, r.to],
    );
    return this.shapeKpis(k, true);
  }

  private shapeKpis(k: any, approxVisitors: boolean) {
    const views = n(k.views);
    const sessions = n(k.sessions);
    const dur = n(k.dur);
    return {
      views,
      visitors: n(k.visitors),
      visitorsApprox: approxVisitors,
      sessions,
      clicks: n(k.clicks),
      avgPageTimeMs: Math.round(ratio(dur, n(k.durn))),
      avgSessionTimeMs: Math.round(ratio(dur, sessions)),
      bounceRate: ratio(n(k.bounces), sessions),
      pagesPerSession: ratio(views, sessions),
      newVisitorRate: ratio(n(k.new_visitors), n(k.session_visitors)),
      loggedInRate: ratio(n(k.logged_in), n(k.session_visitors)),
      clicksPerView: ratio(n(k.clicks), views),
    };
  }

  async overview(from?: string, to?: string) {
    const r = this.range(from, to);
    const prev = this.prevRange(r);
    const [kpis, prevKpis] = await Promise.all([this.kpis(r), this.kpis(prev)]);

    let daily: {
      day: string;
      views: number;
      visitors: number;
      sessions: number;
    }[];
    let hours: { hour: number; views: number }[];
    let weekHour: number[][] | null = null;
    let topPages: any[];
    const dims: Record<string, any[]> = {};

    if (r.mode === 'raw') {
      const P = [r.F, r.T];
      const dv = await this.ds.query(
        `SELECT to_char((started_at AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') AS d, count(*) AS views, count(DISTINCT visitor_id) AS visitors
         FROM analytics_pageviews WHERE started_at >= $1 AND started_at < $2 GROUP BY 1`,
        P,
      );
      const ds = await this.ds.query(
        `SELECT to_char((started_at AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') AS d, count(*) AS sessions
         FROM analytics_sessions WHERE started_at >= $1 AND started_at < $2 GROUP BY 1`,
        P,
      );
      const vm = new Map<string, any>(dv.map((x: any) => [x.d, x]));
      const sm = new Map<string, any>(ds.map((x: any) => [x.d, x]));
      daily = [];
      for (let d = r.from; d <= r.to; d = addDays(d, 1)) {
        daily.push({
          day: d,
          views: n(vm.get(d)?.views),
          visitors: n(vm.get(d)?.visitors),
          sessions: n(sm.get(d)?.sessions),
        });
      }
      const wh = await this.ds.query(
        `SELECT extract(isodow FROM started_at AT TIME ZONE '${TZ}')::int AS dow, extract(hour FROM started_at AT TIME ZONE '${TZ}')::int AS h, count(*) AS views
         FROM analytics_pageviews WHERE started_at >= $1 AND started_at < $2 GROUP BY 1, 2`,
        P,
      );
      weekHour = Array.from({ length: 7 }, () => Array(24).fill(0));
      const hourSum = Array(24).fill(0);
      for (const x of wh) {
        weekHour[x.dow - 1][x.h] = n(x.views);
        hourSum[x.h] += n(x.views);
      }
      hours = hourSum.map((v, h) => ({ hour: h, views: v }));
      topPages = (
        await this.ds.query(
          `WITH pv AS (
             SELECT p.*, row_number() OVER (PARTITION BY session_id ORDER BY started_at DESC) AS rn_desc,
               row_number() OVER (PARTITION BY session_id ORDER BY started_at ASC) AS rn_asc
             FROM analytics_pageviews p WHERE started_at >= $1 AND started_at < $2)
           SELECT route, count(*) AS views, count(DISTINCT visitor_id) AS visitors,
             coalesce(avg(duration_ms) FILTER (WHERE duration_ms > 0), 0) AS avg_ms, coalesce(avg(max_scroll), 0) AS scroll,
             count(*) FILTER (WHERE rn_desc = 1) AS exits, count(*) FILTER (WHERE rn_asc = 1) AS entries
           FROM pv GROUP BY route ORDER BY views DESC LIMIT 40`,
          P,
        )
      ).map((x: any) => ({
        route: x.route,
        views: n(x.views),
        visitors: n(x.visitors),
        avgTimeMs: Math.round(n(x.avg_ms)),
        avgScroll: Math.round(n(x.scroll)),
        entries: n(x.entries),
        exits: n(x.exits),
        exitRate: ratio(n(x.exits), n(x.views)),
      }));
      const rows = await this.ds.query(
        `WITH pvs AS (
           SELECT session_id, count(*) AS pvn, coalesce(sum(duration_ms), 0) AS dur FROM analytics_pageviews
           WHERE started_at >= $1::timestamptz - interval '1 day' AND started_at < $2::timestamptz + interval '1 day' GROUP BY 1),
         conv AS (
           SELECT DISTINCT session_id FROM analytics_events WHERE type = 'apply_submit'
           AND created_at >= $1 AND created_at < $2::timestamptz + interval '1 day'),
         s AS (
           SELECT s.*, coalesce(pvs.pvn, 0) AS pvn, coalesce(pvs.dur, 0) AS dur, conv.session_id IS NOT NULL AS conv
           FROM analytics_sessions s LEFT JOIN pvs ON pvs.session_id = s.id LEFT JOIN conv ON conv.session_id = s.id
           WHERE s.started_at >= $1 AND s.started_at < $2)
         ${[
           ['source', 'source'],
           ['channel', 'channel'],
           ['device', 'device'],
           ['browser', `coalesce(browser, 'Khác')`],
           ['os', `coalesce(os, 'Khác')`],
           ['city', `coalesce(city, 'Không rõ')`],
           ['role', 'role'],
           ['campaign', `coalesce(utm_campaign, '')`],
         ]
           .map(
             ([dim, expr]) =>
               `SELECT '${dim}' AS dim, ${expr} AS k, sum(pvn) AS views, count(DISTINCT visitor_id) AS visitors, count(*) AS sessions,
                  sum(dur) AS dur, count(*) FILTER (WHERE pvn = 1) AS bounces, count(*) FILTER (WHERE conv) AS conversions
                FROM s GROUP BY 2`,
           )
           .join(' UNION ALL ')}`,
        P,
      );
      for (const x of rows) {
        if (x.k === '' || x.k === null) continue;
        (dims[x.dim] ??= []).push(this.shapeDim(x));
      }
    } else {
      await this.rollup.refreshToday();
      const D = [r.from, r.to];
      const site = await this.ds.query(
        `SELECT to_char(day, 'YYYY-MM-DD') AS d, views, visitors, sessions FROM analytics_daily WHERE kind = 'site' AND day >= $1 AND day <= $2`,
        D,
      );
      const sm = new Map<string, any>(site.map((x: any) => [x.d, x]));
      daily = [];
      for (let d = r.from; d <= r.to; d = addDays(d, 1)) {
        daily.push({
          day: d,
          views: n(sm.get(d)?.views),
          visitors: n(sm.get(d)?.visitors),
          sessions: n(sm.get(d)?.sessions),
        });
      }
      const hr = await this.ds.query(
        `SELECT key::int AS h, sum(views) AS views FROM analytics_daily WHERE kind = 'hour' AND day >= $1 AND day <= $2 GROUP BY 1`,
        D,
      );
      const hourSum = Array(24).fill(0);
      for (const x of hr) hourSum[x.h] = n(x.views);
      hours = hourSum.map((v, h) => ({ hour: h, views: v }));
      topPages = (
        await this.ds.query(
          `SELECT key AS route, sum(views) AS views, sum(visitors) AS visitors, sum(duration_ms) AS dur, sum(duration_n) AS durn,
             sum((extra->>'scrollSum')::bigint) AS scroll_sum, sum((extra->>'exits')::int) AS exits, sum((extra->>'entries')::int) AS entries
           FROM analytics_daily WHERE kind = 'route' AND day >= $1 AND day <= $2 GROUP BY 1 ORDER BY views DESC LIMIT 40`,
          D,
        )
      ).map((x: any) => ({
        route: x.route,
        views: n(x.views),
        visitors: n(x.visitors),
        avgTimeMs: Math.round(ratio(n(x.dur), n(x.durn))),
        avgScroll: Math.round(ratio(n(x.scroll_sum), n(x.views))),
        entries: n(x.entries),
        exits: n(x.exits),
        exitRate: ratio(n(x.exits), n(x.views)),
      }));
      const rows = await this.ds.query(
        `SELECT kind AS dim, key AS k, sum(views) AS views, sum(visitors) AS visitors, sum(sessions) AS sessions,
           sum(duration_ms) AS dur, sum(bounces) AS bounces, sum((extra->>'conversions')::int) AS conversions
         FROM analytics_daily WHERE kind IN ('source','channel','device','browser','os','city','role','campaign')
           AND day >= $1 AND day <= $2 GROUP BY 1, 2`,
        D,
      );
      for (const x of rows) (dims[x.dim] ??= []).push(this.shapeDim(x));
    }
    for (const k of Object.keys(dims))
      dims[k].sort((a, b) => b.sessions - a.sessions).splice(25);

    const bots = await this.ds.query(
      `SELECT bot, sum(hits) AS hits FROM analytics_bot_hits WHERE day >= $1 AND day <= $2 GROUP BY 1 ORDER BY 2 DESC`,
      [r.from, r.to],
    );

    return {
      range: {
        from: r.from,
        to: r.to,
        days: r.days,
        mode: r.mode,
        retentionStart: retentionStartDay(),
      },
      prevRange: { from: prev.from, to: prev.to },
      kpis,
      prevKpis,
      daily,
      hours,
      weekHour,
      topPages,
      dims,
      bots: bots.map((b: any) => ({ bot: b.bot, hits: n(b.hits) })),
    };
  }

  private shapeDim(x: any) {
    const sessions = n(x.sessions);
    return {
      key: x.k,
      sessions,
      visitors: n(x.visitors),
      views: n(x.views),
      avgSessionTimeMs: Math.round(ratio(n(x.dur), sessions)),
      bounceRate: ratio(n(x.bounces), sessions),
      conversions: n(x.conversions),
      conversionRate: ratio(n(x.conversions), sessions),
    };
  }

  // ------------------------------------------------------------------ Tin & công ty
  async content(from?: string, to?: string) {
    const r = this.range(from, to);
    const P = [r.F, r.T];
    let jobs: any[];
    let companies: any[];
    let searches: any[];
    let cvSearches: any[];
    let events: any[];
    const funnel: Record<string, number> = {};

    if (r.mode === 'raw') {
      jobs = await this.ds.query(
        `WITH v AS (
           SELECT entity_id AS k, count(*) AS views, count(DISTINCT visitor_id) AS visitors,
             coalesce(avg(duration_ms) FILTER (WHERE duration_ms > 0), 0) AS avg_ms, coalesce(avg(max_scroll), 0) AS scroll
           FROM analytics_pageviews WHERE entity_type = 'job' AND started_at >= $1 AND started_at < $2 GROUP BY 1),
         e AS (
           SELECT entity_id AS k, count(*) FILTER (WHERE type = 'apply_click') AS ac,
             count(DISTINCT visitor_id) FILTER (WHERE type = 'apply_click') AS acv,
             count(*) FILTER (WHERE type = 'save_job') AS sv, count(*) FILTER (WHERE type LIKE 'contact_%') AS ct
           FROM analytics_events WHERE entity_type = 'job' AND type <> 'click' AND created_at >= $1 AND created_at < $2 GROUP BY 1)
         SELECT v.k AS id, v.views, v.visitors, v.avg_ms, v.scroll, coalesce(e.ac, 0) AS ac, coalesce(e.acv, 0) AS acv,
           coalesce(e.sv, 0) AS sv, coalesce(e.ct, 0) AS ct
         FROM v LEFT JOIN e ON e.k = v.k ORDER BY v.views DESC LIMIT 60`,
        P,
      );
      companies = await this.ds.query(
        `WITH c AS (
           SELECT entity_id AS k, count(*) AS views, count(DISTINCT visitor_id) AS visitors,
             coalesce(avg(duration_ms) FILTER (WHERE duration_ms > 0), 0) AS avg_ms
           FROM analytics_pageviews WHERE entity_type = 'company' AND started_at >= $1 AND started_at < $2 GROUP BY 1),
         j AS (
           SELECT jp.company_id AS k, count(*) AS jv, count(DISTINCT p.visitor_id) AS jvis
           FROM analytics_pageviews p JOIN job_postings jp ON jp.id = p.entity_id
           WHERE p.entity_type = 'job' AND p.started_at >= $1 AND p.started_at < $2 GROUP BY 1)
         SELECT coalesce(c.k, j.k) AS id, coalesce(c.views, 0) AS views, coalesce(c.visitors, 0) AS visitors,
           coalesce(c.avg_ms, 0) AS avg_ms, coalesce(j.jv, 0) AS jv, coalesce(j.jvis, 0) AS jvis
         FROM c FULL JOIN j ON j.k = c.k ORDER BY coalesce(c.views, 0) + coalesce(j.jv, 0) DESC LIMIT 40`,
        P,
      );
      const kw = (type: string) =>
        this.ds.query(
          `SELECT lower(btrim(meta->>'q')) AS q, count(*) AS n, count(DISTINCT visitor_id) AS visitors,
             count(*) FILTER (WHERE (meta->>'total') = '0') AS zero
           FROM analytics_events WHERE type = $3 AND created_at >= $1 AND created_at < $2 AND coalesce(btrim(meta->>'q'), '') <> ''
           GROUP BY 1 ORDER BY n DESC LIMIT 200`,
          [r.F, r.T, type],
        );
      searches = await kw('search');
      cvSearches = await kw('cv_search');
      events = await this.ds.query(
        `SELECT type, count(*) AS n, count(DISTINCT visitor_id) AS visitors FROM analytics_events
         WHERE created_at >= $1 AND created_at < $2 GROUP BY type ORDER BY n DESC`,
        P,
      );
      const [f] = await this.ds.query(
        `SELECT
           (SELECT count(*) FROM analytics_pageviews WHERE entity_type = 'job' AND started_at >= $1 AND started_at < $2) AS job_views,
           (SELECT count(DISTINCT visitor_id) FROM analytics_pageviews WHERE entity_type = 'job' AND started_at >= $1 AND started_at < $2) AS job_visitors,
           (SELECT count(*) FROM analytics_events WHERE type = 'apply_click' AND created_at >= $1 AND created_at < $2) AS apply_clicks,
           (SELECT count(DISTINCT visitor_id) FROM analytics_events WHERE type = 'apply_click' AND created_at >= $1 AND created_at < $2) AS apply_visitors,
           (SELECT count(*) FROM analytics_events WHERE type = 'apply_submit' AND created_at >= $1 AND created_at < $2) AS apply_submits,
           (SELECT count(*) FROM analytics_events WHERE type = 'search' AND created_at >= $1 AND created_at < $2) AS searches,
           (SELECT count(DISTINCT visitor_id) FROM analytics_pageviews WHERE started_at >= $1 AND started_at < $2) AS site_visitors`,
        P,
      );
      Object.assign(funnel, {
        siteVisitors: n(f.site_visitors),
        searches: n(f.searches),
        jobViews: n(f.job_views),
        jobVisitors: n(f.job_visitors),
        applyClicks: n(f.apply_clicks),
        applyClickVisitors: n(f.apply_visitors),
        applySubmitsTracked: n(f.apply_submits),
      });
    } else {
      await this.rollup.refreshToday();
      const D = [r.from, r.to];
      jobs = await this.ds.query(
        `SELECT key::uuid AS id, sum(views) AS views, sum(visitors) AS visitors,
           CASE WHEN sum(duration_n) > 0 THEN sum(duration_ms) / sum(duration_n) ELSE 0 END AS avg_ms, 0 AS scroll,
           sum(events) AS ac, sum(events) AS acv, sum((extra->>'saves')::int) AS sv, sum((extra->>'contacts')::int) AS ct
         FROM analytics_daily WHERE kind = 'job' AND day >= $1 AND day <= $2 GROUP BY 1 ORDER BY views DESC LIMIT 60`,
        D,
      );
      companies = await this.ds.query(
        `SELECT key::uuid AS id, sum(views) AS views, sum(visitors) AS visitors,
           CASE WHEN sum(duration_n) > 0 THEN sum(duration_ms) / sum(duration_n) ELSE 0 END AS avg_ms,
           sum((extra->>'jobViews')::int) AS jv, sum((extra->>'jobVisitors')::int) AS jvis
         FROM analytics_daily WHERE kind = 'company' AND day >= $1 AND day <= $2 GROUP BY 1
         ORDER BY sum(views) + sum((extra->>'jobViews')::int) DESC LIMIT 40`,
        D,
      );
      const kw = (kind: string) =>
        this.ds.query(
          `SELECT key AS q, sum(events) AS n, sum(visitors) AS visitors, sum((extra->>'zero')::int) AS zero
           FROM analytics_daily WHERE kind = $3 AND day >= $1 AND day <= $2 GROUP BY 1 ORDER BY n DESC LIMIT 200`,
          [r.from, r.to, kind],
        );
      searches = await kw('search');
      cvSearches = await kw('cv_search');
      events = await this.ds.query(
        `SELECT key AS type, sum(events) AS n, sum(visitors) AS visitors FROM analytics_daily
         WHERE kind = 'event' AND day >= $1 AND day <= $2 GROUP BY 1 ORDER BY n DESC`,
        D,
      );
      const [site] = await this.ds.query(
        `SELECT coalesce(sum(visitors), 0) AS v, coalesce(sum(events), 0) AS clicks FROM analytics_daily WHERE kind = 'site' AND day >= $1 AND day <= $2`,
        D,
      );
      const [jv] = await this.ds.query(
        `SELECT coalesce(sum(views), 0) AS views, coalesce(sum(visitors), 0) AS visitors,
           coalesce(sum(events), 0) AS ac, coalesce(sum((extra->>'applySubmits')::int), 0) AS asub
         FROM analytics_daily WHERE kind = 'job' AND day >= $1 AND day <= $2`,
        D,
      );
      const ev = new Map<string, any>(events.map((e: any) => [e.type, e]));
      Object.assign(funnel, {
        siteVisitors: n(site.v),
        searches: n(ev.get('search')?.n),
        jobViews: n(jv.views),
        jobVisitors: n(jv.visitors),
        applyClicks: n(ev.get('apply_click')?.n ?? jv.ac),
        applyClickVisitors: n(ev.get('apply_click')?.visitors),
        applySubmitsTracked: n(ev.get('apply_submit')?.n ?? jv.asub),
      });
    }

    // Số đơn ứng tuyển THẬT trong CSDL (không phụ thuộc bộ ghi truy cập) — trong khoảng ngày.
    const [apps] = await this.ds.query(
      `SELECT count(*) AS n FROM applications WHERE applied_at >= $1 AND applied_at < $2`,
      P,
    );
    funnel.applicationsDb = n(apps.n);

    const jobIds = jobs.map((j) => j.id);
    const jobInfo = jobIds.length
      ? await this.ds.query(
          `SELECT jp.id, jp.title, jp.industry, jp.approval_status AS status, c.id AS company_id, c.name AS company_name,
             (SELECT count(*) FROM applications a WHERE a.job_posting_id = jp.id AND a.applied_at >= $2 AND a.applied_at < $3) AS apps
           FROM job_postings jp LEFT JOIN companies c ON c.id = jp.company_id WHERE jp.id = ANY($1::uuid[])`,
          [jobIds, r.F, r.T],
        )
      : [];
    const jm = new Map<string, any>(jobInfo.map((j: any) => [j.id, j]));
    const jobRows = jobs.map((j) => {
      const info = jm.get(j.id);
      const views = n(j.views);
      const applications = n(info?.apps);
      return {
        id: j.id,
        title: info?.title ?? '(Tin đã xoá)',
        status: info?.status ?? null,
        industry: info?.industry ?? null,
        companyId: info?.company_id ?? null,
        companyName: info?.company_name ?? null,
        views,
        visitors: n(j.visitors),
        avgTimeMs: Math.round(n(j.avg_ms)),
        avgScroll: Math.round(n(j.scroll)),
        applyClicks: n(j.ac),
        applyClickVisitors: n(j.acv),
        applications,
        saves: n(j.sv),
        contacts: n(j.ct),
        clickRate: ratio(n(j.acv), n(j.visitors)),
        conversionRate: ratio(applications, n(j.visitors)),
      };
    });

    const industryMap = new Map<
      string,
      { views: number; visitors: number; applications: number; jobs: number }
    >();
    for (const j of jobRows) {
      const key = j.industry || 'Chưa phân ngành';
      const cur = industryMap.get(key) ?? {
        views: 0,
        visitors: 0,
        applications: 0,
        jobs: 0,
      };
      cur.views += j.views;
      cur.visitors += j.visitors;
      cur.applications += j.applications;
      cur.jobs += 1;
      industryMap.set(key, cur);
    }

    const companyIds = companies.map((c) => c.id);
    const companyInfo = companyIds.length
      ? await this.ds.query(
          `SELECT c.id, c.name,
             (SELECT count(*) FROM company_follows f WHERE f.company_id = c.id AND f.created_at >= $2 AND f.created_at < $3) AS follows,
             (SELECT count(*) FROM applications a JOIN job_postings jp ON jp.id = a.job_posting_id
               WHERE jp.company_id = c.id AND a.applied_at >= $2 AND a.applied_at < $3) AS apps
           FROM companies c WHERE c.id = ANY($1::uuid[])`,
          [companyIds, r.F, r.T],
        )
      : [];
    const cm = new Map<string, any>(companyInfo.map((c: any) => [c.id, c]));

    return {
      range: {
        from: r.from,
        to: r.to,
        days: r.days,
        mode: r.mode,
        retentionStart: retentionStartDay(),
      },
      funnel,
      jobs: jobRows,
      industries: [...industryMap.entries()]
        .map(([industry, v]) => ({ industry, ...v }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 20),
      companies: companies.map((c) => ({
        id: c.id,
        name: cm.get(c.id)?.name ?? '(Công ty đã xoá)',
        pageViews: n(c.views),
        pageVisitors: n(c.visitors),
        avgTimeMs: Math.round(n(c.avg_ms)),
        jobViews: n(c.jv),
        jobVisitors: n(c.jvis),
        follows: n(cm.get(c.id)?.follows),
        applications: n(cm.get(c.id)?.apps),
      })),
      searches: searches.slice(0, 40).map((s: any) => ({
        q: s.q,
        count: n(s.n),
        visitors: n(s.visitors),
        zero: n(s.zero),
      })),
      zeroSearches: searches
        .filter((s: any) => n(s.zero) > 0)
        .sort((a: any, b: any) => n(b.zero) - n(a.zero))
        .slice(0, 30)
        .map((s: any) => ({ q: s.q, count: n(s.n), zero: n(s.zero) })),
      cvSearches: cvSearches.slice(0, 30).map((s: any) => ({
        q: s.q,
        count: n(s.n),
        visitors: n(s.visitors),
        zero: n(s.zero),
      })),
      events: events.map((e: any) => ({
        type: e.type,
        count: n(e.n),
        visitors: n(e.visitors),
      })),
    };
  }

  // ------------------------------------------------------------------ Hành vi (chỉ trong 90 ngày)
  async behavior(from?: string, to?: string) {
    let r = this.range(from, to);
    let clamped = false;
    if (r.mode === 'daily') {
      r = this.clampRaw(r);
      clamped = true;
    }
    const P = [r.F, r.T];

    const dr = await this.ds.query(
      `SELECT to_char((started_at AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') AS d, role, count(DISTINCT visitor_id) AS v
       FROM analytics_sessions WHERE started_at >= $1 AND started_at < $2 GROUP BY 1, 2`,
      P,
    );
    const dmap = new Map<string, Record<string, number>>();
    for (const x of dr) {
      const cur = dmap.get(x.d) ?? {};
      cur[x.role] = n(x.v);
      dmap.set(x.d, cur);
    }
    const dailyRoles: any[] = [];
    for (let d = r.from; d <= r.to; d = addDays(d, 1)) {
      const c = dmap.get(d) ?? {};
      dailyRoles.push({
        day: d,
        candidate: c.candidate ?? 0,
        employer: c.employer ?? 0,
        guest: c.guest ?? 0,
      });
    }

    const [ret] = await this.ds.query(
      `WITH s AS (SELECT * FROM analytics_sessions WHERE started_at >= $1 AND started_at < $2),
            pv AS (SELECT visitor_id FROM analytics_pageviews WHERE started_at >= $1 AND started_at < $2)
       SELECT count(DISTINCT visitor_id) AS visitors,
         count(DISTINCT visitor_id) FILTER (WHERE NOT is_new_visitor) AS returning,
         (SELECT count(*) FROM (SELECT visitor_id FROM s GROUP BY 1 HAVING count(*) >= 2) z) AS multi
       FROM s`,
      P,
    );

    const freq = await this.ds.query(
      `SELECT CASE WHEN c = 1 THEN '1' WHEN c = 2 THEN '2' WHEN c <= 5 THEN '3-5' WHEN c <= 10 THEN '6-10' ELSE '11+' END AS b, count(*) AS n
       FROM (SELECT visitor_id, count(*) AS c FROM analytics_sessions WHERE started_at >= $1 AND started_at < $2 GROUP BY 1) z GROUP BY 1`,
      P,
    );
    const depth = await this.ds.query(
      `SELECT CASE WHEN c = 1 THEN '1' WHEN c = 2 THEN '2' WHEN c <= 4 THEN '3-4' WHEN c <= 9 THEN '5-9' ELSE '10+' END AS b, count(*) AS n
       FROM (SELECT s.id, count(p.id) AS c FROM analytics_sessions s JOIN analytics_pageviews p ON p.session_id = s.id
             WHERE s.started_at >= $1 AND s.started_at < $2 GROUP BY 1) z GROUP BY 1`,
      P,
    );
    const length = await this.ds.query(
      `SELECT CASE WHEN d < 10000 THEN '<10 giây' WHEN d < 30000 THEN '10-30 giây' WHEN d < 60000 THEN '30-60 giây'
                   WHEN d < 180000 THEN '1-3 phút' WHEN d < 600000 THEN '3-10 phút' ELSE '>10 phút' END AS b, count(*) AS n
       FROM (SELECT s.id, coalesce(sum(p.duration_ms), 0) AS d FROM analytics_sessions s JOIN analytics_pageviews p ON p.session_id = s.id
             WHERE s.started_at >= $1 AND s.started_at < $2 GROUP BY 1) z GROUP BY 1`,
      P,
    );
    const paths = await this.ds.query(
      `SELECT prev_route AS "from", route AS "to", count(*) AS n FROM analytics_pageviews
       WHERE started_at >= $1 AND started_at < $2 AND prev_route IS NOT NULL AND prev_route <> route
       GROUP BY 1, 2 ORDER BY n DESC LIMIT 30`,
      P,
    );
    const ends = await this.ds.query(
      `WITH pv AS (
         SELECT route, row_number() OVER (PARTITION BY session_id ORDER BY started_at ASC) AS a,
           row_number() OVER (PARTITION BY session_id ORDER BY started_at DESC) AS z
         FROM analytics_pageviews WHERE started_at >= $1 AND started_at < $2)
       SELECT route, count(*) FILTER (WHERE a = 1) AS entries, count(*) FILTER (WHERE z = 1) AS exits, count(*) AS views
       FROM pv GROUP BY route`,
      P,
    );
    const roleRoutes = await this.ds.query(
      `SELECT role, route, count(*) AS views, count(DISTINCT visitor_id) AS visitors
       FROM analytics_pageviews WHERE started_at >= $1 AND started_at < $2 AND role IN ('employer', 'candidate')
       GROUP BY 1, 2 ORDER BY views DESC`,
      P,
    );
    const [act] = await this.ds.query(
      `SELECT count(DISTINCT user_id) FILTER (WHERE role = 'employer') AS employers,
         count(DISTINCT user_id) FILTER (WHERE role = 'candidate') AS candidates,
         count(*) FILTER (WHERE user_id IS NOT NULL) AS logged_sessions, count(*) AS sessions
       FROM analytics_sessions WHERE started_at >= $1 AND started_at < $2`,
      P,
    );
    // Số liệu nghiệp vụ THẬT từ CSDL trong cùng khoảng ngày.
    const [biz] = await this.ds.query(
      `SELECT
         (SELECT count(*) FROM users WHERE created_at >= $1 AND created_at < $2 AND role = 'candidate') AS new_candidates,
         (SELECT count(*) FROM users WHERE created_at >= $1 AND created_at < $2 AND role IN ('employer_main', 'employer_sub')) AS new_employers,
         (SELECT count(*) FROM applications WHERE applied_at >= $1 AND applied_at < $2) AS applications,
         (SELECT count(DISTINCT c.candidate_profile_id) FROM applications a JOIN cvs c ON c.id = a.cv_id WHERE a.applied_at >= $1 AND a.applied_at < $2) AS applicants,
         (SELECT count(*) FROM unlocked_profiles WHERE unlocked_at >= $1 AND unlocked_at < $2) AS cv_unlocks,
         (SELECT count(*) FROM job_postings WHERE created_at >= $1 AND created_at < $2) AS jobs_posted`,
      P,
    );
    const [evs] = await this.ds.query(
      `SELECT count(*) FILTER (WHERE type = 'cv_search') AS cv_searches, count(*) FILTER (WHERE type = 'cv_unlock') AS cv_unlock_clicks,
         count(*) FILTER (WHERE type = 'search') AS searches, count(*) FILTER (WHERE type = 'save_job') AS saves,
         count(*) FILTER (WHERE type LIKE 'contact_%') AS contacts, count(*) FILTER (WHERE type = 'follow_company') AS follows
       FROM analytics_events WHERE created_at >= $1 AND created_at < $2 AND type <> 'click'`,
      P,
    );
    const topUsers = await this.ds.query(
      `SELECT p.user_id AS "userId", u.email, p.role, count(*) AS views, count(DISTINCT p.session_id) AS sessions,
         coalesce(sum(p.duration_ms), 0) AS dur, max(p.started_at) AS "lastSeen"
       FROM analytics_pageviews p JOIN users u ON u.id = p.user_id
       WHERE p.started_at >= $1 AND p.started_at < $2 AND p.user_id IS NOT NULL
       GROUP BY 1, 2, 3 ORDER BY views DESC LIMIT 20`,
      P,
    );

    const order = (rows: any[], keys: string[]) =>
      keys.map((k) => ({
        bucket: k,
        count: n(rows.find((x) => x.b === k)?.n),
      }));
    const visitors = n(ret.visitors);
    return {
      range: {
        from: r.from,
        to: r.to,
        days: r.days,
        mode: 'raw',
        clamped,
        retentionStart: retentionStartDay(),
      },
      dailyRoles,
      returning: {
        visitors,
        returningVisitors: n(ret.returning),
        returningRate: ratio(n(ret.returning), visitors),
        multiSessionVisitors: n(ret.multi),
      },
      frequency: order(freq, ['1', '2', '3-5', '6-10', '11+']),
      depth: order(depth, ['1', '2', '3-4', '5-9', '10+']),
      sessionLength: order(length, [
        '<10 giây',
        '10-30 giây',
        '30-60 giây',
        '1-3 phút',
        '3-10 phút',
        '>10 phút',
      ]),
      paths: paths.map((p: any) => ({ from: p.from, to: p.to, count: n(p.n) })),
      entryPages: ends
        .map((e: any) => ({
          route: e.route,
          count: n(e.entries),
          views: n(e.views),
        }))
        .filter((e: any) => e.count > 0)
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 15),
      exitPages: ends
        .map((e: any) => ({
          route: e.route,
          count: n(e.exits),
          views: n(e.views),
          exitRate: ratio(n(e.exits), n(e.views)),
        }))
        .filter((e: any) => e.count > 0)
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 15),
      employer: {
        active: n(act.employers),
        routes: roleRoutes
          .filter((x: any) => x.role === 'employer')
          .slice(0, 15)
          .map((x: any) => ({
            route: x.route,
            views: n(x.views),
            visitors: n(x.visitors),
          })),
        cvSearches: n(evs.cv_searches),
        cvUnlocks: n(biz.cv_unlocks),
        jobsPosted: n(biz.jobs_posted),
      },
      candidate: {
        active: n(act.candidates),
        routes: roleRoutes
          .filter((x: any) => x.role === 'candidate')
          .slice(0, 15)
          .map((x: any) => ({
            route: x.route,
            views: n(x.views),
            visitors: n(x.visitors),
          })),
        applications: n(biz.applications),
        applicants: n(biz.applicants),
        searches: n(evs.searches),
        saves: n(evs.saves),
        follows: n(evs.follows),
        contacts: n(evs.contacts),
      },
      registrations: {
        candidates: n(biz.new_candidates),
        employers: n(biz.new_employers),
      },
      loggedInSessionRate: ratio(n(act.logged_sessions), n(act.sessions)),
      topUsers: topUsers.map((u: any) => ({
        userId: u.userId,
        email: u.email,
        role: u.role,
        views: n(u.views),
        sessions: n(u.sessions),
        totalTimeMs: n(u.dur),
        lastSeen: u.lastSeen,
      })),
    };
  }

  // ------------------------------------------------------------------ Bản đồ nhiệt (chỉ trong 90 ngày)
  async heatmapPages(from?: string, to?: string) {
    const r = this.clampRaw(this.range(from, to));
    const rows = await this.ds.query(
      `SELECT route, device, count(*) AS clicks FROM analytics_events
       WHERE type = 'click' AND created_at >= $1 AND created_at < $2 GROUP BY 1, 2 ORDER BY clicks DESC LIMIT 60`,
      [r.F, r.T],
    );
    return {
      range: { from: r.from, to: r.to },
      pages: rows.map((x: any) => ({
        route: x.route,
        device: x.device,
        clicks: n(x.clicks),
      })),
    };
  }

  async heatmap(
    route: string,
    device: string,
    from?: string,
    to?: string,
    path?: string,
  ) {
    if (!route) throw new BadRequestException('Thiếu trang cần xem');
    const dev = device === 'mobile' ? 'mobile' : 'desktop';
    const r = this.clampRaw(this.range(from, to));
    const params: unknown[] = [r.F, r.T, route, dev];
    let pathFilter = '';
    if (path) {
      params.push(path);
      pathFilter = ` AND path = $5`;
    }
    const where = `type = 'click' AND created_at >= $1 AND created_at < $2 AND route = $3 AND device = $4${pathFilter}`;
    const points = await this.ds.query(
      `SELECT round(x * 100)::int AS bx, (y / 16) * 16 AS by, count(*) AS n
       FROM analytics_events WHERE ${where} AND x IS NOT NULL AND y IS NOT NULL GROUP BY 1, 2 ORDER BY n DESC LIMIT 6000`,
      params,
    );
    const [meta] = await this.ds.query(
      `SELECT count(*) AS clicks, count(DISTINCT visitor_id) AS visitors,
         coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY doc_h), 0) AS doc_h
       FROM analytics_events WHERE ${where}`,
      params,
    );
    const elements = await this.ds.query(
      `SELECT label, count(*) AS n, count(DISTINCT visitor_id) AS visitors FROM analytics_events
       WHERE ${where} AND label IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 25`,
      params,
    );
    const pvDevice =
      dev === 'mobile'
        ? `device IN ('mobile', 'tablet')`
        : `device = 'desktop'`;
    const pvParams: unknown[] = [r.F, r.T, route];
    let pvPath = '';
    if (path) {
      pvParams.push(path);
      pvPath = ` AND path = $4`;
    }
    const [scroll] = await this.ds.query(
      `SELECT count(*) AS views, coalesce(avg(duration_ms) FILTER (WHERE duration_ms > 0), 0) AS avg_ms,
         ${[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((t) => `count(*) FILTER (WHERE max_scroll >= ${t}) AS s${t}`).join(', ')}
       FROM analytics_pageviews WHERE started_at >= $1 AND started_at < $2 AND route = $3 AND ${pvDevice}${pvPath}`,
      pvParams,
    );
    const samples = await this.ds.query(
      `SELECT path, count(*) AS n FROM analytics_pageviews WHERE started_at >= $1 AND started_at < $2 AND route = $3
       GROUP BY 1 ORDER BY n DESC LIMIT 10`,
      [r.F, r.T, route],
    );
    const views = n(scroll.views);
    return {
      range: { from: r.from, to: r.to },
      route,
      device: dev,
      path: path ?? null,
      clicks: n(meta.clicks),
      visitors: n(meta.visitors),
      docHeight: Math.round(n(meta.doc_h)),
      points: points.map((p: any) => ({
        x: n(p.bx) / 100,
        y: n(p.by),
        n: n(p.n),
      })),
      elements: elements.map((e: any) => ({
        label: e.label,
        count: n(e.n),
        visitors: n(e.visitors),
      })),
      pageviews: views,
      avgTimeMs: Math.round(n(scroll.avg_ms)),
      scrollReach: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((t) => ({
        depth: t,
        rate: ratio(n(scroll[`s${t}`]), views),
      })),
      samplePaths: samples.map((s: any) => ({ path: s.path, views: n(s.n) })),
    };
  }

  private clampRaw(r: Range): Range {
    if (r.mode === 'raw') return r;
    const start = retentionStartDay();
    return this.range(start, r.to < start ? start : r.to);
  }
}
