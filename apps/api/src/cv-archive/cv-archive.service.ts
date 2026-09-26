import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import {
  CvArchiveCandidate,
  CvArchiveEntry,
  CvArchiveSnapshot,
} from '../database/entities/cv-archive.entity';
import { Application } from '../database/entities/application.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CV } from '../database/entities/cv.entity';
import { User } from '../database/entities/user.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import {
  CandidateExperience,
  CandidateEducation,
  CandidateCertificate,
  CandidateLanguage,
  CandidateSkill,
  CandidateAchievement,
  CandidateActivity,
  CandidateReference,
} from '../database/entities/candidate-sections.entity';
import {
  digitsOnly,
  normalizeSearchText,
  stripHtml,
} from '../common/search-text.util';
import { extractCvText, CvTextStatus } from '../common/cv-text.util';
import { parseCvText, ParsedCv } from '../common/cv-parser.util';
import { fetchPageText } from '../common/page-text.util';
import { CandidateDraftDto } from '../common/dto/candidate-draft.dto';
import { draftToSnapshot, parsedToDraft } from '../common/candidate-draft.util';
import { ListCvArchiveQueryDto } from './dto/list-cv-archive-query.dto';

// Đợt 18a (26/09/2026) — "Kho CV" của nhà tuyển dụng. Xem cv-archive.entity.ts để biết lý do thiết
// kế 2 bảng tách khỏi chuỗi CASCADE của tài khoản ứng viên.
//
// Luồng:
//  1. Mỗi lần ứng viên bấm Ứng tuyển → ApplicationsService.apply() gọi archiveApplication() ngay.
//  2. Mỗi lần server khởi động → backfillAll() chạy nền, "lưu bù" mọi đơn ứng tuyển chưa có bản chụp
//     (đơn nộp trước Đợt 18a, đơn tạo bởi dữ liệu mẫu, hoặc lần chụp nào lỡ lỗi). Idempotent nhờ
//     unique(application_id) nên chạy lại bao nhiêu lần cũng không tạo trùng.
// Lưu ý: bản chụp của đơn được "lưu bù" là hồ sơ ở thời điểm lưu bù (không còn cách nào biết hồ sơ lúc
// nộp trước đây trông thế nào) — từ Đợt 18a trở đi mới là bản chụp đúng thời điểm nộp.
//
// Đợt 18b — đọc CHỮ từ file CV (PDF/DOCX) ngay khi chụp + tách mục theo quy tắc; lưu toàn văn vào bản
// chụp và vào chữ tìm kiếm của thẻ. backfillCvText() đọc bù file của các bản chụp cũ.
// Đợt 18d — NTD tự nhập CV từ nguồn ngoài (importFromDraft).

const IMPORT_JOB_TITLE = 'CV nhập từ nguồn ngoài';
const MAX_CV_TEXT_IN_SEARCH = 20_000;

type CardIdentity = {
  profileId: string | null;
  email: string | null;
  phone: string | null;
};

