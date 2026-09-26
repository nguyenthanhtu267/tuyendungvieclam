import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Đợt 19 (26/09/2026) — cộng dồn số liệu truy cập theo NGÀY (giờ Việt Nam) vào analytics_daily (giữ
// vĩnh viễn) rồi xoá dữ liệu chi tiết cũ hơn 90 ngày (theo lựa chọn người dùng: "Chi tiết 90 ngày, số
// tổng hợp vĩnh viễn").
//
// Chạy bằng vòng hẹn giờ trong server (30 phút/lần, cùng cách với "Tự động duyệt tin" — không thêm thư
// viện cron). Render gói miễn phí có thể "ngủ": mỗi lần thức dậy sẽ tự cộng dồn bù mọi ngày còn thiếu
// TRƯỚC khi xoá dữ liệu chi tiết, nên không bao giờ mất số tổng hợp. Cộng dồn 1 ngày là idempotent
// (xoá rồi tính lại từ dữ liệu chi tiết) — hôm nay và hôm qua luôn được tính lại để cập nhật dữ liệu
// đến muộn (VD thời gian ở lại được gửi bổ sung sau nửa đêm).

export const RETENTION_DAYS = 90;
const TZ = 'Asia/Ho_Chi_Minh';

export function vnToday(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function vnDayStart(day: string): Date {
  return new Date(`${day}T00:00:00+07:00`);
}
// Ngày sớm nhất còn dữ liệu chi tiết.
export function retentionStartDay(): string {
  return addDays(vnToday(), -(RETENTION_DAYS - 1));
}

@Injectable()
export class AnalyticsRollupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsRollupService.name);
  private timer?: NodeJS.Timeout;
  private startTimer?: NodeJS.Timeout;
  private running = false;
  private lastTodayRollup = 0;

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.startTimer = setTimeout(() => this.catchUp().catch(() => {}), 20_000);
    this.timer = setInterval(() => this.catchUp().catch(() => {}), 30 * 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.startTimer) clearTimeout(this.startTimer);
  }

  // Gọi trước khi đọc báo cáo dài hạn: tính lại số của hôm nay nếu đã cũ hơn 5 phút.
  async refreshToday() {
    if (Date.now() - this.lastTodayRollup < 5 * 60_000) return;
    this.lastTodayRollup = Date.now();
    await this.rollupDay(vnToday());
  }

  async catchUp() {
    if (this.running) return;
    this.running = true;
    try {
      const today = vnToday();
      const [{ last }] = await this.ds.query(
        `SELECT to_char(max(day), 'YYYY-MM-DD') AS last FROM analytics_daily WHERE kind = 'site'`,
      );
      const [{ oldest }] = await this.ds.query(
        `SELECT to_char((min(started_at) AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') AS oldest FROM analytics_sessions`,
      );
      // Bắt đầu từ ngày sau ngày đã cộng dồn gần nhất (hoặc ngày cũ nhất còn dữ liệu chi tiết); luôn
      // tính lại hôm qua + hôm nay.
      let start = last ? addDays(last, 1) : (oldest ?? today);
      if (oldest && oldest > start) start = oldest;
      const yesterday = addDays(today, -1);
      if (start > yesterday) start = yesterday;
      let guard = 0;
      for (
        let d = start;
        d <= today && guard < 800;
        d = addDays(d, 1), guard++
      ) {
        await this.rollupDay(d);
      }
      this.lastTodayRollup = Date.now();
      await this.purge();
    } catch (err) {
      this.logger.warn(
        `Cộng dồn số liệu truy cập lỗi: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      this.running = false;
    }
  }

  async purge() {
    const cutoff = vnDayStart(retentionStartDay());
    await this.ds.query(`DELETE FROM analytics_events WHERE created_at < $1`, [
      cutoff,
    ]);
    await this.ds.query(
      `DELETE FROM analytics_pageviews WHERE started_at < $1`,
      [cutoff],
    );
    await this.ds.query(
      `DELETE FROM analytics_sessions WHERE started_at < $1`,
      [cutoff],
    );
  }

  // Xếp hàng tuần tự — tránh 2 lần cộng dồn cùng 1 ngày chạy chồng nhau (VD vòng hẹn giờ + Admin mở báo cáo).
  private chain: Promise<unknown> = Promise.resolve();
  rollupDay(day: string): Promise<void> {
    const p = this.chain.then(() => this.doRollupDay(day));
    this.chain = p.catch(() => undefined);
    return p;
  }

  private async doRollupDay(day: string) {
    const from = vnDayStart(day);
    const to = vnDayStart(addDays(day, 1));
    const P = [from, to, day];
    const INS = `INSERT INTO analytics_daily (day, kind, key, views, visitors, sessions, duration_ms, duration_n, bounces, events, extra)`;

    await this.ds.transaction(async (m) => {
      await m.query(`DELETE FROM analytics_daily WHERE day = $1`, [day]);

      // Toàn trang.
      await m.query(
        `${INS}
         SELECT $3::date, 'site', '',
           (SELECT count(*) FROM analytics_pageviews WHERE started_at >= $1 AND started_at < $2),
           (SELECT count(DISTINCT visitor_id) FROM analytics_pageviews WHERE started_at >= $1 AND started_at < $2),
           (SELECT count(*) FROM analytics_sessions WHERE started_at >= $1 AND started_at < $2),
           (SELECT coalesce(sum(duration_ms), 0) FROM analytics_pageviews WHERE started_at >= $1 AND started_at < $2),
           (SELECT count(*) FROM analytics_pageviews WHERE started_at >= $1 AND started_at < $2 AND duration_ms > 0),
           (SELECT count(*) FROM (SELECT s.id FROM analytics_sessions s JOIN analytics_pageviews p ON p.session_id = s.id
              WHERE s.started_at >= $1 AND s.started_at < $2 GROUP BY s.id HAVING count(*) = 1) z),
           (SELECT count(*) FROM analytics_events WHERE created_at >= $1 AND created_at < $2 AND type = 'click'),
           jsonb_build_object(
             'newVisitors', (SELECT count(DISTINCT visitor_id) FROM analytics_sessions WHERE started_at >= $1 AND started_at < $2 AND is_new_visitor),
             'sessionVisitors', (SELECT count(DISTINCT visitor_id) FROM analytics_sessions WHERE started_at >= $1 AND started_at < $2),
             'loggedInVisitors', (SELECT count(DISTINCT visitor_id) FROM analytics_sessions WHERE started_at >= $1 AND started_at < $2 AND user_id IS NOT NULL)
           )`,
        P,
      );

      // Theo mẫu trang.
      await m.query(
        `WITH pv AS (
           SELECT p.*,
             row_number() OVER (PARTITION BY session_id ORDER BY started_at DESC) AS rn_desc,
             row_number() OVER (PARTITION BY session_id ORDER BY started_at ASC) AS rn_asc
           FROM analytics_pageviews p WHERE started_at >= $1 AND started_at < $2)
         ${INS}
         SELECT $3::date, 'route', route, count(*), count(DISTINCT visitor_id), 0,
           coalesce(sum(duration_ms), 0), count(*) FILTER (WHERE duration_ms > 0), 0, 0,
           jsonb_build_object('exits', count(*) FILTER (WHERE rn_desc = 1), 'entries', count(*) FILTER (WHERE rn_asc = 1),
                              'scrollSum', coalesce(sum(max_scroll), 0))
         FROM pv GROUP BY route`,
        P,
      );

      // Theo giờ trong ngày.
      await m.query(
        `${INS}
         SELECT $3::date, 'hour', extract(hour FROM started_at AT TIME ZONE '${TZ}')::int::text, count(*), count(DISTINCT visitor_id),
           0, 0, 0, 0, 0, NULL
         FROM analytics_pageviews WHERE started_at >= $1 AND started_at < $2 GROUP BY 3`,
        P,
      );

      // Theo tin tuyển dụng.
      await m.query(
        `WITH v AS (
           SELECT entity_id::text AS k, count(*) AS views, count(DISTINCT visitor_id) AS visitors,
             coalesce(sum(duration_ms), 0) AS d, count(*) FILTER (WHERE duration_ms > 0) AS dn
           FROM analytics_pageviews WHERE entity_type = 'job' AND started_at >= $1 AND started_at < $2 GROUP BY 1),
         e AS (
           SELECT entity_id::text AS k,
             count(*) FILTER (WHERE type = 'apply_click') AS ac,
             count(*) FILTER (WHERE type = 'apply_submit') AS asub,
             count(*) FILTER (WHERE type = 'save_job') AS sv,
             count(*) FILTER (WHERE type LIKE 'contact_%') AS ct
           FROM analytics_events WHERE entity_type = 'job' AND type <> 'click' AND created_at >= $1 AND created_at < $2 GROUP BY 1)
         ${INS}
         SELECT $3::date, 'job', coalesce(v.k, e.k), coalesce(v.views, 0), coalesce(v.visitors, 0), 0,
           coalesce(v.d, 0), coalesce(v.dn, 0), 0, coalesce(e.ac, 0),
           jsonb_build_object('applySubmits', coalesce(e.asub, 0), 'saves', coalesce(e.sv, 0), 'contacts', coalesce(e.ct, 0))
         FROM v FULL JOIN e ON e.k = v.k WHERE coalesce(v.k, e.k) IS NOT NULL`,
        P,
      );

      // Theo công ty (lượt xem trang công ty + lượt xem các tin của công ty).
      await m.query(
        `WITH c AS (
           SELECT entity_id::text AS k, count(*) AS views, count(DISTINCT visitor_id) AS visitors,
             coalesce(sum(duration_ms), 0) AS d, count(*) FILTER (WHERE duration_ms > 0) AS dn
           FROM analytics_pageviews WHERE entity_type = 'company' AND started_at >= $1 AND started_at < $2 GROUP BY 1),
         j AS (
           SELECT jp.company_id::text AS k, count(*) AS jv, count(DISTINCT p.visitor_id) AS jvis
           FROM analytics_pageviews p JOIN job_postings jp ON jp.id = p.entity_id
           WHERE p.entity_type = 'job' AND p.started_at >= $1 AND p.started_at < $2 GROUP BY 1),
         f AS (
           SELECT entity_id::text AS k, count(*) AS fo FROM analytics_events
           WHERE type = 'follow_company' AND created_at >= $1 AND created_at < $2 AND entity_id IS NOT NULL GROUP BY 1)
         ${INS}
         SELECT $3::date, 'company', coalesce(c.k, j.k, f.k), coalesce(c.views, 0), coalesce(c.visitors, 0), 0,
           coalesce(c.d, 0), coalesce(c.dn, 0), 0, coalesce(f.fo, 0),
           jsonb_build_object('jobViews', coalesce(j.jv, 0), 'jobVisitors', coalesce(j.jvis, 0))
         FROM c FULL JOIN j ON j.k = c.k FULL JOIN f ON f.k = coalesce(c.k, j.k)
         WHERE coalesce(c.k, j.k, f.k) IS NOT NULL`,
        P,
      );

      // Theo các chiều của phiên: nguồn, kênh, thiết bị, trình duyệt, HĐH, tỉnh/thành, vai trò, chiến dịch.
      const dims: [string, string][] = [
        ['source', 'source'],
        ['channel', 'channel'],
        ['device', 'device'],
        ['browser', `coalesce(browser, 'Khác')`],
        ['os', `coalesce(os, 'Khác')`],
        ['city', `coalesce(city, 'Không rõ')`],
        ['role', 'role'],
        ['campaign', `coalesce(utm_campaign, '')`],
      ];
      for (const [kind, expr] of dims) {
        await m.query(
          `WITH s AS (
             SELECT s.*,
               (SELECT count(*) FROM analytics_pageviews p WHERE p.session_id = s.id) AS pvn,
               (SELECT coalesce(sum(duration_ms), 0) FROM analytics_pageviews p WHERE p.session_id = s.id) AS dur,
               EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.id AND e.type = 'apply_submit') AS conv
             FROM analytics_sessions s WHERE s.started_at >= $1 AND s.started_at < $2)
           ${INS}
           SELECT $3::date, '${kind}', left(${expr}, 300), sum(pvn), count(DISTINCT visitor_id), count(*),
             sum(dur), count(*), count(*) FILTER (WHERE pvn = 1), 0,
             jsonb_build_object('conversions', count(*) FILTER (WHERE conv))
           FROM s WHERE ${expr} <> '' GROUP BY 3`,
          P,
        );
      }

      // Theo loại hành động (trừ click thô).
      await m.query(
        `${INS}
         SELECT $3::date, 'event', type, 0, count(DISTINCT visitor_id), count(DISTINCT session_id), 0, 0, 0, count(*), NULL
         FROM analytics_events WHERE type <> 'click' AND created_at >= $1 AND created_at < $2 GROUP BY type`,
        P,
      );

      // Từ khoá tìm việc làm / tìm hồ sơ (kèm số lần không ra kết quả nào).
      for (const [kind, type] of [
        ['search', 'search'],
        ['cv_search', 'cv_search'],
      ]) {
        await m.query(
          `${INS}
           SELECT $3::date, '${kind}', left(lower(btrim(meta->>'q')), 300), 0, count(DISTINCT visitor_id), 0, 0, 0, 0, count(*),
             jsonb_build_object('zero', count(*) FILTER (WHERE (meta->>'total') = '0'))
           FROM analytics_events
           WHERE type = '${type}' AND created_at >= $1 AND created_at < $2 AND coalesce(btrim(meta->>'q'), '') <> ''
           GROUP BY 3`,
          P,
        );
      }
    });
  }
}
