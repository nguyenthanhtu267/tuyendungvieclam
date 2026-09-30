import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchHistory } from '../database/entities/search-history.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CandidateSkill } from '../database/entities/candidate-sections.entity';
import { Notification } from '../database/entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { JobsService } from './jobs.service';
import { scoreMatch } from './job-match';

const RUN_EVERY_MS = 30 * 60_000;
const SEARCH_COOLDOWN_MS = 6 * 60 * 60_000; // mỗi tìm kiếm đã lưu tối đa 1 thông báo / 6 giờ
const DIGEST_COOLDOWN_MS = 24 * 60 * 60_000; // bản tin "rất phù hợp với hồ sơ" tối đa 1 lần / ngày
const DIGEST_MIN_SCORE = 80;

// Đợt 38 (30/09/2026) — Cảnh báo việc mới GOM THEO ĐỢT (30 phút/lần), thay cho kiểu "mỗi tin duyệt = 1 thông báo" (dồn dập):
//  1) Với từng "tìm kiếm đã lưu" đang bật cảnh báo: có tin mới khớp bộ lọc → 1 thông báo "Có N việc mới…" kèm đường dẫn.
//  2) Với hồ sơ có ngành/địa điểm mong muốn: tin mới đăng trong 24 giờ có độ phù hợp ≥ 80% → 1 bản tin/ngày.
// Chỉ hiển thị trong web (chuông) theo quyết định giai đoạn 1 — chưa gửi email/SMS (xem notification.entity.ts).
@Injectable()
export class JobAlertsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(JobAlertsService.name);
  private timer?: ReturnType<typeof setInterval>;
  private startTimer?: ReturnType<typeof setTimeout>;
  private running = false;

  constructor(
    @InjectRepository(SearchHistory)
    private readonly searchRepo: Repository<SearchHistory>,
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(CandidateSkill)
    private readonly skillRepo: Repository<CandidateSkill>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.startTimer = setTimeout(
      () => this.run().catch(() => undefined),
      60_000,
    );
    this.timer = setInterval(
      () => this.run().catch(() => undefined),
      RUN_EVERY_MS,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.startTimer) clearTimeout(this.startTimer);
  }

  static label(criteria: Record<string, unknown>): string {
    const parts: string[] = [];
    if (typeof criteria.q === 'string' && criteria.q.trim())
      parts.push(`“${criteria.q.trim()}”`);
    if (Array.isArray(criteria.industries) && criteria.industries.length)
      parts.push((criteria.industries as string[]).slice(0, 2).join(', '));
    if (Array.isArray(criteria.provinces) && criteria.provinces.length)
      parts.push((criteria.provinces as string[]).slice(0, 2).join(', '));
    return parts.join(' · ') || 'tìm kiếm của bạn';
  }

  static linkOf(criteria: Record<string, unknown>): string {
    const qs = new URLSearchParams();
    if (typeof criteria.q === 'string' && criteria.q.trim())
      qs.set('q', criteria.q.trim());
    for (const k of ['industries', 'provinces']) {
      const v = criteria[k];
      if (Array.isArray(v) && v.length) qs.set(k, (v as string[]).join(','));
    }
    const s = qs.toString();
    return s ? `/viec-lam?${s}` : '/viec-lam';
  }

  /** Chạy 1 đợt; trả về số thông báo đã tạo (dùng cho kiểm thử/Admin). */
  async run(): Promise<{ searchAlerts: number; digests: number }> {
    if (this.running) return { searchAlerts: 0, digests: 0 };
    this.running = true;
    try {
      return {
        searchAlerts: await this.runSavedSearches(),
        digests: await this.runDigests(),
      };
    } catch (e) {
      this.log.warn(`Job alerts lỗi: ${(e as Error).message}`);
      return { searchAlerts: 0, digests: 0 };
    } finally {
      this.running = false;
    }
  }

  private async runSavedSearches(): Promise<number> {
    const rows = await this.searchRepo.find({
      where: { ownerType: 'candidate_profile', alertEnabled: true },
    });
    let made = 0;
    for (const row of rows) {
      const now = Date.now();
      if (
        row.lastAlertAt &&
        now - new Date(row.lastAlertAt).getTime() < SEARCH_COOLDOWN_MS
      )
        continue;
      const criteria = (row.criteria ?? {}) as Record<string, unknown>;
      const hasFilter = ['q', 'industries', 'provinces'].some((k) => {
        const v = criteria[k];
        return Array.isArray(v)
          ? v.length > 0
          : typeof v === 'string' && v.trim().length > 0;
      });
      if (!hasFilter) continue;
      const profile = await this.profileRepo.findOne({
        where: { id: row.ownerId },
      });
      if (!profile || !profile.allowJobNotifications) continue;
      const since = row.lastAlertAt ?? row.createdAt;
      const { count, items } = await this.jobs.newMatchingSince(
        criteria,
        new Date(since),
        3,
      );
      if (count === 0) continue;
      const top = items[0]?.title ? ` — mới nhất: “${items[0].title}”` : '';
      await this.notifications.create(
        profile.userId,
        'job_alert_match',
        `Có ${count} việc mới cho ${JobAlertsService.label(criteria)}${top}`,
        JobAlertsService.linkOf(criteria),
      );
      row.lastAlertAt = new Date();
      await this.searchRepo.save(row);
      made++;
    }
    return made;
  }

  private async runDigests(): Promise<number> {
    const since = new Date(Date.now() - DIGEST_COOLDOWN_MS);
    const jobs = await this.jobs.recentApproved(since, 200);
    if (jobs.length === 0) return 0;
    const profiles = await this.profileRepo.find({
      where: { allowJobNotifications: true },
      take: 2000,
    });
    let made = 0;
    for (const p of profiles) {
      if (
        !p.desiredIndustries?.length &&
        !p.desiredLocations?.length &&
        !p.province
      )
        continue;
      const recent = await this.notifRepo
        .createQueryBuilder('n')
        .where('n.userId = :u AND n.type = :t AND n.createdAt > :since', {
          u: p.userId,
          t: 'job_digest',
          since,
        })
        .getCount();
      if (recent > 0) continue;
      const skills = await this.skillRepo.find({
        where: { candidateProfileId: p.id },
      });
      const mp = { ...p, skillNames: skills.map((s) => s.skillName) };
      const ranked = jobs
        .map((j) => ({ j, m: scoreMatch(mp, j) }))
        .filter((r) => r.m.score >= DIGEST_MIN_SCORE)
        .sort((a, b) => b.m.score - a.m.score);
      if (ranked.length === 0) continue;
      const best = ranked[0];
      await this.notifications.create(
        p.userId,
        'job_digest',
        `✨ Có ${ranked.length} việc mới rất phù hợp với hồ sơ của bạn — cao nhất ${best.m.score}%: “${best.j.title}”`,
        `/viec-lam/${best.j.id}`,
      );
      made++;
    }
    return made;
  }
}