@Injectable()
export class CvArchiveService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CvArchiveService.name);
  private backfillRunning = false;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CvArchiveCandidate)
    private readonly cardRepo: Repository<CvArchiveCandidate>,
    @InjectRepository(CvArchiveEntry)
    private readonly entryRepo: Repository<CvArchiveEntry>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(CV) private readonly cvRepo: Repository<CV>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(CompanyUser)
    private readonly companyUserRepo: Repository<CompanyUser>,
    @InjectRepository(JobPosting)
    private readonly jobRepo: Repository<JobPosting>,
    @InjectRepository(CandidateExperience)
    private readonly experienceRepo: Repository<CandidateExperience>,
    @InjectRepository(CandidateEducation)
    private readonly educationRepo: Repository<CandidateEducation>,
    @InjectRepository(CandidateCertificate)
    private readonly certificateRepo: Repository<CandidateCertificate>,
    @InjectRepository(CandidateLanguage)
    private readonly languageRepo: Repository<CandidateLanguage>,
    @InjectRepository(CandidateSkill)
    private readonly skillRepo: Repository<CandidateSkill>,
    @InjectRepository(CandidateAchievement)
    private readonly achievementRepo: Repository<CandidateAchievement>,
    @InjectRepository(CandidateActivity)
    private readonly activityRepo: Repository<CandidateActivity>,
    @InjectRepository(CandidateReference)
    private readonly referenceRepo: Repository<CandidateReference>,
  ) {}

  // ===================================================================================================
  // Chụp & lưu
  // ===================================================================================================

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    // Chạy nền, KHÔNG chặn server khởi động (Render cần cổng mở sớm để báo "Live").
    setTimeout(() => {
      void this.backfillAll().then(() => this.backfillCvText());
    }, 5_000);
  }

  // Lưu bù mọi đơn ứng tuyển chưa có bản chụp. Theo lô 200 đơn, bộ nhớ đệm bản chụp theo hồ sơ trong
  // từng lô (1 ứng viên thường nộp nhiều đơn → giảm mạnh số lần đọc lại hồ sơ 13 mục).
  async backfillAll(): Promise<number> {
    if (this.backfillRunning) return 0;
    this.backfillRunning = true;
    const skipped = new Set<string>();
    let created = 0;
    try {
      for (;;) {
        const qb = this.applicationRepo
          .createQueryBuilder('a')
          .withDeleted()
          .select('a.id', 'id')
          .leftJoin(CvArchiveEntry, 'e', 'e.application_id = a.id')
          .where('e.id IS NULL')
          .orderBy('a.applied_at', 'ASC')
          .limit(200);
        if (skipped.size > 0)
          qb.andWhere('a.id NOT IN (:...skipped)', { skipped: [...skipped] });
        const rows = await qb.getRawMany<{ id: string }>();
        if (rows.length === 0) break;
        const cache = new Map<string, CvArchiveSnapshot>();
        for (const row of rows) {
          try {
            if (await this.archiveApplication(row.id, cache)) created++;
            else skipped.add(row.id);
          } catch (err) {
            skipped.add(row.id);
            this.logger.warn(
              `Không lưu được Kho CV cho đơn ${row.id}: ${(err as Error).message}`,
            );
          }
        }
      }
      if (created > 0)
        this.logger.log(`Kho CV: đã lưu bù ${created} đơn ứng tuyển.`);
    } catch (err) {
      this.logger.error(`Kho CV: lỗi khi lưu bù — ${(err as Error).message}`);
    } finally {
      this.backfillRunning = false;
    }
    return created;
  }

  // Đợt 18b — đọc bù chữ từ file CV của các bản chụp chưa đọc (cv_text_status IS NULL). Mỗi bản chụp
  // chỉ đọc 1 lần (kể cả khi file không đọc được → lưu trạng thái 'empty'/'unsupported'/'error').
  async backfillCvText(): Promise<number> {
    let done = 0;
    try {
      for (;;) {
        const batch = await this.entryRepo.find({
          where: { cvHasFile: true, cvTextStatus: IsNull() },
          select: {
            id: true,
            archiveCandidateId: true,
            cvFileData: true,
            cvMimeType: true,
            cvFileName: true,
          },
          take: 30,
        });
        if (batch.length === 0) break;
        for (const e of batch) {
          const { status, text, parsed } = await this.readFile(
            e.cvFileData,
            e.cvMimeType,
            e.cvFileName,
          );
          await this.entryRepo.update(
            { id: e.id },
            { cvText: text || null, cvParsed: parsed, cvTextStatus: status },
          );
          if (status === 'ok')
            await this.dataSource.transaction((m) =>
              this.refreshCard(m, e.archiveCandidateId),
            );
          done++;
        }
      }
      if (done > 0) this.logger.log(`Kho CV: đã đọc bù ${done} file CV.`);
    } catch (err) {
      this.logger.error(
        `Kho CV: lỗi khi đọc bù file CV — ${(err as Error).message}`,
      );
    }
    return done;
  }

  private async readFile(
    data: Buffer | null | undefined,
    mime?: string | null,
    fileName?: string | null,
  ): Promise<{ status: CvTextStatus; text: string; parsed: ParsedCv | null }> {
    const res = await extractCvText(data, mime, fileName);
    return {
      ...res,
      parsed: res.status === 'ok' ? parseCvText(res.text) : null,
    };
  }

  // Chụp 1 đơn ứng tuyển vào Kho CV của công ty sở hữu tin. Trả về true nếu vừa tạo bản chụp mới,
  // false nếu đã có sẵn / không đủ dữ liệu để chụp.
  async archiveApplication(
    applicationId: string,
    cache?: Map<string, CvArchiveSnapshot>,
  ): Promise<boolean> {
    const already = await this.entryRepo.findOne({
      where: { applicationId },
      select: { id: true },
    });
    if (already) return false;

    const app = await this.applicationRepo.findOne({
      where: { id: applicationId },
      withDeleted: true,
      relations: { jobPosting: true },
    });
    if (!app || !app.jobPosting) return false;

    const cv = await this.cvRepo.findOne({
      where: { id: app.cvId },
      select: {
        id: true,
        candidateProfileId: true,
        type: true,
        originalFileName: true,
        fileMimeType: true,
        fileData: true,
        externalLinkUrl: true,
      },
    });
    if (!cv) return false;

    let snapshot = cache?.get(cv.candidateProfileId);
    if (!snapshot) {
      snapshot = (await this.buildSnapshot(cv.candidateProfileId)) ?? undefined;
      if (!snapshot) return false;
      cache?.set(cv.candidateProfileId, snapshot);
    }

    // Đợt 18b — đọc chữ file CV (nếu có) TRƯỚC giao dịch (có thể mất vài trăm ms với PDF dài).
    const file = cv.fileData
      ? await this.readFile(cv.fileData, cv.fileMimeType, cv.originalFileName)
      : null;

    const identity: CardIdentity = {
      profileId: cv.candidateProfileId,
      email:
        (
          snapshot.contactEmail ||
          snapshot.accountEmail ||
          file?.parsed?.email ||
          ''
        ).trim() || null,
      phone: (snapshot.phone || file?.parsed?.phone || '').trim() || null,
    };

    return this.dataSource.transaction(async (m) => {
      const again = await m.findOne(CvArchiveEntry, {
        where: { applicationId },
        select: { id: true },
      });
      if (again) return false;
      const cardId = await this.upsertCard(
        m,
        app.jobPosting.companyId,
        identity,
        snapshot,
        app.appliedAt,
      );
      await m.save(
        CvArchiveEntry,
        m.create(CvArchiveEntry, {
          archiveCandidateId: cardId,
          companyId: app.jobPosting.companyId,
          applicationId: app.id,
          jobPostingId: app.jobPostingId,
          jobTitle: app.jobPosting.title,
          appliedAt: app.appliedAt,
          coverLetter: app.coverLetter ?? null,
          profileSnapshot: snapshot,
          cvType: cv.type ?? null,
          cvFileName: cv.originalFileName ?? null,
          cvMimeType: cv.fileMimeType ?? null,
          cvFileData: cv.fileData ?? null,
          cvHasFile: !!cv.fileData,
          cvExternalLink: cv.externalLinkUrl ?? null,
          cvText: file?.text || null,
          cvParsed: file?.parsed ?? null,
          cvTextStatus: file ? file.status : null,
          entrySource: 'application',
        }),
      );
      await this.refreshCard(m, cardId);
      return true;
    });
  }

  // Tạo mới hoặc cập nhật thẻ của 1 người trong kho công ty; trả về id thẻ.
  private async upsertCard(
    m: EntityManager,
    companyId: string,
    identity: CardIdentity,
    snapshot: CvArchiveSnapshot,
    appliedAt: Date,
  ): Promise<string> {
    const existing = await this.findCard(m, companyId, identity);
    const isNewest =
      !existing || appliedAt.getTime() >= existing.lastAppliedAt.getTime();
    const fields: Partial<CvArchiveCandidate> = {};
    // Thông tin nhận diện trên thẻ luôn theo lần nộp MỚI NHẤT (bản chụp từng lần vẫn giữ nguyên).
    if (isNewest) {
      if (identity.profileId) fields.candidateProfileId = identity.profileId;
      fields.fullName = snapshot.fullName || 'Ứng viên';
      fields.phone = identity.phone;
      fields.email = identity.email;
      fields.province = snapshot.province ?? null;
      fields.headline =
        snapshot.profileTitle || snapshot.desiredPosition || null;
      fields.yearsOfExperience = snapshot.yearsOfExperience ?? null;
      fields.skillsText =
        snapshot.skills.map((s) => s.skillName).join(', ') || null;
    }
    // Có hồ sơ MỚI sau khi NTD đã đưa thẻ vào thùng rác → tự đưa thẻ trở lại kho.
    if (
      existing?.deletedAt &&
      appliedAt.getTime() > existing.deletedAt.getTime()
    )
      fields.deletedAt = null;

    // Dùng insert/update tường minh thay vì save(): save() phải nạp lại bản ghi để so sánh, mà bản ghi
    // đang ở thùng rác (xoá mềm) có thể bị bỏ qua khi nạp lại → TypeORM tưởng là bản ghi mới.
    if (existing) {
      if (Object.keys(fields).length > 0)
        await m.update(CvArchiveCandidate, { id: existing.id }, fields);
      return existing.id;
    }
    const created = await m.save(
      CvArchiveCandidate,
      m.create(CvArchiveCandidate, {
        companyId,
        lastAppliedAt: appliedAt,
        searchText: '',
        ...fields,
      }),
    );
    return created.id;
  }

  // Tìm thẻ sẵn có của CÙNG 1 người trong kho công ty: cùng hồ sơ, HOẶC cùng email, HOẶC cùng SĐT
  // (so theo chữ số, ≥ 8 số để tránh khớp nhầm) — nhận ra cả trường hợp ứng viên xoá tài khoản rồi tạo
  // tài khoản mới nộp lại. Tìm cả thẻ đang ở thùng rác.
  private async findCard(
    m: EntityManager,
    companyId: string,
    identity: CardIdentity,
  ): Promise<CvArchiveCandidate | null> {
    const conds: string[] = [];
    const params: Record<string, string> = { companyId };
    if (identity.profileId) {
      conds.push('c.candidate_profile_id = :profileId');
      params.profileId = identity.profileId;
    }
    if (identity.email) {
      conds.push('LOWER(c.email) = :email');
      params.email = identity.email.toLowerCase();
    }
    const phoneDigits = digitsOnly(identity.phone);
    if (phoneDigits.length >= 8) {
      conds.push(
        `regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = :phoneDigits`,
      );
      params.phoneDigits = phoneDigits;
    }
    if (conds.length === 0) return null;
    return m
      .getRepository(CvArchiveCandidate)
      .createQueryBuilder('c')
      .withDeleted()
      .where('c.company_id = :companyId')
      .andWhere(`(${conds.join(' OR ')})`)
      .setParameters(params)
      .orderBy('c.last_applied_at', 'DESC')
      .getOne();
  }

  // Tính lại số lần ứng tuyển, lần nộp gần nhất và chữ tìm kiếm (hồ sơ mới nhất + mọi vị trí đã nộp +
  // chữ đọc từ mọi file CV — Đợt 18b).
  async refreshCard(m: EntityManager, cardId: string) {
    const entries = await m.find(CvArchiveEntry, {
      where: { archiveCandidateId: cardId },
      select: { id: true, jobTitle: true, appliedAt: true, cvText: true },
      order: { appliedAt: 'DESC' },
    });
    if (entries.length === 0) return;
    const latest = await m.findOne(CvArchiveEntry, {
      where: { id: entries[0].id },
      select: { id: true, profileSnapshot: true },
    });
    const jobTitles = [...new Set(entries.map((e) => e.jobTitle))].join(' ');
    const cvTexts = [
      ...new Set(
        entries.map((e) => (e.cvText ?? '').slice(0, MAX_CV_TEXT_IN_SEARCH)),
      ),
    ].join(' ');
    await m.update(
      CvArchiveCandidate,
      { id: cardId },
      {
        applicationCount: entries.length,
        lastAppliedAt: entries[0].appliedAt,
        searchText: normalizeSearchText(
          [
            latest ? snapshotToText(latest.profileSnapshot) : '',
            jobTitles,
            cvTexts,
          ].join(' '),
        ),
      },
    );
  }

  // Đọc TOÀN BỘ hồ sơ 13 mục hiện tại của ứng viên thành 1 bản chụp độc lập. Dùng chung cho Kho CV
  // (18a) và Admin (18c/18f: tạo hồ sơ nguồn tổng hợp, xem hồ sơ ứng viên).
  async buildSnapshot(profileId: string): Promise<CvArchiveSnapshot | null> {
    const p = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!p) return null;
    const user = await this.userRepo.findOne({
      where: { id: p.userId },
      select: { id: true, email: true },
    });
    const byProfile = { where: { candidateProfileId: profileId } };
    const [
      experiences,
      educations,
      certificates,
      languages,
      skills,
      achievements,
      activities,
      references,
    ] = await Promise.all([
      this.experienceRepo.find({ ...byProfile, order: { startDate: 'DESC' } }),
      this.educationRepo.find({ ...byProfile, order: { startDate: 'DESC' } }),
      this.certificateRepo.find(byProfile),
      this.languageRepo.find(byProfile),
      this.skillRepo.find(byProfile),
      this.achievementRepo.find(byProfile),
      this.activityRepo.find(byProfile),
      this.referenceRepo.find(byProfile),
    ]);
    return {
      // Hồ sơ nguồn tổng hợp dùng email giả nội bộ — không đưa email đó vào bản chụp.
      accountEmail:
        user?.email && !user.email.endsWith('.invalid') ? user.email : null,
      fullName: p.fullName,
      lastName: p.lastName ?? null,
      firstName: p.firstName ?? null,
      profileTitle: p.profileTitle ?? null,
      dateOfBirth: p.dateOfBirth ?? null,
      gender: p.gender ?? null,
      phone: p.phone ?? null,
      contactEmail: p.contactEmail ?? null,
      nationality: p.nationality ?? null,
      maritalStatus: p.maritalStatus ?? null,
      country: p.country ?? null,
      province: p.province ?? null,
      district: p.district ?? null,
      address: p.address ?? null,
      careerObjective: p.careerObjective ?? null,
      desiredPosition: p.desiredPosition ?? null,
      desiredLevel: p.desiredLevel ?? null,
      desiredSalaryMin: p.desiredSalaryMin ?? null,
      desiredSalaryMax: p.desiredSalaryMax ?? null,
      salaryCurrency: p.salaryCurrency ?? null,
      desiredIndustries: p.desiredIndustries ?? null,
      desiredLocations: p.desiredLocations ?? null,
      desiredJobTypes: p.desiredJobTypes ?? null,
      yearsOfExperience: p.yearsOfExperience ?? null,
      currentLevel: p.currentLevel ?? null,
      highestDegree: p.highestDegree ?? null,
      experiences: experiences.map((e) => ({
        position: e.position,
        companyName: e.companyName ?? null,
        startDate: e.startDate ?? null,
        endDate: e.endDate ?? null,
        isCurrent: e.isCurrent,
        description: e.description ?? null,
      })),
      educations: educations.map((e) => ({
        schoolName: e.schoolName ?? null,
        degree: e.degree ?? null,
        major: e.major ?? null,
        startDate: e.startDate ?? null,
        endDate: e.endDate ?? null,
      })),
      certificates: certificates.map((c) => ({
        name: c.name,
        issuer: c.issuer ?? null,
        issueDate: c.issueDate ?? null,
      })),
      languages: languages.map((l) => ({
        language: l.language,
        level: l.level,
      })),
      skills: skills.map((s) => ({ skillName: s.skillName, level: s.level })),
      achievements: achievements.map((a) => ({
        title: a.title,
        description: a.description ?? null,
        date: a.date ?? null,
      })),
      activities: activities.map((a) => ({
        title: a.title,
        organizationName: a.organizationName ?? null,
        startDate: a.startDate ?? null,
        endDate: a.endDate ?? null,
        description: a.description ?? null,
      })),
      references: references.map((r) => ({
        fullName: r.fullName,
        position: r.position ?? null,
        company: r.company ?? null,
        phone: r.phone ?? null,
        email: r.email ?? null,
      })),
    };
  }

  // ===================================================================================================
  // Đọc/tách CV cho các form (dùng chung Admin + NTD)
  // ===================================================================================================

  parseText(text: string) {
    const clean = (text ?? '').slice(0, 100_000);
    const parsed = parseCvText(clean);
    return {
      status: 'ok' as const,
      text: clean,
      parsed,
      draft: parsedToDraft(parsed, clean),
    };
  }

  async parseFile(buffer: Buffer, mime?: string, fileName?: string) {
    const { status, text, parsed } = await this.readFile(
      buffer,
      mime,
      fileName,
    );
    const warning =
      status === 'unsupported'
        ? 'Định dạng file này (VD .doc đời cũ, ảnh) không đọc được chữ tự động — vui lòng nhập tay hoặc dán nội dung.'
        : status === 'empty'
          ? 'File không có chữ đọc được (có thể là ảnh scan) — vui lòng nhập tay hoặc dán nội dung.'
          : status === 'error'
            ? 'Không đọc được file này — vui lòng thử file khác hoặc dán nội dung.'
            : undefined;
    return {
      status,
      text,
      parsed,
      warning,
      draft: parsedToDraft(parsed ?? null, text),
    };
  }

  async parseUrl(url: string) {
    const res = await fetchPageText(url);
    if (res.ok === false) {
      return {
        status: 'error' as const,
        text: '',
        parsed: null,
        warning: res.warning,
        draft: parsedToDraft(null),
      };
    }
    const parsed = parseCvText(res.text);
    return {
      status: 'ok' as const,
      text: res.text,
      parsed,
      warning: undefined,
      draft: { ...parsedToDraft(parsed, res.text), sourceUrl: url },
    };
  }

  // ===================================================================================================
  // API cho nhà tuyển dụng
  // ===================================================================================================

  async getCompanyId(userId: string): Promise<string> {
    const link = await this.companyUserRepo.findOne({ where: { userId } });
    if (!link)
      throw new ForbiddenException('Tài khoản chưa liên kết với công ty nào');
    return link.companyId;
  }

  // Đợt 18d (26/09/2026) — NTD tự nhập CV lấy từ nguồn ngoài (dán nội dung / tải file / dán link, đã xem
  // lại trên form) vào Kho CV riêng của công ty. Theo lựa chọn người dùng, CV này CŨNG vào hàng chờ
  // chia sẻ của Admin (share_status mặc định 'pending') như CV ứng tuyển.
  async importFromDraft(
    userId: string,
    dto: CandidateDraftDto,
    file?: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    const companyId = await this.getCompanyId(userId);
    let jobTitle = IMPORT_JOB_TITLE;
    let jobPostingId: string | null = null;
    if (dto.jobPostingId) {
      const job = await this.jobRepo.findOne({
        where: { id: dto.jobPostingId, companyId },
      });
      if (!job)
        throw new BadRequestException(
          'Tin tuyển dụng không thuộc công ty của bạn',
        );
      jobTitle = job.title;
      jobPostingId = job.id;
    }
    const snapshot = draftToSnapshot(dto);
    const fileRead = file
      ? await this.readFile(file.buffer, file.mimetype, file.originalname)
      : null;
    const rawText = (dto.rawText ?? '').trim() || fileRead?.text || '';
    const parsed = rawText ? parseCvText(rawText) : null;
    const identity: CardIdentity = {
      profileId: null,
      email: snapshot.contactEmail ?? null,
      phone: snapshot.phone ?? null,
    };
    const now = new Date();
    const cardId = await this.dataSource.transaction(async (m) => {
      const id = await this.upsertCard(m, companyId, identity, snapshot, now);
      await m.save(
        CvArchiveEntry,
        m.create(CvArchiveEntry, {
          archiveCandidateId: id,
          companyId,
          applicationId: null,
          jobPostingId,
          jobTitle,
          appliedAt: now,
          coverLetter: dto.sourceLabel ? `Nguồn: ${dto.sourceLabel}` : null,
          profileSnapshot: snapshot,
          cvType: file ? 'upload' : null,
          cvFileName: file?.originalname ?? null,
          cvMimeType: file?.mimetype ?? null,
          cvFileData: file?.buffer ?? null,
          cvHasFile: !!file,
          cvExternalLink: dto.sourceUrl?.trim() || null,
          cvText: rawText || null,
          cvParsed: parsed,
          cvTextStatus: rawText ? 'ok' : (fileRead?.status ?? null),
          entrySource: 'employer_import',
        }),
      );
      await this.refreshCard(m, id);
      return id;
    });
    return { id: cardId };
  }

  async list(userId: string, query: ListCvArchiveQueryDto) {
    const companyId = await this.getCompanyId(userId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.cardRepo
      .createQueryBuilder('c')
      .withDeleted()
      .where('c.company_id = :companyId', { companyId })
      .andWhere(
        query.trash ? 'c.deleted_at IS NOT NULL' : 'c.deleted_at IS NULL',
      );

    // Mỗi từ khoá phải khớp (AND) — "ke toan ha noi" ra người vừa có "kế toán" vừa ở "Hà Nội".
    const terms = normalizeSearchText(query.q)
      .split(' ')
      .filter(Boolean)
      .slice(0, 8);
    terms.forEach((term, i) => {
      const escaped = term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
      qb.andWhere(`c.search_text LIKE :t${i}`, { [`t${i}`]: `%${escaped}%` });
    });
    if (query.jobId) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM cv_archive_entries e WHERE e.archive_candidate_id = c.id AND e.job_posting_id = :jobId)',
        { jobId: query.jobId },
      );
    }

    const [cards, total] = await qb
      .orderBy('c.last_applied_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const [activeCount, trashCount] = await Promise.all([
      this.cardRepo
        .createQueryBuilder('c')
        .where('c.company_id = :companyId', { companyId })
        .getCount(),
      this.cardRepo
        .createQueryBuilder('c')
        .withDeleted()
        .where('c.company_id = :companyId', { companyId })
        .andWhere('c.deleted_at IS NOT NULL')
        .getCount(),
    ]);

    const ids = cards.map((c) => c.id);
    const entries = ids.length
      ? await this.entryRepo.find({
          where: { archiveCandidateId: In(ids) },
          select: {
            id: true,
            archiveCandidateId: true,
            jobTitle: true,
            jobPostingId: true,
            appliedAt: true,
            entrySource: true,
          },
          order: { appliedAt: 'DESC' },
        })
      : [];
    const deletedAccounts = await this.findDeletedAccounts(cards);

    return {
      items: cards.map((c) => ({
        ...this.cardSummary(c, deletedAccounts),
        positions: entries
          .filter((e) => e.archiveCandidateId === c.id)
          .map((e) => ({
            entryId: e.id,
            jobPostingId: e.jobPostingId,
            jobTitle: e.jobTitle,
            appliedAt: e.appliedAt,
            entrySource: e.entrySource,
          })),
      })),
      total,
      page,
      pageSize,
      activeCount,
      trashCount,
    };
  }

  // Danh sách tin để lọc — lấy từ chính Kho CV (kể cả tin đã bị xoá, vì đã chép sẵn tên vị trí).
  async listJobs(userId: string) {
    const companyId = await this.getCompanyId(userId);
    const rows = await this.entryRepo
      .createQueryBuilder('e')
      .select('e.job_posting_id', 'jobId')
      .addSelect('MAX(e.job_title)', 'jobTitle')
      .addSelect('COUNT(DISTINCT e.archive_candidate_id)', 'count')
      .where('e.company_id = :companyId', { companyId })
      .andWhere('e.job_posting_id IS NOT NULL')
      .groupBy('e.job_posting_id')
      .orderBy('MAX(e.applied_at)', 'DESC')
      .getRawMany<{ jobId: string; jobTitle: string; count: string }>();
    return rows.map((r) => ({
      jobId: r.jobId,
      jobTitle: r.jobTitle,
      count: Number(r.count),
    }));
  }

  async detail(userId: string, id: string) {
    const companyId = await this.getCompanyId(userId);
    return this.detailForCompany(companyId, id);
  }

  // Dùng chung cho NTD (giới hạn công ty) và Admin (18c — xem trước thẻ trong hàng chờ, companyId null).
  async detailForCompany(companyId: string | null, id: string) {
    const card = await this.cardRepo.findOne({
      where: companyId ? { id, companyId } : { id },
      withDeleted: true,
    });
    if (!card) throw new NotFoundException('Không tìm thấy hồ sơ trong Kho CV');
    const entries = await this.entryRepo.find({
      where: { archiveCandidateId: card.id },
      order: { appliedAt: 'DESC' },
    });
    const texts = entries.length
      ? await this.entryRepo.find({
          where: { id: In(entries.map((e) => e.id)) },
          select: { id: true, cvText: true },
        })
      : [];
    const textById = new Map(texts.map((t) => [t.id, t.cvText ?? null]));
    const deletedAccounts = await this.findDeletedAccounts([card]);
    return {
      ...this.cardSummary(card, deletedAccounts),
      entries: entries.map((e) => ({
        id: e.id,
        applicationId: e.applicationId ?? null,
        jobPostingId: e.jobPostingId ?? null,
        jobTitle: e.jobTitle,
        appliedAt: e.appliedAt,
        coverLetter: e.coverLetter ?? null,
        cvType: e.cvType ?? null,
        cvFileName: e.cvFileName ?? null,
        cvHasFile: e.cvHasFile,
        cvExternalLink: e.cvExternalLink ?? null,
        entrySource: e.entrySource,
        cvTextStatus: e.cvTextStatus ?? null,
        cvParsed: e.cvParsed ?? null,
        cvText: textById.get(e.id) ?? null,
        snapshot: e.profileSnapshot,
      })),
    };
  }

  async getFile(userId: string, entryId: string) {
    const companyId = await this.getCompanyId(userId);
    return this.getFileForCompany(companyId, entryId);
  }

  async getFileForCompany(companyId: string | null, entryId: string) {
    const entry = await this.entryRepo.findOne({
      where: companyId ? { id: entryId, companyId } : { id: entryId },
      select: {
        id: true,
        cvFileData: true,
        cvMimeType: true,
        cvFileName: true,
      },
    });
    if (!entry || !entry.cvFileData)
      throw new NotFoundException('Không tìm thấy tệp CV');
    return entry;
  }

  async trash(userId: string, id: string) {
    const companyId = await this.getCompanyId(userId);
    const card = await this.cardRepo.findOne({ where: { id, companyId } });
    if (!card) throw new NotFoundException('Không tìm thấy hồ sơ trong Kho CV');
    await this.cardRepo.softDelete(card.id);
    return { success: true as const };
  }

  async restore(userId: string, id: string) {
    const companyId = await this.getCompanyId(userId);
    const card = await this.cardRepo.findOne({
      where: { id, companyId },
      withDeleted: true,
    });
    if (!card) throw new NotFoundException('Không tìm thấy hồ sơ trong Kho CV');
    await this.cardRepo.restore(card.id);
    return { success: true as const };
  }

  // Thẻ nào có hồ sơ gốc đã không còn (ứng viên đã xoá tài khoản) — để hiện nhãn trên giao diện.
  async findDeletedAccounts(cards: CvArchiveCandidate[]): Promise<Set<string>> {
    const profileIds = [
      ...new Set(
        cards.map((c) => c.candidateProfileId).filter((v): v is string => !!v),
      ),
    ];
    if (profileIds.length === 0) return new Set();
    const existing = await this.profileRepo.find({
      where: { id: In(profileIds) },
      select: { id: true },
    });
    const alive = new Set(existing.map((p) => p.id));
    return new Set(profileIds.filter((pid) => !alive.has(pid)));
  }

  private cardSummary(c: CvArchiveCandidate, deletedAccounts: Set<string>) {
    return {
      id: c.id,
      fullName: c.fullName,
      phone: c.phone ?? null,
      email: c.email ?? null,
      province: c.province ?? null,
      headline: c.headline ?? null,
      yearsOfExperience: c.yearsOfExperience ?? null,
      skills: c.skillsText ? c.skillsText.split(', ').filter(Boolean) : [],
      applicationCount: c.applicationCount,
      lastAppliedAt: c.lastAppliedAt,
      inTrash: !!c.deletedAt,
      accountDeleted:
        !!c.candidateProfileId && deletedAccounts.has(c.candidateProfileId),
    };
  }
}

