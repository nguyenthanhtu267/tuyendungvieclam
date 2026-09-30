import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, MoreThan, Repository } from 'typeorm';
import { Application, ApplicationStatus } from '../database/entities/application.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { Notification } from '../database/entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';

const RUN_EVERY_MS = 6 * 60 * 60_000;
const SILENT_DAYS = 7;
const DAY = 24 * 60 * 60_000;

// Đợt 43 — Nhắc khi nhà tuyển dụng "im lặng": đơn vẫn ở trạng thái "Mới ứng tuyển" quá 7 ngày.
//  • Ứng viên: 1 thông báo cho MỖI đơn (không lặp lại) — an ủi + gợi ý xem việc tương tự.
//  • Nhà tuyển dụng: 1 thông báo gộp / 3 ngày cho mỗi tài khoản, nêu số hồ sơ chưa xử lý.
// Chỉ hiển thị trong web (chuông) — chưa gửi email (xem notification.entity.ts).
@Injectable()
export class ApplicationRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ApplicationRemindersService.name);
  private timer?: ReturnType<typeof setInterval>;
  private startTimer?: ReturnType<typeof setTimeout>;
  private running = false;

  constructor(
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(CompanyUser) private readonly companyUserRepo: Repository<CompanyUser>,
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.startTimer = setTimeout(() => this.run().catch(() => undefined), 90_000);
    this.timer = setInterval(() => this.run().catch(() => undefined), RUN_EVERY_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.startTimer) clearTimeout(this.startTimer);
  }

  async run(): Promise<{ candidates: number; employers: number }> {
    if (this.running) return { candidates: 0, employers: 0 };
    this.running = true;
    try {
      const cutoff = new Date(Date.now() - SILENT_DAYS * DAY);
      const stale = await this.appRepo.find({
        where: { status: ApplicationStatus.NEW, appliedAt: Between(new Date(Date.now() - 30 * DAY), cutoff), deletedAt: IsNull() },
        relations: { jobPosting: { company: true }, cv: true },
        take: 500,
        order: { appliedAt: 'ASC' },
      });
      let candidates = 0;
      for (const a of stale) {
        const userId = a.cv?.candidateProfileId ? await this.userIdOfProfile(a.cv.candidateProfileId) : null;
        if (!userId) continue;
        const link = `/ho-so?app=${a.id}#applications`;
        const exists = await this.notifRepo.exists({ where: { userId, type: 'application_reminder', link } });
        if (exists) continue;
        const days = Math.floor((Date.now() - a.appliedAt.getTime()) / DAY);
        await this.notifications.create(
          userId,
          'application_reminder',
          `${a.jobPosting?.company?.name ?? 'Nhà tuyển dụng'} chưa phản hồi đơn "${a.jobPosting?.title ?? ''}" sau ${days} ngày. Bạn có thể xem thêm việc tương tự trong lúc chờ.`,
          link,
        );
        candidates++;
      }

      // Gộp theo công ty cho nhà tuyển dụng
      const byCompany = new Map<string, number>();
      for (const a of stale) {
        const cid = a.jobPosting?.companyId;
        if (cid) byCompany.set(cid, (byCompany.get(cid) ?? 0) + 1);
      }
      let employers = 0;
      const since = new Date(Date.now() - 3 * DAY);
      for (const [companyId, count] of byCompany) {
        const cus = await this.companyUserRepo.find({ where: { companyId } });
        const userIds = cus.map((c) => c.userId);
        if (!userIds.length) continue;
        const recent = await this.notifRepo.find({
          where: { userId: In(userIds), type: 'application_stale', createdAt: MoreThan(since) },
          select: { userId: true },
        });
        const skip = new Set(recent.map((r) => r.userId));
        for (const uid of userIds) {
          if (skip.has(uid)) continue;
          await this.notifications.create(
            uid,
            'application_stale',
            `Bạn có ${count} hồ sơ ứng tuyển chưa được xử lý quá ${SILENT_DAYS} ngày. Phản hồi sớm giúp giữ chân ứng viên giỏi.`,
            '/nha-tuyen-dung/ung-vien',
          );
          employers++;
        }
      }
      if (candidates || employers) this.log.log(`Nhắc ứng tuyển: ${candidates} ứng viên, ${employers} nhà tuyển dụng`);
      return { candidates, employers };
    } finally {
      this.running = false;
    }
  }

  private profileUserCache = new Map<string, string | null>();
  private async userIdOfProfile(profileId: string): Promise<string | null> {
    if (this.profileUserCache.has(profileId)) return this.profileUserCache.get(profileId)!;
    const row = await this.appRepo.manager
      .createQueryBuilder()
      .select('p.user_id', 'userId')
      .from('candidate_profiles', 'p')
      .where('p.id = :id', { id: profileId })
      .getRawOne<{ userId: string }>();
    const v = row?.userId ?? null;
    if (this.profileUserCache.size > 2000) this.profileUserCache.clear();
    this.profileUserCache.set(profileId, v);
    return v;
  }
}
