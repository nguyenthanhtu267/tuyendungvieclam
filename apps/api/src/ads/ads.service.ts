import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AdCampaign } from '../database/entities/ad-campaign.entity';
import { AdminSetting } from '../database/entities/admin-setting.entity';
import { AdminAuditLog } from '../database/entities/admin-audit-log.entity';
import { AdminActor, logAdminAction } from '../admin-tools/admin-audit';
import { FileStorageService } from '../storage/file-storage.service';
import { detectBot } from '../analytics/ua.util';
import { addDays, vnToday } from '../analytics/analytics-rollup.service';
import { AD_SLOTS } from './ad-slots';
import { SaveAdDto } from './dto/save-ad.dto';

const SETTING_ID = 'singleton';
const FEED_TTL_MS = 60_000;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_EVENTS = 50;

export type AdStatus = 'running' | 'scheduled' | 'ended' | 'paused';

// Đợt 24 (29/09/2026) — banner quảng cáo: quản lý chiến dịch (Admin), cấp "nguồn" banner cho trang công khai
// (có bộ nhớ đệm 60 giây — mọi khách xem trang đều gọi), ghi lượt hiển thị/bấm theo ngày.
@Injectable()
export class AdsService {
  private readonly logger = new Logger('Ads');
  private feedCache?: { at: number; value: unknown };

  constructor(
    @InjectRepository(AdCampaign)
    private readonly repo: Repository<AdCampaign>,
    @InjectRepository(AdminSetting)
    private readonly settingRepo: Repository<AdminSetting>,
    @InjectRepository(AdminAuditLog)
    private readonly auditRepo: Repository<AdminAuditLog>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly storage: FileStorageService,
  ) {}

  // ------------------------------------------------------------------ cấu hình chung
  private async setting(): Promise<AdminSetting> {
    let s = await this.settingRepo.findOne({ where: { id: SETTING_ID } });
    if (!s)
      s = await this.settingRepo.save(
        this.settingRepo.create({ id: SETTING_ID }),
      );
    return s;
  }

  async getSettings() {
    const s = await this.setting();
    return {
      enabled: s.adsEnabled !== false,
      disabledSlots: (s.adDisabledSlots ?? []).filter((x) =>
        (AD_SLOTS as readonly string[]).includes(x),
      ),
    };
  }

  async setSettings(
    admin: AdminActor,
    dto: { enabled: boolean; disabledSlots: string[] },
  ) {
    const s = await this.setting();
    s.adsEnabled = dto.enabled;
    s.adDisabledSlots = [...new Set(dto.disabledSlots)];
    await this.settingRepo.save(s);
    this.feedCache = undefined;
    await logAdminAction(
      this.auditRepo,
      admin,
      'ads.settings',
      'admin_setting',
      SETTING_ID,
      `Banner quảng cáo: ${dto.enabled ? 'BẬT' : 'TẮT'} · vùng tắt: ${s.adDisabledSlots.join(', ') || '(không)'}`,
    );
    return this.getSettings();
  }

  // ------------------------------------------------------------------ chiến dịch (Admin)
  static status(c: AdCampaign, now = new Date()): AdStatus {
    if (!c.enabled) return 'paused';
    if (c.endsAt && c.endsAt <= now) return 'ended';
    if (c.startsAt && c.startsAt > now) return 'scheduled';
    return 'running';
  }

  private view(c: AdCampaign) {
    const rest: Partial<AdCampaign> = { ...c };
    delete rest.bgImageData; // không bao giờ trả nội dung ảnh trong JSON
    return {
      ...rest,
      status: AdsService.status(c),
      hasImage: !!(c.bgImageKey || c.bgImageMime),
      bgImageUrl: c.bgImageMime ? AdsService.imageUrl(c) : null,
    };
  }

  static imageUrl(c: AdCampaign) {
    return `/public/ads/${c.id}/image?v=${new Date(c.updatedAt).getTime()}`;
  }