// Gộp mọi chữ có nghĩa trong bản chụp hồ sơ để tìm kiếm (SĐT thêm dạng chỉ-chữ-số để gõ liền hay có
// dấu cách đều khớp).
export function snapshotToText(s: CvArchiveSnapshot): string {
  const parts: (string | null | undefined)[] = [
    s.fullName,
    s.profileTitle,
    s.phone,
    digitsOnly(s.phone),
    s.contactEmail,
    s.accountEmail,
    s.province,
    s.district,
    s.address,
    stripHtml(s.careerObjective),
    s.desiredPosition,
    s.desiredLevel,
    s.currentLevel,
    s.highestDegree,
    ...(s.desiredIndustries ?? []),
    ...(s.desiredLocations ?? []),
    ...(s.desiredJobTypes ?? []),
    ...s.experiences.flatMap((e) => [
      e.position,
      e.companyName,
      stripHtml(e.description),
    ]),
    ...s.educations.flatMap((e) => [e.schoolName, e.degree, e.major]),
    ...s.certificates.flatMap((c) => [c.name, c.issuer]),
    ...s.languages.map((l) => l.language),
    ...s.skills.map((k) => k.skillName),
    ...s.achievements.map((a) => a.title),
    ...s.activities.flatMap((a) => [a.title, a.organizationName]),
  ];
  return parts.filter(Boolean).join(' ');
}
