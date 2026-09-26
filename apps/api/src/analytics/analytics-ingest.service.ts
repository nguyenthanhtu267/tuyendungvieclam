import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { UserStatusCache } from '../auth/user-status.cache';
import {
  classifySource,
  detectBot,
  deviceFromViewport,
  isUuid,
  normalizeRoute,
  parseUserAgent,
} from './ua.util';

// Đợt 19 (26/09/2026) — nhận lô dữ liệu truy cập từ trình duyệt (POST /analytics/collect, gửi bằng
// navigator.sendBeacon dạng text/plain để không cần preflight CORS và vẫn gửi được lúc đóng tab).

export const ALLOWED_EVENT_TYPES = new Set([
  'click', // mọi cú click (bản đồ nhiệt)
  'apply_click', // bấm "Ứng tuyển"/"Nộp đơn"
  'apply_submit', // nộp đơn thành công
  'save_job',
  'unsave_job',
  'follow_company',
  'unfollow_company',
  'contact_phone', // bấm số điện thoại (tel:)
  'contact_email', // bấm email (mailto:)
  'contact_zalo', // bấm link Zalo
  'outbound', // bấm link ra trang web khác
  'search', // tìm việc làm (kèm từ khoá, bộ lọc, số kết quả)
  'cv_search', // NTD tìm hồ sơ ứng viên
  'cv_unlock', // NTD mở khoá hồ sơ
  'signup',
  'login',
]);

const MAX_PV = 40;
const MAX_EV = 250;
const MAX_PV_DURATION = 30 * 60_000;

type Identity = { userId: string | null; role: string } | 'excluded';

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function clampTs(v: unknown, now: number): Date {
  const n = num(v);
  if (n === null || n < now - 6 * 3600_000 || n > now + 120_000)
    return new Date(now);
  return new Date(n);
}