  async list(days = 30) {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    const since = addDays(vnToday(), -(days - 1));
    const totals: {
      campaign_id: string;
      impressions: string;
      clicks: string;
    }[] = await this.ds.query(
      `SELECT campaign_id, sum(impressions) AS impressions, sum(clicks) AS clicks
         FROM ad_campaign_stats WHERE day >= $1 GROUP BY campaign_id`,
      [since],
    );
    const map = new Map(totals.map((t) => [t.campaign_id, t]));
    return rows.map((c) => {
      const t = map.get(c.id);
      return {
        ...this.view(c),
        impressions: Number(t?.impressions ?? 0),
        clicks: Number(t?.clicks ?? 0),
      };
    });
  }

  private async find(id: string) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Không tìm thấy chiến dịch banner');
    return c;
  }

  private apply(c: AdCampaign, dto: SaveAdDto) {
    const blank = (v?: string | null) => (v && v.trim() ? v.trim() : null);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (startsAt && endsAt && endsAt <= startsAt)
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    c.name = dto.name.trim();
    c.eyebrow = blank(dto.eyebrow);
    c.title = dto.title.trim();
    c.subtitle = blank(dto.subtitle);
    c.ctaText = blank(dto.ctaText);
    c.url = dto.url.trim();
    c.addUtm = dto.addUtm;
    c.bgMode = dto.bgMode;
    c.bgPrompt = (dto.bgPrompt ?? '').trim();
    c.bgTheme = blank(dto.bgTheme);
    c.bgSeed = dto.bgSeed;
    c.textColor = dto.textColor;
    // "*" nuốt mọi vùng khác.
    c.slots = dto.slots.includes('*') ? ['*'] : [...new Set(dto.slots)];
    c.audiences = [...new Set(dto.audiences)];
    c.device = dto.device;
    c.weight = dto.weight;
    c.startsAt = startsAt;
    c.endsAt = endsAt;
    c.enabled = dto.enabled;
  }

  async create(admin: AdminActor, dto: SaveAdDto) {
    const c = this.repo.create();
    this.apply(c, dto);
    const saved = await this.repo.save(c);
    this.feedCache = undefined;
    await logAdminAction(
      this.auditRepo,
      admin,
      'ads.create',
      'ad_campaign',
      saved.id,
      saved.name,
    );
    return this.view(saved);
  }

  async update(admin: AdminActor, id: string, dto: SaveAdDto) {
    const c = await this.find(id);
    this.apply(c, dto);
    const saved = await this.repo.save(c);
    this.feedCache = undefined;
    await logAdminAction(
      this.auditRepo,
      admin,
      'ads.update',
      'ad_campaign',
      id,
      saved.name,
    );
    return this.view(saved);
  }

  async setEnabled(admin: AdminActor, id: string, enabled: boolean) {
    const c = await this.find(id);
    c.enabled = enabled;
    const saved = await this.repo.save(c);
    this.feedCache = undefined;
    await logAdminAction(
      this.auditRepo,
      admin,
      enabled ? 'ads.enable' : 'ads.disable',
      'ad_campaign',
      id,
      c.name,
    );
    return this.view(saved);
  }

  // Nhân bản: chép toàn bộ (kể cả ảnh nền — dùng chung file, không tốn thêm dung lượng), để TẮT cho Admin sửa.
  async duplicate(admin: AdminActor, id: string) {
    const src = await this.repo
      .createQueryBuilder('a')
      .addSelect('a.bgImageData')
      .where('a.id = :id', { id })
      .getOne();
    if (!src) throw new NotFoundException('Không tìm thấy chiến dịch banner');
    const rest: Partial<AdCampaign> = { ...src };
    delete rest.id;
    delete rest.createdAt;
    delete rest.updatedAt;
    const copy = this.repo.create({
      ...rest,
      name: `${src.name} (bản sao)`.slice(0, 120),
      enabled: false,
    });
    const saved = await this.repo.save(copy);
    this.feedCache = undefined;
    await logAdminAction(
      this.auditRepo,
      admin,
      'ads.duplicate',
      'ad_campaign',
      saved.id,
      saved.name,
    );
    return this.view(saved);
  }

  async remove(admin: AdminActor, id: string) {
    const c = await this.find(id);
    await this.repo.delete({ id });
    this.feedCache = undefined;
    await logAdminAction(
      this.auditRepo,
      admin,
      'ads.delete',
      'ad_campaign',
      id,
      c.name,
    );
    return { ok: true };
  }

  async setImage(
    admin: AdminActor,
    id: string,
    file: Express.Multer.File | undefined,
    tone: string | undefined,
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn ảnh nền');
    if (!IMAGE_MIMES.includes(file.mimetype))
      throw new BadRequestException('Ảnh nền phải là JPG, PNG hoặc WEBP');
    if (file.size > IMAGE_MAX_BYTES)
      throw new BadRequestException('Ảnh nền tối đa 2MB');
    const c = await this.find(id);
    const key = await this.storage.put(file.buffer, {
      name: `banner-${c.name}`,
      mime: file.mimetype,
      category: 'ad',
    });
    await this.repo.update(
      { id },
      {
        bgImageData: key ? null : file.buffer,
        bgImageKey: key,
        bgImageMime: file.mimetype,
        bgImageTone: tone === 'light' ? 'light' : 'dark',
        bgMode: 'image',
      },
    );
    this.feedCache = undefined;
    await logAdminAction(
      this.auditRepo,
      admin,
      'ads.image',
      'ad_campaign',
      id,
      c.name,
    );
    return this.view(await this.find(id));
  }

  async removeImage(admin: AdminActor, id: string) {
    const c = await this.find(id);
    await this.repo.update(
      { id },
      {
        bgImageData: null,
        bgImageKey: null,
        bgImageMime: null,
        bgImageTone: null,
        bgMode: 'generated',
      },
    );
    this.feedCache = undefined;
    await logAdminAction(
      this.auditRepo,
      admin,
      'ads.image_remove',
      'ad_campaign',
      id,
      c.name,
    );
    return this.view(await this.find(id));
  }

  async image(id: string): Promise<{ data: Buffer; mime: string } | null> {
    const c = await this.repo
      .createQueryBuilder('a')
      .addSelect('a.bgImageData')
      .where('a.id = :id', { id })
      .getOne();
    if (!c || !c.bgImageMime) return null;
    const data = await this.storage.resolve(c.bgImageData, c.bgImageKey);
    return data ? { data, mime: c.bgImageMime } : null;
  }

  // ------------------------------------------------------------------ nguồn banner công khai
  async publicFeed() {
    if (this.feedCache && Date.now() - this.feedCache.at < FEED_TTL_MS)
      return this.feedCache.value;
    const settings = await this.getSettings();
    let campaigns: unknown[] = [];
    if (settings.enabled) {
      const now = new Date();
      const rows = await this.repo.find({ where: { enabled: true } });
      campaigns = rows
        .filter((c) => AdsService.status(c, now) === 'running')
        .map((c) => ({
          id: c.id,
          slug: slugify(c.name),
          eyebrow: c.eyebrow ?? null,
          title: c.title,
          subtitle: c.subtitle ?? null,
          ctaText: c.ctaText ?? null,
          url: c.url,
          addUtm: c.addUtm,
          bgMode: c.bgMode === 'image' && c.bgImageMime ? 'image' : 'generated',
          bgPrompt: c.bgPrompt,
          bgTheme: c.bgTheme ?? null,
          bgSeed: c.bgSeed,
          bgImageUrl: c.bgImageMime ? AdsService.imageUrl(c) : null,
          bgImageTone: c.bgImageTone ?? null,
          textColor: c.textColor,
          slots: c.slots,
          audiences: c.audiences,
          device: c.device,
          weight: c.weight,
        }));
    }
    const value = { ...settings, campaigns };
    this.feedCache = { at: Date.now(), value };
    return value;
  }

  // ------------------------------------------------------------------ lượt hiển thị / bấm
  // Thân yêu cầu là text/plain (navigator.sendBeacon): {"e":[{"c":"<id chiến dịch>","s":"<vùng>","t":"v"|"c"}]}.
  async recordEvents(body: unknown, ua: string | undefined) {
    if (detectBot(ua)) return 0;
    let parsed: unknown = body;
    if (typeof body === 'string') {
      try {
        parsed = JSON.parse(body);
      } catch {
        return 0;
      }
    }
    const list = (parsed as { e?: unknown })?.e;
    if (!Array.isArray(list)) return 0;
    const agg = new Map<
      string,
      { c: string; s: string; v: number; k: number }
    >();
    for (const ev of list.slice(0, MAX_EVENTS)) {
      const { c, s, t } = (ev ?? {}) as {
        c?: unknown;
        s?: unknown;
        t?: unknown;
      };
      if (typeof c !== 'string' || !/^[0-9a-f-]{36}$/i.test(c)) continue;
      if (typeof s !== 'string' || !(AD_SLOTS as readonly string[]).includes(s))
        continue;
      if (t !== 'v' && t !== 'c') continue;
      const k = `${c}|${s}`;
      const cur = agg.get(k) ?? { c, s, v: 0, k: 0 };
      if (t === 'v') cur.v++;
      else cur.k++;
      agg.set(k, cur);
    }
    if (!agg.size) return 0;
    const day = vnToday();
    let n = 0;
    for (const a of agg.values()) {
      // Chỉ ghi cho chiến dịch còn tồn tại (INSERT … SELECT … WHERE EXISTS) — id lạ bị bỏ qua êm.
      const res = await this.ds.query(
        `INSERT INTO ad_campaign_stats (campaign_id, slot, day, impressions, clicks)
         SELECT $1, $2, $3, $4, $5 WHERE EXISTS (SELECT 1 FROM ad_campaigns WHERE id = $1)
         ON CONFLICT (campaign_id, slot, day) DO UPDATE
           SET impressions = ad_campaign_stats.impressions + EXCLUDED.impressions,
               clicks = ad_campaign_stats.clicks + EXCLUDED.clicks`,
        [a.c, a.s, day, Math.min(a.v, 20), Math.min(a.k, 10)],
      );
      if (Array.isArray(res) ? res[1] !== 0 : true) n++;
    }
    return n;
  }

  async stats(days = 30) {
    const d = Math.min(Math.max(Math.round(days) || 30, 1), 365);
    const since = addDays(vnToday(), -(d - 1));
    const bySlot: {
      campaign_id: string;
      slot: string;
      impressions: string;
      clicks: string;
    }[] = await this.ds.query(
      `SELECT campaign_id, slot, sum(impressions) AS impressions, sum(clicks) AS clicks
         FROM ad_campaign_stats WHERE day >= $1 GROUP BY campaign_id, slot`,
      [since],
    );
    const daily: { day: string; impressions: string; clicks: string }[] =
      await this.ds.query(
        `SELECT to_char(day, 'YYYY-MM-DD') AS day, sum(impressions) AS impressions, sum(clicks) AS clicks
       FROM ad_campaign_stats WHERE day >= $1 GROUP BY day ORDER BY day`,
        [since],
      );
    return {
      days: d,
      since,
      bySlot: bySlot.map((r) => ({
        campaignId: r.campaign_id,
        slot: r.slot,
        impressions: Number(r.impressions),
        clicks: Number(r.clicks),
      })),
      daily: daily.map((r) => ({
        day: r.day,
        impressions: Number(r.impressions),
        clicks: Number(r.clicks),
      })),
    };
  }
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
