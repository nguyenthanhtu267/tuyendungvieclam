import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, MoreThan, Repository } from 'typeorm';
import { Application, ApplicationStatus } from '../database/entities/application.entity';
import { JobApprovalStatus, JobPosting } from '../database/entities/job-posting.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { Notification } from '../database/entities/notification.entity';
import { vnDateTime } from '../common/vn-datetime.util';
import { NotificationsService } from '../notifications/notifications.service';

const RUN_EVERY_MS = 60 * 60_000; // Đợt 46: 1 giờ/lần để nhắc lịch phỏng vấn kịp 24h trước
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
    @InjectRepository(JobPosting) private readonly jobRepo: Repository<JobPosting>,
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
      const interviews = await this.remindInterviews();
      const closing = await this.remindJobClosing();
      const savedClosing = await this.remindSavedJobsClosing().catch((e) => {
        this.log.warn(`Nhắc tin đã lưu sắp hết hạn lỗi: ${e?.message ?? e}`);
        return 0;
      });
      if (candidates || employers || interviews || closing || savedClosing)
        this.log.log(`Nhắc: ${candidates} ứng viên, ${employers} NTD, ${interviews} lịch phỏng vấn, ${closing} tin cần đóng/gia hạn, ${savedClosing} nhắc tin đã lưu sắp hết hạn`);
      return { candidates, employers };
    } finally {
      this.running = false;
    }
  }

  // Đợt 46 — nhắc lịch phỏng vấn trong vòng 24 giờ tới (1 lần/lịch) cho cả ứng viên và NTD.
  private async remindInterviews(): Promise<number> {
    const now = new Date();
    const soon = new Date(Date.now() + DAY);
    const apps = await this.appRepo.find({
      where: { interviewAt: Between(now, soon), interviewReminded: false, deletedAt: IsNull() },
      relations: { jobPosting: { company: true }, cv: true },
      take: 300,
    });
    for (const a of apps) {
      const when = vnDateTime(a.interviewAt!);
      const place = a.interviewPlace ? ` tại ${a.interviewPlace}` : '';
      const uid = a.cv?.candidateProfileId ? await this.userIdOfProfile(a.cv.candidateProfileId) : null;
      if (uid)
        await this.notifications.create(uid, 'interview_reminder', `Nhắc lịch: phỏng vấn "${a.jobPosting?.title}" lúc ${when}${place}.`, `/ho-so?app=${a.id}#applications`);
      const cus = await this.companyUserRepo.find({ where: { companyId: a.jobPosting.companyId } });
      await this.notifications.createMany(
        cus.map((c) => c.userId),
        'interview_reminder',
        `Nhắc lịch: phỏng vấn ứng viên cho "${a.jobPosting?.title}" lúc ${when}${place}.`,
        `/nha-tuyen-dung/ung-vien?job=${a.jobPostingId}`,
      );
      a.interviewReminded = true;
      await this.appRepo.save(a);
    }
    return apps.length;
  }

  // Đợt 46 — nhắc NTD đóng/gia hạn tin: (1) hạn nộp còn ≤ 3 ngày; (2) đã đủ ứng viên phù hợp
  // (số đơn "Phù hợp"/"Mời phỏng vấn" ≥ số lượng cần tuyển và tổng đơn ≥ 10). Mỗi loại 1 lần/tin.
  private async remindJobClosing(): Promise<number> {
    const today = new Date();
    const in3 = new Date(Date.now() + 3 * DAY);
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const jobs = await this.jobRepo
      .createQueryBuilder('j')
      .where('j.approval_status = :st', { st: JobApprovalStatus.APPROVED })
      .andWhere('j.is_paused = false')
      .andWhere('(j.deadline BETWEEN :a AND :b OR j.id IN (SELECT a.job_posting_id FROM applications a WHERE a.deleted_at IS NULL GROUP BY a.job_posting_id HAVING COUNT(*) >= 10))', {
        a: ymd(today),
        b: ymd(in3),
      })
      .take(500)
      .getMany();
    let sent = 0;
    for (const j of jobs) {
      const cus = await this.companyUserRepo.find({ where: { companyId: j.companyId } });
      const uids = cus.map((c) => c.userId);
      if (!uids.length) continue;
      const deadlineSoon = j.deadline && String(j.deadline) >= ymd(today) && String(j.deadline) <= ymd(in3);
      if (deadlineSoon) {
        const link = `/nha-tuyen-dung/tin-dang?job=${j.id}&n=deadline`;
        if (!(await this.notifRepo.exists({ where: { type: 'job_closing', link } }))) {
          await this.notifications.createMany(uids, 'job_closing', `Tin "${j.title}" hết hạn nộp vào ${String(j.deadline).split('-').reverse().join('/')}. Gia hạn nếu vẫn cần tuyển, hoặc để tin tự đóng.`, link);
          sent++;
        }
      }
      const counts = await this.appRepo
        .createQueryBuilder('a')
        .select('COUNT(*)', 'total')
        .addSelect(`COUNT(*) FILTER (WHERE a.status IN ('suitable','interview'))`, 'good')
        .where('a.job_posting_id = :id', { id: j.id })
        .getRawOne<{ total: string; good: string }>();
      if (Number(counts?.total) >= 10 && Number(counts?.good) >= Math.max(1, j.headcount ?? 1)) {
        const link = `/nha-tuyen-dung/tin-dang?job=${j.id}&n=full`;
        if (!(await this.notifRepo.exists({ where: { type: 'job_closing', link } }))) {
          await this.notifications.createMany(uids, 'job_closing', `Tin "${j.title}" đã có ${counts!.good} ứng viên phù hợp/mời phỏng vấn trên ${counts!.total} hồ sơ. Nếu đã tuyển đủ, hãy tạm ngưng tin để ứng viên khác không chờ đợi.`, link);
          sent++;
        }
      }
    }
    return sent;
  }

  // Đợt 52 — nhắc ứng viên: tin ĐÃ LƯU sắp hết hạn nộp (còn ≤ 3 ngày) mà chưa ứng tuyển. Mỗi tin 1 lần/ứng viên.
  private async remindSavedJobsClosing(): Promise<number> {
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const rows: { userId: string; jobId: string; title: string; deadline: string; company: string | null }[] =
      await this.appRepo.manager.query(
        `SELECT p.user_id AS "userId", j.id AS "jobId", j.title, j.deadline::text AS deadline, c.name AS company
           FROM saved_jobs sj
           JOIN candidate_profiles p ON p.id = sj.candidate_profile_id
           JOIN job_postings j ON j.id = sj.job_posting_id
           LEFT JOIN companies c ON c.id = j.company_id
          WHERE j.approval_status = $1 AND j.is_paused = false
            AND j.deadline BETWEEN $2 AND $3
            AND NOT EXISTS (
              SELECT 1 FROM applications a JOIN cvs v ON v.id = a.cv_id
               WHERE a.job_posting_id = j.id AND v.candidate_profile_id = p.id AND a.deleted_at IS NULL)
          LIMIT 500`,
        [JobApprovalStatus.APPROVED, ymd(new Date()), ymd(new Date(Date.now() + 3 * DAY))],
      );
    let sent = 0;
    for (const r of rows) {
      const link = `/viec-lam/${r.jobId}?n=saved-closing`;
      if (await this.notifRepo.exists({ where: { userId: r.userId, type: 'saved_job_closing', link } })) continue;
      const d = String(r.deadline).slice(0, 10).split('-').reverse().join('/');
      await this.notifications.create(
        r.userId,
        'saved_job_closing',
        `Tin bạn đã lưu "${r.title}"${r.company ? ` (${r.company})` : ''} hết hạn nộp ngày ${d}. Nộp hồ sơ ngay kẻo lỡ cơ hội.`,
        link,
      );
      sent++;
    }
    return sent;
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