@Injectable()
export class AnalyticsIngestService {
  private readonly logger = new Logger(AnalyticsIngestService.name);
  // Chống spam đơn giản: tối đa 60 lô/phút cho 1 mã trình duyệt (bình thường ~6-10 lô/phút).
  private readonly rate = new Map<string, { n: number; at: number }>();

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly jwt: JwtService,
  ) {}

  private allow(visitor: string): boolean {
    const now = Date.now();
    const e = this.rate.get(visitor);
    if (!e || now - e.at > 60_000) {
      if (this.rate.size > 50_000) this.rate.clear();
      this.rate.set(visitor, { n: 1, at: now });
      return true;
    }
    e.n++;
    return e.n <= 60;
  }

  // Xác định người đang xem từ token đăng nhập kèm trong lô (sendBeacon không gửi được header
  // Authorization). Admin / Điều phối viên / đang "Đăng nhập thay" → loại khỏi số liệu.
  private async identify(token: unknown): Promise<Identity> {
    if (typeof token !== 'string' || token.length < 20)
      return { userId: null, role: 'guest' };
    try {
      const p = await this.jwt.verifyAsync<{
        sub: string;
        role: string;
        imp?: string;
      }>(token);
      if (p.imp) return 'excluded';
      const role = UserStatusCache.get(p.sub)?.role ?? p.role;
      if (role === 'admin' || role === 'moderator') return 'excluded';
      return {
        userId: p.sub,
        role: role?.startsWith('employer')
          ? 'employer'
          : role === 'candidate'
            ? 'candidate'
            : 'guest',
      };
    } catch {
      return { userId: null, role: 'guest' };
    }
  }

  async recordBot(bot: string) {
    await this.ds.query(
      `INSERT INTO analytics_bot_hits (day, bot, hits)
       VALUES ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, $1, 1)
       ON CONFLICT (day, bot) DO UPDATE SET hits = analytics_bot_hits.hits + 1`,
      [bot.slice(0, 60)],
    );
  }

  async collect(
    rawBody: unknown,
    ua: string | undefined,
    ownHost: string | null,
  ): Promise<{ ok: boolean; reason?: string }> {
    let body: Record<string, any>;
    try {
      body =
        typeof rawBody === 'string'
          ? JSON.parse(rawBody)
          : (rawBody as Record<string, any>);
    } catch {
      return { ok: false, reason: 'bad_json' };
    }
    if (!body || typeof body !== 'object')
      return { ok: false, reason: 'bad_body' };

    const visitorId = str(body.v, 64);
    const sessionId = isUuid(body.s) ? String(body.s).toLowerCase() : null;
    if (!visitorId || !sessionId) return { ok: false, reason: 'missing_ids' };

    const bot =
      detectBot(ua) ?? (body.ses?.wd === true ? 'Trình duyệt tự động' : null);
    if (bot) {
      await this.recordBot(bot).catch(() => {});
      return { ok: false, reason: 'bot' };
    }
    if (!this.allow(visitorId)) return { ok: false, reason: 'rate' };

    const who = await this.identify(body.tk);
    if (who === 'excluded') return { ok: false, reason: 'internal' };

    const now = Date.now();
    const ses = (
      body.ses && typeof body.ses === 'object' ? body.ses : {}
    ) as Record<string, any>;
    const screenW = num(ses.sw);
    const { device, browser, os } = parseUserAgent(ua, screenW);
    const utm = (
      ses.utm && typeof ses.utm === 'object' ? ses.utm : {}
    ) as Record<string, unknown>;
    const utmSource = str(utm.source, 100);
    const utmMedium = str(utm.medium, 100);
    const utmCampaign = str(utm.campaign, 150);
    const src = classifySource(
      str(ses.ref, 500),
      ownHost,
      utmSource,
      utmMedium,
    );
    const firstSeen = num(body.vf);
    const sessionStart = clampTs(
      ses.st ?? (Array.isArray(body.pv) && body.pv[0]?.ts),
      now,
    );
    // Khách mới = mã trình duyệt được tạo ngay trong phiên này (tính ở trình duyệt nên vẫn đúng sau khi
    // dữ liệu chi tiết cũ đã bị xoá sau 90 ngày).
    const isNew =
      firstSeen === null
        ? true
        : firstSeen >= sessionStart.getTime() - 30 * 60_000;
    const landing = str(ses.land, 300);
    const geo = (
      ses.geo && typeof ses.geo === 'object' ? ses.geo : {}
    ) as Record<string, unknown>;

    await this.ds.query(
      `INSERT INTO analytics_sessions (id, visitor_id, user_id, role, is_new_visitor, started_at, last_seen_at,
          landing_path, referrer_host, source, channel, utm_source, utm_medium, utm_campaign, device, browser, os,
          screen_w, lang, country, city)
       VALUES ($1,$2,$3,$4,$5,$6,now(),$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (id) DO UPDATE SET
         last_seen_at = now(),
         user_id = COALESCE(EXCLUDED.user_id, analytics_sessions.user_id),
         role = CASE WHEN EXCLUDED.role <> 'guest' THEN EXCLUDED.role ELSE analytics_sessions.role END,
         country = COALESCE(analytics_sessions.country, EXCLUDED.country),
         city = COALESCE(analytics_sessions.city, EXCLUDED.city)
       WHERE analytics_sessions.visitor_id = EXCLUDED.visitor_id`,
      [
        sessionId,
        visitorId,
        who.userId,
        who.role,
        isNew,
        sessionStart,
        landing ? normalizeRoute(landing).route : null,
        src.referrerHost,
        src.source,
        src.channel,
        utmSource,
        utmMedium,
        utmCampaign,
        device,
        browser,
        os,
        screenW !== null ? Math.round(screenW) : null,
        str(ses.lang, 20),
        str(geo.country, 8),
        str(geo.city, 100),
      ],
    );

    // Phiên đã thuộc về trình duyệt khác (mã phiên bị đoán/giả mạo) → bỏ cả lô, không cho ghi đè số liệu.
    const [owner] = await this.ds.query(
      `SELECT visitor_id FROM analytics_sessions WHERE id = $1`,
      [sessionId],
    );
    if (!owner || owner.visitor_id !== visitorId)
      return { ok: false, reason: 'session_owner' };

    // ---- Lượt xem trang ----
    const pvs = Array.isArray(body.pv) ? body.pv.slice(0, MAX_PV) : [];
    for (const pv of pvs) {
      if (!pv || !isUuid(pv.id)) continue;
      const path = str(pv.p, 300);
      if (!path || !path.startsWith('/')) continue;
      const { route, entityType, entityId } = normalizeRoute(path);
      const prev = str(pv.prev, 300);
      const dur = Math.max(
        0,
        Math.min(MAX_PV_DURATION, Math.round(num(pv.d) ?? 0)),
      );
      const scroll = Math.max(0, Math.min(100, Math.round(num(pv.sc) ?? 0)));
      await this.ds.query(
        `INSERT INTO analytics_pageviews (id, session_id, visitor_id, user_id, role, path, route, entity_type, entity_id,
            prev_route, started_at, duration_ms, max_scroll, device)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (id) DO UPDATE SET
           duration_ms = GREATEST(analytics_pageviews.duration_ms, EXCLUDED.duration_ms),
           max_scroll = GREATEST(analytics_pageviews.max_scroll, EXCLUDED.max_scroll)
         WHERE analytics_pageviews.session_id = EXCLUDED.session_id AND analytics_pageviews.visitor_id = EXCLUDED.visitor_id`,
        [
          String(pv.id).toLowerCase(),
          sessionId,
          visitorId,
          who.userId,
          who.role,
          path.split('?')[0],
          route,
          entityType,
          entityId,
          prev ? normalizeRoute(prev).route : null,
          clampTs(pv.ts, now),
          dur,
          scroll,
          device,
        ],
      );
    }

    // ---- Sự kiện (click + hành động) ----
    const evs = Array.isArray(body.ev) ? body.ev.slice(0, MAX_EV) : [];
    const rows: unknown[][] = [];
    for (const ev of evs) {
      if (!ev || typeof ev.t !== 'string' || !ALLOWED_EVENT_TYPES.has(ev.t))
        continue;
      const path = str(ev.p, 300);
      if (!path || !path.startsWith('/')) continue;
      const norm = normalizeRoute(path);
      let entityType = norm.entityType;
      let entityId = norm.entityId;
      if (typeof ev.et === 'string' && isUuid(ev.ei)) {
        entityType = ev.et.slice(0, 20);
        entityId = String(ev.ei).toLowerCase();
      }
      const x = num(ev.x);
      const y = num(ev.y);
      let meta: Record<string, unknown> | null = null;
      if (ev.m && typeof ev.m === 'object') {
        const json = JSON.stringify(ev.m);
        if (json.length <= 1500) meta = ev.m;
      }
      rows.push([
        sessionId,
        isUuid(ev.pv) ? String(ev.pv).toLowerCase() : null,
        visitorId,
        who.userId,
        who.role,
        ev.t,
        norm.route,
        path.split('?')[0],
        entityType,
        entityId,
        str(ev.l, 120),
        x !== null ? Math.max(0, Math.min(1, x)) : null,
        y !== null ? Math.max(0, Math.min(200_000, Math.round(y))) : null,
        num(ev.dh) !== null
          ? Math.max(0, Math.min(400_000, Math.round(ev.dh)))
          : null,
        deviceFromViewport(num(ev.vw), device),
        meta ? JSON.stringify(meta) : null,
        clampTs(ev.ts, now),
      ]);
    }
    if (rows.length) {
      const cols = 17;
      const values = rows
        .map(
          (_, i) =>
            `(${Array.from({ length: cols }, (__, j) => `$${i * cols + j + 1}`).join(',')})`,
        )
        .join(',');
      await this.ds.query(
        `INSERT INTO analytics_events (session_id, pageview_id, visitor_id, user_id, role, type, route, path,
            entity_type, entity_id, label, x, y, doc_h, device, meta, created_at)
         VALUES ${values}`,
        rows.flat(),
      );
    }
    return { ok: true };
  }
}
