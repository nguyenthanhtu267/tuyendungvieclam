import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CandidateProfile,
  ProfileVisibility,
} from '../database/entities/candidate-profile.entity';
import { User } from '../database/entities/user.entity';
import {
  JobPosting,
  JobApprovalStatus,
} from '../database/entities/job-posting.entity';
import { Application } from '../database/entities/application.entity';
import { Company } from '../database/entities/company.entity';
import { AdminCandidateNote } from '../database/entities/admin-tools.entity';
import { CvArchiveCandidate } from '../database/entities/cv-archive.entity';
import { AdminAuditLog } from '../database/entities/admin-audit-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CvArchiveService } from '../cv-archive/cv-archive.service';
import { snapshotToDraft } from '../common/candidate-draft.util';
import { digitsOnly, normalizeSearchText } from '../common/search-text.util';
import { unaccentSql } from '../common/sql-unaccent.util';
import {
  SourcedProfileFactory,
  isSourcedPlaceholderEmail,
} from './sourced-profile.factory';
import { AdminActor, logAdminAction } from './admin-audit';
import { CandidatesQueryDto, SetAdminNoteDto } from './dto/admin-tools.dto';

// Đợt 18f (26/09/2026) — Admin quản lý ứng viên (theo lựa chọn người dùng — đủ cả 4 chức năng):
//  1. Tìm & lọc nâng cao: chưa ứng tuyển nơi nào / đã ứng tuyển, chế độ hiển thị, % hoàn thành, tỉnh,
//     kỹ năng, nhãn, hồ sơ nguồn tổng hợp; từ khoá gõ không dấu vẫn ra.
//  2. Gợi ý tin phù hợp (theo quy tắc: chức danh, ngành, nơi làm việc, kỹ năng, mức lương) + mời ứng
//     tuyển qua chuông thông báo.
//  3. Nhãn & ghi chú nội bộ chỉ Admin thấy.
//  4. Chuyển thành hồ sơ nguồn tổng hợp (người đã Công khai sẵn trong Tìm CV thì không cần).

const STOPWORDS = new Set([
  'nhan',
  'vien',
  'chuyen',
  'cong',
  'ty',
  'va',
  'cua',
  'cac',
  'nhung',
  'tai',
  'cho',
  'the',
  'and',
  'of',
  'staff',
  'senior',
  'junior',
  'intern',
  'thuc',
  'tap',
  'sinh',
  'lam',
  'viec',
  'tnhh',
  'phan',
  'tong',
  'hop',
  'truong',
  'pho',
  'vi',
  'tri',
  'ung',
  'tuyen',
]);

