import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from '../database/entities/application.entity';
import { ApplicationStatusHistory } from '../database/entities/application-status-history.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CV, CvType } from '../database/entities/cv.entity';
import {
  JobPosting,
  JobApprovalStatus,
} from '../database/entities/job-posting.entity';
import { ApplyJobDto } from './dto/apply-job.dto';
import { GuestApplyDto } from './dto/guest-apply.dto';
import { vnDateTime } from '../common/vn-datetime.util';
import { NotificationsService } from '../notifications/notifications.service';
import { FileStorageService } from '../storage/file-storage.service';
import { CvArchiveService } from '../cv-archive/cv-archive.service';

// Đợt 22 — trần số đơn KHÁCH (không đăng nhập) nhận vào 1 tin trong 1 giờ.
const GUEST_MAX_PER_JOB_PER_HOUR = 60;

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(ApplicationStatusHistory)
    private readonly historyRepo: Repository<ApplicationStatusHistory>,
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(CV) private readonly cvRepo: Repository<CV>,
    @InjectRepository(JobPosting)
    private readonly jobRepo: Repository<JobPosting>,
    private readonly cvArchiveService: CvArchiveService,
    private readonly storage: FileStorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async apply(
    userId: string,
    jobId: string,
    dto: ApplyJobDto,
  ): Promise<Application> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');

    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job || job.approvalStatus !== JobApprovalStatus.APPROVED) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }

    // Đợt 21 (27/09/2026) — ứng viên chọn 1 trong 2 cách chia sẻ hồ sơ: (a) 1 CV có sẵn (file đã tải
    // lên hoặc link Google Drive), hoặc (b) dùng thẳng "Hồ sơ trực tuyến" đã điền (không cần file) —
    // tự tạo/dùng lại 1 bản ghi CV type=TEMPLATE gắn với hồ sơ (không tính vào giới hạn 2 CV file của
    // CandidatesService, xem cv.entity.ts CvType).
    let cv: CV;
    if (dto.useOnlineProfile) {
      if ((profile.completionPercent ?? 0) < 100) {
        throw new BadRequestException(
          'Hồ sơ trực tuyến chưa điền đủ 3 mục bắt buộc (Tiêu đề hồ sơ, Thông tin cá nhân, Kinh nghiệm làm việc) — vui lòng hoàn thiện hồ sơ hoặc chọn CV dạng file để ứng tuyển',
        );
      }
      const existingTemplate = await this.cvRepo.findOne({
        where: { candidateProfileId: profile.id, type: CvType.TEMPLATE },
      });
      cv =
        existingTemplate ??
        (await this.cvRepo.save(
          this.cvRepo.create({
            candidateProfileId: profile.id,
            type: CvType.TEMPLATE,
          }),
        ));
    } else {
      if (!dto.cvId) {
        throw new BadRequestException(
          'Vui lòng chọn CV hoặc dùng Hồ sơ trực tuyến để ứng tuyển',
        );
      }
      const found = await this.cvRepo.findOne({ where: { id: dto.cvId } });
      if (!found || found.candidateProfileId !== profile.id) {
        throw new BadRequestException(
          'CV không hợp lệ — vui lòng chọn CV trong hồ sơ của bạn',
        );
      }
      cv = found;
    }

    const existing = await this.applicationRepo.findOne({
      where: { jobPostingId: jobId, cv: { candidateProfileId: profile.id } },
      relations: { cv: true },
    });
    if (existing) {
      throw new ConflictException('Bạn đã ứng tuyển vào vị trí này rồi');
    }

    const application = this.applicationRepo.create({
      jobPostingId: jobId,
      cvId: cv.id,
      coverLetter: dto.coverLetter,
    });
    const saved = await this.applicationRepo.save(application);
    // Đợt 12o (21/09/2026) — ghi dòng đầu tiên của "Nhật ký trạng thái ứng tuyển" ngay khi nộp hồ
    // sơ (status mặc định 'new'), để ứng viên thấy đủ dòng thời gian ngay từ lúc ứng tuyển.
    await this.historyRepo.save(
      this.historyRepo.create({
        applicationId: saved.id,
        status: saved.status,
      }),
    );
    // Đợt 18a (26/09/2026) — tự động chụp toàn bộ hồ sơ + bản sao file CV vào "Kho CV" của NTD ngay khi
    // nộp. Lỗi ở bước này KHÔNG được làm hỏng việc ứng tuyển của ứng viên — chỉ ghi log; lần khởi động
    // server kế tiếp CvArchiveService.backfillAll() sẽ tự lưu bù.
    try {
      await this.cvArchiveService.archiveApplication(saved.id);
    } catch (err) {
      this.logger.warn(
        `Chưa lưu được Kho CV cho đơn ${saved.id}: ${(err as Error).message}`,
      );
    }
    return saved;
  }

  // Đợt 22 (29/09/2026) — ỨNG TUYỂN KHÔNG CẦN ĐĂNG NHẬP. Khách nhập họ tên/SĐT/email + 1 trong 2: file CV
  // hoặc link (Google Drive...). Không tạo tài khoản. Đơn dùng lại bảng `cvs` (candidate_profile_id rỗng +
  // guest_*) nên NTD thấy trong danh sách Ứng viên như mọi đơn khác, Kho CV tự chụp (CvArchiveService), và
  // thẻ Kho CV mặc định "chờ chia sẻ" → tự vào hàng chờ "Nguồn ngoài → CV ứng viên" của Admin.
  async applyAsGuest(
    jobId: string,
    dto: GuestApplyDto,
    file?: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
  ): Promise<{ id: string; message: string }> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job || job.approvalStatus !== JobApprovalStatus.APPROVED) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }
    const link = dto.cvLink?.trim() || '';
    if (!file && !link) {
      throw new BadRequestException(
        'Vui lòng tải file CV lên hoặc dán link CV (Google Drive...)',
      );
    }
    if (file && link) {
      throw new BadRequestException(
        'Chỉ chọn 1 trong 2: tải file CV hoặc dán link CV',
      );
    }

    // Chặn dồn dập vào 1 tin (bổ sung cho giới hạn theo IP ở controller — kẻ spam đổi IP/email vẫn bị chặn).
    const lastHour = await this.applicationRepo
      .createQueryBuilder('a')
      .withDeleted()
      .innerJoin('a.cv', 'cv')
      .where('a.job_posting_id = :jobId', { jobId })
      .andWhere('cv.candidate_profile_id IS NULL')
      .andWhere("a.applied_at > now() - interval '1 hour'")
      .getCount();
    if (lastHour >= GUEST_MAX_PER_JOB_PER_HOUR) {
      throw new HttpException(
        'Tin này đang nhận quá nhiều hồ sơ trong thời gian ngắn, vui lòng thử lại sau ít phút hoặc đăng nhập để ứng tuyển',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const email = dto.email.trim().toLowerCase();
    // Mỗi email chỉ ứng tuyển 1 lần cho 1 tin (tính cả đơn NTD đã chuyển vào thùng rác — tránh nộp lặp
    // để "làm phiền").
    const dupGuest = await this.applicationRepo
      .createQueryBuilder('a')
      .withDeleted()
      .innerJoin('a.cv', 'cv')
      .where('a.job_posting_id = :jobId', { jobId })
      .andWhere('LOWER(cv.guest_email) = :email', { email })
      .getCount();
    if (dupGuest > 0)
      throw new ConflictException('Email này đã ứng tuyển vào vị trí này rồi');

    const storageKey = file
      ? await this.storage.put(file.buffer, {
          name: file.originalname,
          mime: file.mimetype,
          category: 'cv',
        })
      : null;
    const cv = await this.cvRepo.save(
      this.cvRepo.create({
        candidateProfileId: null,
        type: CvType.UPLOAD,
        guestFullName: dto.fullName.trim(),
        guestPhone: dto.phone.trim(),
        guestEmail: email,
        originalFileName: file?.originalname,
        fileData: file && !storageKey ? file.buffer : undefined,
        fileStorageKey: storageKey,
        fileMimeType: file?.mimetype,
        externalLinkUrl: link || undefined,
        isPrimary: true,
      }),
    );
    let saved: Application;
    try {
      if (file) {
        cv.fileUrl = `/files/cv/${cv.id}`;
        await this.cvRepo.save(cv);
      }
      saved = await this.applicationRepo.save(
        this.applicationRepo.create({
          jobPostingId: jobId,
          cvId: cv.id,
          coverLetter: dto.coverLetter?.trim() || undefined,
        }),
      );
    } catch (err) {
      await this.cvRepo.delete({ id: cv.id }).catch(() => undefined);
      throw err;
    }
    await this.historyRepo.save(
      this.historyRepo.create({
        applicationId: saved.id,
        status: saved.status,
      }),
    );
    try {
      await this.cvArchiveService.archiveApplication(saved.id);
    } catch (err) {
      this.logger.warn(
        `Chưa lưu được Kho CV cho đơn khách ${saved.id}: ${(err as Error).message}`,
      );
    }
    return {
      id: saved.id,
      message:
        'Đã gửi hồ sơ ứng tuyển. Nhà tuyển dụng sẽ liên hệ với bạn qua số điện thoại/email đã nhập.',
    };
  }

  async listOwn(userId: string) {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) return [];
    // Đợt 11b — .withDeleted(): NTD "chuyển vào thùng rác" ở ATS của họ (mục #4) chỉ là cách họ tự
    // sắp xếp hồ sơ ứng tuyển nhận được, KHÔNG được làm mất lịch sử ứng tuyển thật của ứng viên —
    // ứng viên phải luôn thấy đơn mình đã nộp trong "Việc làm của tôi" dù NTD có xoá mềm phía họ.
    return this.applicationRepo
      .createQueryBuilder('application')
      .withDeleted()
      .leftJoinAndSelect('application.jobPosting', 'job')
      .leftJoinAndSelect('job.company', 'company')
      .leftJoinAndSelect('application.cv', 'cv')
      .where('cv.candidateProfileId = :profileId', { profileId: profile.id })
      .orderBy('application.appliedAt', 'DESC')
      .getMany();
  }

  // Đợt 46 — ứng viên chọn 1 trong các khung giờ phỏng vấn NTD đề xuất.
  async chooseInterview(userId: string, applicationId: string, slot: string) {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');
    const app = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: { cv: true, jobPosting: { company: true } },
    });
    if (!app || app.cv?.candidateProfileId !== profile.id) throw new NotFoundException('Không tìm thấy đơn ứng tuyển');
    const iso = new Date(slot).toISOString();
    if (!(app.interviewSlots ?? []).includes(iso)) throw new BadRequestException('Khung giờ không nằm trong đề xuất của nhà tuyển dụng');
    if (new Date(iso).getTime() < Date.now()) throw new BadRequestException('Khung giờ này đã qua');
    app.interviewAt = new Date(iso);
    app.interviewReminded = false;
    await this.applicationRepo.save(app);
    const when = vnDateTime(new Date(iso));
    const cus = await this.applicationRepo.manager
      .createQueryBuilder()
      .select('cu.user_id', 'userId')
      .from('company_users', 'cu')
      .where('cu.company_id = :cid', { cid: app.jobPosting.companyId })
      .getRawMany<{ userId: string }>();
    await this.notificationsService.createMany(
      cus.map((c) => c.userId),
      'interview_confirmed',
      `${profile.fullName} đã chọn giờ phỏng vấn ${when} cho vị trí "${app.jobPosting.title}".`,
      `/nha-tuyen-dung/ung-vien?job=${app.jobPostingId}`,
    );
    return { interviewAt: app.interviewAt };
  }

  // Đợt 12o (21/09/2026) — "Nhật ký trạng thái ứng tuyển": ứng viên xem dòng thời gian xử lý đơn
  // ứng tuyển của chính mình (mỗi lần NTD đổi trạng thái đều được ghi lại, xem
  // EmployerService.updateApplicationStatus()).
  async getHistory(
    userId: string,
    applicationId: string,
  ): Promise<ApplicationStatusHistory[]> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');
    const application = await this.applicationRepo
      .createQueryBuilder('application')
      .withDeleted()
      .leftJoinAndSelect('application.cv', 'cv')
      .where('application.id = :applicationId', { applicationId })
      .getOne();
    if (!application || application.cv?.candidateProfileId !== profile.id) {
      throw new ForbiddenException('Bạn không có quyền xem đơn ứng tuyển này');
    }
    return this.historyRepo.find({
      where: { applicationId },
      order: { createdAt: 'ASC' },
    });
  }
}
