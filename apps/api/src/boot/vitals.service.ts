import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

// Đợt 93 — đo tốc độ THẬT từ điện thoại/máy người dùng (Web Vitals): LCP (hiện nội dung chính), CLS (giật bố cục),
// INP (độ trễ khi bấm), FCP, TTFB. Trình duyệt gửi 1 gói nhỏ khi rời trang; Admin xem trung vị/p75 theo trang & thiết bị.
// Bảng tự tạo lần đầu dùng (CREATE TABLE IF NOT EXISTS) nên KHÔNG cần chạy migration.
const num = (v: unknown, max: number): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 1000) / 1000 : null;
};

@Injectable()
export class VitalsService {
  private readonly logger = new Logger('Vitals');
  private ready: Promise<void> | null = null;
  private lastPrune = 0;
  private perMinute = { at: 0, n: 0 };

  constructor(private readonly ds: DataSource) {}

  private ensure(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await this.ds.query(
          `CREATE TABLE IF NOT EXISTS "web_vitals" (
             "id" bigserial PRIMARY KEY,
             "at" timestamptz NOT NULL DEFAULT now(),
             "path" varchar(120) NOT NULL,
             "device" char(1) NOT NULL,
             "net" varchar(8),
             "lcp" real, "cls" real, "inp" real, "fcp" real, "ttfb" real
           )`,
        );
        await this.ds.query(`CREATE INDEX IF NOT EXISTS "IDX_web_vitals_at" ON "web_vitals" ("at")`);
      })().catch((e) => {
        this.ready = null;
        throw e;
      });
    }
    return this.ready;
  }

  /** Chuẩn hoá đường dẫn: bỏ tham số + thay mã tin/ id bằng :id để gộp thống kê theo loại trang. */
  private normPath(p: unknown): string | null {
    if (typeof p !== 'string' || !p.startsWith('/')) return null;
    const clean = p.split('?')[0].split('#')[0].slice(0, 120);
    return clean.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id').replace(/\/\d{3,}(?=\/|$)/g, '/:id') || '/';
  }

  async record(body: unknown): Promise<void> {
    let b: any = body;
    if (typeof b === 'string') {
      try {
        b = JSON.parse(b);
      } catch {
        return;
      }
    }
    if (!b || typeof b !== 'object') return;
    const path = this.normPath(b.p);
    if (!path) return;
    const lcp = num(b.lcp, 60000), cls = num(b.cls, 10), inp = num(b.inp, 60000), fcp = num(b.fcp, 60000), ttfb = num(b.ttfb, 60000);
    if (lcp === null && cls === null && inp === null && fcp === null && ttfb === null) return;
    // chống tràn: tối đa 600 gói/phút toàn hệ thống
    const now = Date.now();
    if (now - this.perMinute.at > 60_000) this.perMinute = { at: now, n: 0 };
    if (++this.perMinute.n > 600) return;
    await this.ensure();
    await this.ds.query(
      `INSERT INTO "web_vitals" ("path","device","net","lcp","cls","inp","fcp","ttfb") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [path, b.d === 'd' ? 'd' : 'm', typeof b.n === 'string' ? b.n.slice(0, 8) : null, lcp, cls, inp, fcp, ttfb],
    );
    if (now - this.lastPrune > 6 * 3600_000) {
      this.lastPrune = now;
      this.ds.query(`DELETE FROM "web_vitals" WHERE "at" < now() - interval '30 days'`).catch(() => undefined);
    }
  }

  async summary(days = 7) {
    await this.ensure();
    const d = Math.min(Math.max(Math.floor(days) || 7, 1), 30);
    const rows = await this.ds.query(
      `SELECT "path", "device", count(*)::int AS n,
              percentile_cont(0.75) WITHIN GROUP (ORDER BY "lcp")  AS lcp,
              percentile_cont(0.75) WITHIN GROUP (ORDER BY "cls")  AS cls,
              percentile_cont(0.75) WITHIN GROUP (ORDER BY "inp")  AS inp,
              percentile_cont(0.75) WITHIN GROUP (ORDER BY "ttfb") AS ttfb
         FROM "web_vitals" WHERE "at" > now() - ($1 || ' days')::interval
        GROUP BY "path","device" HAVING count(*) >= 3
        ORDER BY count(*) DESC LIMIT 60`,
      [String(d)],
    );
    const round = (v: unknown, k: number) => (v === null || v === undefined ? null : Math.round(Number(v) * k) / k);
    return {
      days: d,
      note: 'Giá trị p75: 75% lượt xem tốt hơn mức này. Mục tiêu Google: LCP ≤ 2500ms, CLS ≤ 0.1, INP ≤ 200ms.',
      items: rows.map((r: any) => ({
        path: r.path,
        device: r.device === 'd' ? 'desktop' : 'mobile',
        samples: r.n,
        lcpMs: round(r.lcp, 1),
        cls: round(r.cls, 1000),
        inpMs: round(r.inp, 1),
        ttfbMs: round(r.ttfb, 1),
      })),
    };
  }
}