function keywords(...texts: (string | null | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const t of texts) {
    for (const w of normalizeSearchText(t).split(/[^a-z0-9+#]+/)) {
      if (w.length >= 3 && !STOPWORDS.has(w)) out.add(w);
    }
  }
  return out;
}

@Injectable()
export class AdminCandidatesService {
  constructor(
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(JobPosting)
    private readonly jobRepo: Repository<JobPosting>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(AdminCandidateNote)
    private readonly noteRepo: Repository<AdminCandidateNote>,
    @InjectRepository(CvArchiveCandidate)
    private readonly cardRepo: Repository<CvArchiveCandidate>,
    @InjectRepository(AdminAuditLog)
    private readonly auditRepo: Repository<AdminAuditLog>,
    private readonly notificationsService: NotificationsService,
    private readonly cvArchiveService: CvArchiveService,
    private readonly factory: SourcedProfileFactory,
  ) {}

  async list(q: CandidatesQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const appliedSub = `SELECT 1 FROM applications a INNER JOIN cvs cv ON cv.id = a.cv_id WHERE cv.candidate_profile_id = p.id`;
    const qb = this.profileRepo
      .createQueryBuilder('p')
      .innerJoin(User, 'u', 'u.id = p.user_id')
      .leftJoin(AdminCandidateNote, 'n', 'n.candidate_profile_id = p.id');
    if (q.applied === 'none') qb.andWhere(`NOT EXISTS (${appliedSub})`);
    if (q.applied === 'any') qb.andWhere(`EXISTS (${appliedSub})`);
    if (q.visibility) qb.andWhere('p.visibility = :vis', { vis: q.visibility });
    if (q.completionMin != null)
      qb.andWhere('p.completion_percent >= :cmin', { cmin: q.completionMin });
    if (q.sourced === 'only') qb.andWhere('p.is_admin_sourced = true');
    if (q.sourced === 'exclude') qb.andWhere('p.is_admin_sourced = false');
    if (q.province) {
      qb.andWhere(
        `(${unaccentSql("COALESCE(p.province, '')")} = :prov OR ${unaccentSql("COALESCE(p.desired_locations, '')")} LIKE :provLike)`,
        {
          prov: normalizeSearchText(q.province),
          provLike: `%${normalizeSearchText(q.province)}%`,
        },
      );
    }
    if (q.skill) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM candidate_skills s WHERE s.candidate_profile_id = p.id AND ${unaccentSql('s.skill_name')} LIKE :skill)`,
        { skill: `%${normalizeSearchText(q.skill)}%` },
      );
    }
    if (q.tag)
      qb.andWhere(`${unaccentSql("COALESCE(n.tags, '')")} LIKE :tag`, {
        tag: `%${normalizeSearchText(q.tag)}%`,
      });
    normalizeSearchText(q.q)
      .split(' ')
      .filter(Boolean)
      .slice(0, 6)
      .forEach((t, i) => {
        const digits = digitsOnly(t);
        qb.andWhere(
          `(${unaccentSql('p.full_name')} LIKE :k${i} OR ${unaccentSql("COALESCE(p.profile_title, '')")} LIKE :k${i}
            OR ${unaccentSql("COALESCE(p.desired_position, '')")} LIKE :k${i} OR LOWER(u.email) LIKE :k${i}
            OR LOWER(COALESCE(p.contact_email, '')) LIKE :k${i}
            OR EXISTS (SELECT 1 FROM candidate_skills s2 WHERE s2.candidate_profile_id = p.id AND ${unaccentSql('s2.skill_name')} LIKE :k${i})
            OR EXISTS (SELECT 1 FROM candidate_experiences e2 WHERE e2.candidate_profile_id = p.id AND ${unaccentSql('e2.position')} LIKE :k${i})
            ${digits.length >= 3 ? `OR regexp_replace(COALESCE(p.phone, ''), '[^0-9]', '', 'g') LIKE :d${i}` : ''})`,
          { [`k${i}`]: `%${t}%`, [`d${i}`]: `%${digits}%` },
        );
      });
    const total = await qb.getCount();
    const rows = await qb
      .select([
        'p.id AS id',
        'p.user_id AS "userId"',
        'p.full_name AS "fullName"',
        'u.email AS email',
        'u.status AS "userStatus"',
        'p.phone AS phone',
        'p.contact_email AS "contactEmail"',
        'p.profile_title AS "profileTitle"',
        'p.desired_position AS "desiredPosition"',
        'p.province AS province',
        'p.visibility AS visibility',
        'p.completion_percent AS "completionPercent"',
        'p.years_of_experience AS "yearsOfExperience"',
        'p.is_admin_sourced AS "isAdminSourced"',
        'p.updated_at AS "updatedAt"',
        'n.tags AS tags',
        'n.note AS note',
        `(SELECT COUNT(*) FROM applications a INNER JOIN cvs cv ON cv.id = a.cv_id WHERE cv.candidate_profile_id = p.id) AS "applicationCount"`,
        `(SELECT MAX(a.applied_at) FROM applications a INNER JOIN cvs cv ON cv.id = a.cv_id WHERE cv.candidate_profile_id = p.id) AS "lastAppliedAt"`,
      ])
      .orderBy('p.updated_at', 'DESC')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<Record<string, unknown>>();
    return {
      items: rows.map((r) => ({
        id: r.id as string,
        userId: r.userId as string,
        fullName: r.fullName as string,
        email: isSourcedPlaceholderEmail(r.email as string)
          ? null
          : (r.email as string),
        userStatus: r.userStatus as string,
        phone: (r.phone as string) ?? null,
        contactEmail: (r.contactEmail as string) ?? null,
        profileTitle: (r.profileTitle as string) ?? null,
        desiredPosition: (r.desiredPosition as string) ?? null,
        province: (r.province as string) ?? null,
        visibility: r.visibility as string,
        completionPercent: Number(r.completionPercent ?? 0),
        yearsOfExperience:
          r.yearsOfExperience == null ? null : Number(r.yearsOfExperience),
        isAdminSourced: !!r.isAdminSourced,
        updatedAt: r.updatedAt,
        tags: r.tags ? String(r.tags).split(',').filter(Boolean) : [],
        note: (r.note as string) ?? null,
        applicationCount: Number(r.applicationCount ?? 0),
        lastAppliedAt: r.lastAppliedAt ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async tags() {
    const rows = await this.noteRepo.find({ select: { id: true, tags: true } });
    const count = new Map<string, number>();
    for (const r of rows)
      for (const t of r.tags ?? [])
        if (t) count.set(t, (count.get(t) ?? 0) + 1);
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag, n]) => ({ tag, count: n }));
  }

  async detail(profileId: string) {
    const p = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!p) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');
    const [user, snapshot, note, applications, cards] = await Promise.all([
      this.userRepo.findOne({ where: { id: p.userId } }),
      this.cvArchiveService.buildSnapshot(profileId),
      this.noteRepo.findOne({ where: { candidateProfileId: profileId } }),
      this.applicationRepo
        .createQueryBuilder('a')
        .withDeleted()
        .innerJoin('a.cv', 'cv')
        .innerJoinAndSelect('a.jobPosting', 'j')
        .innerJoinAndSelect('j.company', 'c')
        .where('cv.candidate_profile_id = :pid', { pid: profileId })
        .orderBy('a.applied_at', 'DESC')
        .take(50)
        .getMany(),
      this.cardRepo.find({
        where: { candidateProfileId: profileId },
        withDeleted: true,
      }),
    ]);
    const cardCompanies = cards.length
      ? await this.companyRepo.find({
          where: { id: In(cards.map((c) => c.companyId)) },
          select: { id: true, name: true },
        })
      : [];
    const cname = new Map(cardCompanies.map((c) => [c.id, c.name]));
    return {
      id: p.id,
      userId: p.userId,
      email: user && !isSourcedPlaceholderEmail(user.email) ? user.email : null,
      userStatus: user?.status ?? null,
      visibility: p.visibility,
      hideContactInfo: p.hideContactInfo,
      completionPercent: p.completionPercent,
      isAdminSourced: p.isAdminSourced,
      sourceLabel: p.sourceLabel ?? null,
      claimedAt: p.claimedAt ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      snapshot,
      tags: note?.tags ?? [],
      note: note?.note ?? null,
      noteUpdatedBy: note?.updatedByEmail ?? null,
      applications: applications.map((a) => ({
        id: a.id,
        jobId: a.jobPostingId,
        jobTitle: a.jobPosting.title,
        companyName: a.jobPosting.company?.name ?? '—',
        appliedAt: a.appliedAt,
        status: a.status,
      })),
      archiveCards: cards.map((c) => ({
        id: c.id,
        companyName: cname.get(c.companyId) ?? '—',
        shareStatus: c.shareStatus,
        sharedProfileId: c.sharedProfileId ?? null,
      })),
    };
  }

  async setNote(admin: AdminActor, profileId: string, dto: SetAdminNoteDto) {
    const exists = await this.profileRepo.exists({ where: { id: profileId } });
    if (!exists) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');
    let row = await this.noteRepo.findOne({
      where: { candidateProfileId: profileId },
    });
    if (!row) row = this.noteRepo.create({ candidateProfileId: profileId });
    if (dto.tags !== undefined) {
      row.tags = [
        ...new Set(
          dto.tags.map((t) => t.trim().replace(/,/g, ' ')).filter(Boolean),
        ),
      ];
    }
    if (dto.note !== undefined) row.note = dto.note.trim() || null;
    row.updatedByEmail = admin.email;
    await this.noteRepo.save(row);
    return { tags: row.tags ?? [], note: row.note ?? null };
  }

  // Gợi ý tin đang tuyển phù hợp theo QUY TẮC (không phải AI — AI để Giai đoạn 2 theo quyết định ban
  // đầu): chức danh/vị trí (tối đa 45đ), ngành nghề (20đ), nơi làm việc (15đ), kỹ năng khớp thẻ tin
  // (tối đa 15đ), mức lương (5đ). Bỏ qua tin đã ứng tuyển.
  async suggestJobs(profileId: string) {
    const s = await this.cvArchiveService.buildSnapshot(profileId);
    if (!s) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');
    const applied = await this.applicationRepo
      .createQueryBuilder('a')
      .withDeleted()
      .innerJoin('a.cv', 'cv')
      .select('a.job_posting_id', 'jobId')
      .where('cv.candidate_profile_id = :pid', { pid: profileId })
      .getRawMany<{ jobId: string }>();
    const appliedIds = new Set(applied.map((a) => a.jobId));
    const jobs = await this.jobRepo
      .createQueryBuilder('j')
      .leftJoinAndSelect('j.company', 'c')
      .where('j.approval_status = :st', { st: JobApprovalStatus.APPROVED })
      .andWhere('j.is_paused = false')
      .andWhere('(j.deadline IS NULL OR j.deadline >= CURRENT_DATE)')
      .orderBy('j.created_at', 'DESC')
      .take(500)
      .getMany();

    const titleWords = keywords(
      s.desiredPosition,
      s.profileTitle,
      ...s.experiences.slice(0, 3).map((e) => e.position),
    );
    const desiredPhrase = normalizeSearchText(
      s.desiredPosition || s.profileTitle,
    );
    const industries = new Set(
      (s.desiredIndustries ?? []).map((i) => normalizeSearchText(i)),
    );
    const places = new Set(
      [s.province, ...(s.desiredLocations ?? [])]
        .filter(Boolean)
        .map((x) => normalizeSearchText(x)),
    );
    const skills = new Set(
      s.skills.map((k) => normalizeSearchText(k.skillName)),
    );

    const scored = jobs
      .filter((j) => !appliedIds.has(j.id))
      .map((j) => {
        let score = 0;
        const reasons: string[] = [];
        const jt = normalizeSearchText(j.title);
        const overlap = [...keywords(j.title)].filter((w) => titleWords.has(w));
        if (
          desiredPhrase &&
          desiredPhrase.length >= 4 &&
          jt.includes(desiredPhrase)
        ) {
          score += 45;
          reasons.push('Đúng vị trí mong muốn');
        } else if (overlap.length) {
          score += Math.min(45, overlap.length * 15);
          reasons.push(`Chức danh khớp: ${overlap.slice(0, 3).join(', ')}`);
        }
        if (j.industry && industries.has(normalizeSearchText(j.industry))) {
          score += 20;
          reasons.push(`Ngành ${j.industry}`);
        }
        const jobPlaces = [...(j.provinces ?? []), j.location]
          .filter(Boolean)
          .map((x) => normalizeSearchText(x));
        const placeHit = jobPlaces.find((jp) =>
          [...places].some((pl) => pl && (jp.includes(pl) || pl.includes(jp))),
        );
        if (placeHit) {
          score += 15;
          reasons.push('Đúng nơi làm việc');
        }
        const tagHits = (j.tags ?? []).filter((t) =>
          skills.has(normalizeSearchText(t)),
        );
        if (tagHits.length) {
          score += Math.min(15, tagHits.length * 5);
          reasons.push(`Kỹ năng: ${tagHits.slice(0, 3).join(', ')}`);
        }
        if (
          s.desiredSalaryMin &&
          j.salaryMax &&
          j.salaryMax >= s.desiredSalaryMin
        ) {
          score += 5;
          reasons.push('Mức lương phù hợp');
        }
        return { job: j, score, reasons };
      })
      .filter((x) => x.score >= 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return scored.map(({ job, score, reasons }) => ({
      id: job.id,
      title: job.title,
      companyName: job.company?.name ?? '—',
      provinces: job.provinces ?? (job.location ? [job.location] : []),
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      score,
      reasons,
    }));
  }

  async invite(admin: AdminActor, profileId: string, jobPostingId: string) {
    const p = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!p) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');
    const user = await this.userRepo.findOne({ where: { id: p.userId } });
    if (!user || p.isAdminSourced || isSourcedPlaceholderEmail(user.email)) {
      throw new BadRequestException(
        'Hồ sơ nguồn tổng hợp không có tài khoản thật để nhận lời mời',
      );
    }
    const job = await this.jobRepo.findOne({
      where: { id: jobPostingId },
      relations: { company: true },
    });
    if (!job || job.approvalStatus !== JobApprovalStatus.APPROVED) {
      throw new NotFoundException('Không tìm thấy tin đang tuyển');
    }
    await this.notificationsService.create(
      user.id,
      'job_invite',
      `Tuyển Dụng Việc Làm gợi ý bạn ứng tuyển vị trí "${job.title}" tại ${job.company?.name ?? 'nhà tuyển dụng'} — hồ sơ của bạn rất phù hợp.`,
    );
    await logAdminAction(
      this.auditRepo,
      admin,
      'candidate.invite',
      'candidate_profile',
      p.id,
      `${p.fullName} → ${job.title}`,
    );
    return { success: true as const };
  }

  async toSourced(admin: AdminActor, profileId: string) {
    const p = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!p) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');
    if (p.isAdminSourced)
      throw new BadRequestException('Đây đã là hồ sơ nguồn tổng hợp');
    if (p.visibility !== ProfileVisibility.LOCKED && p.profileTitle) {
      return { status: 'already_public' as const, profileId: null };
    }
    // Đã có bản sao từ Kho CV (thẻ của người này đã được chia sẻ) → dùng lại, không tạo thêm.
    const card = await this.cardRepo.findOne({
      where: { candidateProfileId: profileId, shareStatus: 'shared' },
      withDeleted: true,
    });
    if (
      card?.sharedProfileId &&
      (await this.profileRepo.exists({ where: { id: card.sharedProfileId } }))
    ) {
      return { status: 'shared' as const, profileId: card.sharedProfileId };
    }
    const s = await this.cvArchiveService.buildSnapshot(profileId);
    if (!s) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');
    const created = await this.factory.create(snapshotToDraft(s), {
      sourceLabel: 'Từ hồ sơ ứng viên trên web (Admin chuyển)',
      copyBlockedFromProfileId: profileId,
    });
    await logAdminAction(
      this.auditRepo,
      admin,
      'candidate.to_sourced',
      'candidate_profile',
      created.id,
      p.fullName,
    );
    return { status: 'shared' as const, profileId: created.id };
  }
}
