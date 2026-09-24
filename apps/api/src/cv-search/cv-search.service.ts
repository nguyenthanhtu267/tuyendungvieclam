import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CompanyUser } from '../database/entities/company-user.entity';
import { Company } from '../database/entities/company.entity';
import { CandidateProfile, ProfileVisibility } from '../database/entities/candidate-profile.entity';
import { UnlockedProfile } from '../database/entities/unlocked-profile.entity';
import { Order, OrderStatus } from '../database/entities/order.entity';
import { CandidateNote } from '../database/entities/candidate-note.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { SearchCandidatesDto } from './dto/search-candidates.dto';
import { SetCandidateNoteDto } from './dto/set-candidate-note.dto';
import { NotificationsService } from '../notifications/notifications.service';

// Các trường coi là "thông tin liên hệ" — bị ẩn ngay cả khi NTD đã trả điểm mở hồ sơ, nếu ứng viên
// bật "Ẩn thông tin liên hệ" (đợt 8). Đây là lựa chọn riêng tư của ứng viên, không phải thứ mua được.
const CONTACT_FIELDS = ['phone', 'contactEmail', 'address'] as const;

function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return fullName;
  return [parts[0], ...parts.slice(1).map((p) => `${p[0].toUpperCase()}.`)].join(' ');
}

@Injectable()
export class CvSearchService {
  constructor(
    @InjectRepository(CompanyUser) private readonly companyUserRepo: Repository<CompanyUser>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(CandidateProfile) private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(UnlockedProfile) private readonly unlockedRepo: Repository<UnlockedProfile>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(CandidateNote) private readonly noteRepo: Repository<CandidateNote>,
    @InjectRepository(JobPosting) private readonly jobRepo: Repository<JobPosting>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Chỉ tài khoản NTD (employer_main/employer_sub) đã liên kết công ty mới dùng được module này —
  // cùng cách chặn tài khoản ứng viên như EmployerService (bảng company_users là nguồn xác thực).
  private async getCompany(userId: string): Promise<Company> {
    const link = await this.companyUserRepo.findOne({ where: { userId } });
    if (!link) throw new ForbiddenException('Chỉ tài khoản nhà tuyển dụng mới có thể sử dụng chức năng này');
    const company = await this.companyRepo.findOne({ where: { id: link.companyId } });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');
    return company;
  }

  // Đợt 12ac (24/09/2026) — `excludeHidden` mặc định true (danh sách tìm kiếm bình thường không hiện
  // hồ sơ NTD đã tự ẩn qua CandidateNote.hidden); `search()` truyền false khi dto.hiddenOnly=true để
  // NTD xem lại đúng những hồ sơ đã ẩn (và có thể bỏ ẩn).
  private baseSearchQuery(companyId: string, companyName: string, excludeHidden = true) {
    const qb = this.profileRepo
      .createQueryBuilder('profile')
      .where('profile.profile_title IS NOT NULL')
      .andWhere('profile.visibility != :locked', { locked: ProfileVisibility.LOCKED })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM blocked_companies bc
          WHERE bc.candidate_profile_id = profile.id
            AND (bc.company_id = :companyId OR bc.company_name_text ILIKE :companyName)
        )`,
        { companyId, companyName },
      );
    if (excludeHidden) {
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM candidate_notes cn
          WHERE cn.candidate_profile_id = profile.id AND cn.company_id = :companyId AND cn.hidden = true
        )`,
      );
    } else {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM candidate_notes cn
          WHERE cn.candidate_profile_id = profile.id AND cn.company_id = :companyId AND cn.hidden = true
        )`,
      );
    }
    return qb;
  }

  private applyFilters(qb: ReturnType<typeof this.baseSearchQuery>, dto: SearchCandidatesDto) {
    if (dto.q) {
      qb.andWhere(
        `(
          profile.profile_title ILIKE :q OR profile.desired_position ILIKE :q OR profile.career_objective ILIKE :q
          OR EXISTS (SELECT 1 FROM candidate_skills cs WHERE cs.candidate_profile_id = profile.id AND cs.skill_name ILIKE :q)
          OR EXISTS (SELECT 1 FROM candidate_experiences ce WHERE ce.candidate_profile_id = profile.id AND ce.position ILIKE :q)
        )`,
        { q: `%${dto.q}%` },
      );
    }
    if (dto.industries?.length) {
      qb.andWhere(
        `(${dto.industries.map((_, i) => `profile.desired_industries ILIKE :ind${i}`).join(' OR ')})`,
        Object.fromEntries(dto.industries.map((v, i) => [`ind${i}`, `%${v}%`])),
      );
    }
    if (dto.locations?.length) {
      qb.andWhere(
        `(${dto.locations.map((_, i) => `profile.desired_locations ILIKE :loc${i}`).join(' OR ')})`,
        Object.fromEntries(dto.locations.map((v, i) => [`loc${i}`, `%${v}%`])),
      );
    }
    // Kỹ năng — phải khớp TẤT CẢ (mỗi kỹ năng yêu cầu 1 EXISTS riêng, AND với nhau).
    dto.skills?.forEach((skill, i) => {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM candidate_skills cs${i} WHERE cs${i}.candidate_profile_id = profile.id AND cs${i}.skill_name ILIKE :skill${i})`,
        { [`skill${i}`]: `%${skill}%` },
      );
    });
    if (dto.desiredLevel) qb.andWhere('profile.desired_level = :desiredLevel', { desiredLevel: dto.desiredLevel });
    if (dto.highestDegree) qb.andWhere('profile.highest_degree = :highestDegree', { highestDegree: dto.highestDegree });
    if (dto.experienceMin != null) qb.andWhere('profile.years_of_experience >= :expMin', { expMin: dto.experienceMin });
    if (dto.experienceMax != null) qb.andWhere('profile.years_of_experience <= :expMax', { expMax: dto.experienceMax });
    if (dto.salaryMin != null) {
      qb.andWhere('(profile.desired_salary_max IS NULL OR profile.desired_salary_max >= :salaryMin)', {
        salaryMin: dto.salaryMin,
      });
    }
    if (dto.salaryMax != null) {
      qb.andWhere('(profile.desired_salary_min IS NULL OR profile.desired_salary_min <= :salaryMax)', {
        salaryMax: dto.salaryMax,
      });
    }
    if (dto.urgentOnly) qb.andWhere('profile.visibility = :urgent', { urgent: ProfileVisibility.URGENT });
    return qb;
  }

  async getCredits(userId: string) {
    const company = await this.getCompany(userId);
    const now = new Date();
    const orders = await this.orderRepo.find({
      where: { companyId: company.id, status: OrderStatus.ACTIVE },
      relations: { servicePackage: true },
      order: { expiresAt: 'ASC' },
    });
    const usable = orders.filter(
      (o) => (o.servicePackage.type === 'cv_search' || o.servicePackage.type === 'combo') &&
        o.remaining > 0 &&
        (!o.expiresAt || new Date(o.expiresAt) > now),
    );
    const remaining = usable.reduce((sum, o) => sum + o.remaining, 0);
    return {
      remaining,
      nearestExpiresAt: usable[0]?.expiresAt ?? null,
      orders: usable,
    };
  }

  async search(userId: string, dto: SearchCandidatesDto) {
    const company = await this.getCompany(userId);
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;

    let qb = this.baseSearchQuery(company.id, company.name, !dto.hiddenOnly);
    qb = this.applyFilters(qb, dto);

    if (dto.unlockedOnly) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM unlocked_profiles up WHERE up.candidate_profile_id = profile.id AND up.company_id = :companyId)`,
        { companyId: company.id },
      );
    }

    const total = await qb.getCount();

    const idsRows = await qb
      .clone()
      .select('profile.id', 'id')
      .addSelect(`CASE WHEN profile.visibility = '${ProfileVisibility.URGENT}' THEN 0 ELSE 1 END`, 'urgent_rank')
      .orderBy('urgent_rank', 'ASC')
      .addOrderBy('profile.completion_percent', 'DESC')
      .addOrderBy('profile.updated_at', 'DESC')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<{ id: string }>();
    const ids = idsRows.map((r) => r.id);

    if (ids.length === 0) {
      return { items: [], total, page, pageSize };
    }

    const profiles = await this.profileRepo.find({
      where: { id: In(ids) },
      relations: { experiences: true, educations: true, skills: true, languages: true },
    });
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as CandidateProfile[];

    const unlockedSet = await this.getUnlockedIdSet(company.id, ids);
    const notesMap = await this.getNotesMap(company.id, ids);

    const items = ordered.map((p) => this.toSummary(p, unlockedSet.has(p.id), notesMap.get(p.id)));
    return { items, total, page, pageSize };
  }

  private async getUnlockedIdSet(companyId: string, profileIds: string[]): Promise<Set<string>> {
    if (profileIds.length === 0) return new Set();
    const rows = await this.unlockedRepo
      .createQueryBuilder('u')
      .select('u.candidate_profile_id', 'candidateProfileId')
      .where('u.company_id = :companyId', { companyId })
      .andWhere('u.candidate_profile_id IN (:...profileIds)', { profileIds })
      .getRawMany<{ candidateProfileId: string }>();
    return new Set(rows.map((r) => r.candidateProfileId));
  }

  // Đợt 12ac (24/09/2026) — ghi chú/trạng thái ẩn RIÊNG của công ty đang đăng nhập với từng hồ sơ.
  private async getNotesMap(companyId: string, profileIds: string[]): Promise<Map<string, CandidateNote>> {
    if (profileIds.length === 0) return new Map();
    const rows = await this.noteRepo.find({ where: { companyId, candidateProfileId: In(profileIds) } });
    return new Map(rows.map((r) => [r.candidateProfileId, r]));
  }

  private toSummary(profile: CandidateProfile, unlocked: boolean, note?: CandidateNote) {
    return {
      id: profile.id,
      fullName: unlocked ? profile.fullName : maskName(profile.fullName),
      profileTitle: profile.profileTitle,
      desiredPosition: profile.desiredPosition,
      desiredLevel: profile.desiredLevel,
      desiredSalaryMin: profile.desiredSalaryMin,
      desiredSalaryMax: profile.desiredSalaryMax,
      salaryCurrency: profile.salaryCurrency,
      yearsOfExperience: profile.yearsOfExperience,
      highestDegree: profile.highestDegree,
      province: profile.province,
      visibility: profile.visibility,
      completionPercent: profile.completionPercent,
      skills: (profile.skills ?? []).map((s) => ({ skillName: s.skillName, level: s.level })),
      languages: (profile.languages ?? []).map((l) => ({ language: l.language, level: l.level })),
      latestExperience: this.latestExperienceSummary(profile, unlocked),
      unlocked,
      // Đợt 12ac (24/09/2026) — icon hành động: ghi chú riêng + đã ẩn (chỉ công ty đang xem thấy).
      note: note?.note,
      hidden: note?.hidden ?? false,
    };
  }

  private latestExperienceSummary(profile: CandidateProfile, unlocked: boolean) {
    const list = [...(profile.experiences ?? [])].sort((a, b) => {
      const ad = a.isCurrent ? '9999' : a.endDate || a.startDate || '';
      const bd = b.isCurrent ? '9999' : b.endDate || b.startDate || '';
      return bd.localeCompare(ad);
    });
    const latest = list[0];
    if (!latest) return null;
    return { position: latest.position, companyName: unlocked ? latest.companyName : undefined, isCurrent: latest.isCurrent };
  }

  async getDetail(userId: string, profileId: string) {
    const company = await this.getCompany(userId);
    await this.assertVisibleToCompany(company, profileId);

    const profile = await this.profileRepo.findOne({
      where: { id: profileId },
      relations: {
        experiences: true,
        educations: true,
        certificates: true,
        languages: true,
        skills: true,
        achievements: true,
        activities: true,
      },
    });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ');

    const unlocked = (await this.getUnlockedIdSet(company.id, [profileId])).has(profileId);
    const note = (await this.getNotesMap(company.id, [profileId])).get(profileId);
    return this.toDetail(profile, unlocked, note);
  }

  private async assertVisibleToCompany(company: Company, profileId: string) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile || !profile.profileTitle || profile.visibility === ProfileVisibility.LOCKED) {
      throw new NotFoundException('Không tìm thấy hồ sơ');
    }
    const blocked = await this.dataSource.query(
      `SELECT 1 FROM blocked_companies WHERE candidate_profile_id = $1 AND (company_id = $2 OR company_name_text ILIKE $3) LIMIT 1`,
      [profileId, company.id, company.name],
    );
    if (blocked.length > 0) {
      throw new ForbiddenException('Ứng viên này đã chặn công ty của bạn xem hồ sơ');
    }
  }

  private toDetail(profile: CandidateProfile, unlocked: boolean, note?: CandidateNote) {
    const showContact = unlocked && !profile.hideContactInfo;
    return {
      id: profile.id,
      fullName: unlocked ? profile.fullName : maskName(profile.fullName),
      profileTitle: profile.profileTitle,
      dateOfBirth: unlocked ? profile.dateOfBirth : undefined,
      gender: profile.gender,
      phone: showContact ? profile.phone : undefined,
      contactEmail: showContact ? profile.contactEmail : undefined,
      address: showContact ? profile.address : undefined,
      nationality: profile.nationality,
      maritalStatus: profile.maritalStatus,
      country: profile.country,
      province: profile.province,
      district: unlocked ? profile.district : undefined,
      careerObjective: profile.careerObjective,
      desiredPosition: profile.desiredPosition,
      desiredLevel: profile.desiredLevel,
      desiredSalaryMin: profile.desiredSalaryMin,
      desiredSalaryMax: profile.desiredSalaryMax,
      salaryCurrency: profile.salaryCurrency,
      desiredIndustries: profile.desiredIndustries,
      desiredLocations: profile.desiredLocations,
      desiredJobTypes: profile.desiredJobTypes,
      yearsOfExperience: profile.yearsOfExperience,
      currentLevel: profile.currentLevel,
      highestDegree: profile.highestDegree,
      hideContactInfo: profile.hideContactInfo,
      visibility: profile.visibility,
      avatarUrl: profile.avatarMimeType ? `/files/avatar/${profile.id}` : null,
      experiences: (profile.experiences ?? []).map((e) => ({
        id: e.id,
        position: e.position,
        companyName: unlocked ? e.companyName : undefined,
        startDate: e.startDate,
        endDate: e.endDate,
        isCurrent: e.isCurrent,
        description: e.description,
      })),
      educations: (profile.educations ?? []).map((e) => ({
        id: e.id,
        schoolName: unlocked ? e.schoolName : undefined,
        degree: e.degree,
        major: e.major,
        startDate: e.startDate,
        endDate: e.endDate,
      })),
      certificates: profile.certificates ?? [],
      languages: profile.languages ?? [],
      skills: profile.skills ?? [],
      achievements: profile.achievements ?? [],
      activities: (profile.activities ?? []).map((a) => ({
        ...a,
        organizationName: unlocked ? a.organizationName : undefined,
      })),
      unlocked,
      contactHiddenByCandidate: unlocked && profile.hideContactInfo,
      // Đợt 12ac (24/09/2026) — ghi chú riêng + trạng thái ẩn (chỉ công ty đang xem thấy).
      note: note?.note,
      hidden: note?.hidden ?? false,
    };
  }

  // Đợt 12ac (24/09/2026) — "Ghi chú riêng" + "Ẩn khỏi danh sách": upsert theo (companyId, profileId).
  async setNote(userId: string, profileId: string, dto: SetCandidateNoteDto) {
    const company = await this.getCompany(userId);
    await this.assertVisibleToCompany(company, profileId);

    let row = await this.noteRepo.findOne({ where: { companyId: company.id, candidateProfileId: profileId } });
    if (!row) {
      row = this.noteRepo.create({ companyId: company.id, candidateProfileId: profileId });
    }
    if (dto.note !== undefined) row.note = dto.note;
    if (dto.hidden !== undefined) row.hidden = dto.hidden;
    await this.noteRepo.save(row);
    return { note: row.note, hidden: row.hidden };
  }

  // Đợt 12ac (24/09/2026) — "Mời ứng tuyển": NTD gửi lời mời cho ứng viên vào 1 tin đang tuyển của
  // ĐÚNG công ty đang thao tác (chặn mời hộ tin công ty khác), tái dùng NotificationsService.
  async inviteToApply(userId: string, profileId: string, jobPostingId: string) {
    const company = await this.getCompany(userId);
    await this.assertVisibleToCompany(company, profileId);

    const job = await this.jobRepo.findOne({ where: { id: jobPostingId, companyId: company.id } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng của công ty bạn');

    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ');

    await this.notificationsService.create(
      profile.userId,
      'job_invite',
      `${company.name} mời bạn ứng tuyển vị trí "${job.title}".`,
    );
    return { success: true };
  }

  async listUnlocked(userId: string) {
    const company = await this.getCompany(userId);
    const rows = await this.unlockedRepo.find({
      where: { companyId: company.id },
      relations: { candidateProfile: true },
      order: { unlockedAt: 'DESC' },
    });
    const profileIds = rows.filter((r) => r.candidateProfile).map((r) => r.candidateProfile.id);
    const notesMap = await this.getNotesMap(company.id, profileIds);
    return rows
      .filter((r) => r.candidateProfile)
      .map((r) => ({
        unlockedAt: r.unlockedAt,
        profile: this.toSummary(r.candidateProfile, true, notesMap.get(r.candidateProfile.id)),
      }));
  }

  // Trừ điểm + ghi nhận mở khóa trong CÙNG một giao dịch CSDL (theo quyết định đã chốt) để không
  // bao giờ lệch số liệu giữa "điểm còn lại" và "danh sách đã mở".
  async unlock(userId: string, profileId: string) {
    const company = await this.getCompany(userId);
    await this.assertVisibleToCompany(company, profileId);

    const already = await this.unlockedRepo.findOne({
      where: { companyId: company.id, candidateProfileId: profileId },
    });
    if (already) {
      // Xem lại hồ sơ đã mở — miễn phí vĩnh viễn, không trừ thêm điểm.
      return this.getDetail(userId, profileId);
    }

    await this.dataSource.transaction(async (manager) => {
      const now = new Date();
      // Gói nào sắp hết hạn trước thì dùng trước — khoá dòng để tránh 2 request trừ trùng điểm.
      const order = await manager
        .createQueryBuilder(Order, 'o')
        .innerJoinAndSelect('o.servicePackage', 'pkg')
        .where('o.company_id = :companyId', { companyId: company.id })
        .andWhere('o.status = :active', { active: OrderStatus.ACTIVE })
        .andWhere('o.remaining > 0')
        .andWhere('(pkg.type = :cvSearch OR pkg.type = :combo)', { cvSearch: 'cv_search', combo: 'combo' })
        .andWhere('(o.expires_at IS NULL OR o.expires_at > :now)', { now })
        .orderBy('o.expires_at', 'ASC', 'NULLS LAST')
        .setLock('pessimistic_write')
        .getOne();

      if (!order) {
        throw new BadRequestException(
          'Bạn đã hết điểm xem hồ sơ ứng viên. Vui lòng mua thêm gói "Tìm hồ sơ" hoặc Combo để tiếp tục.',
        );
      }

      order.remaining -= 1;
      await manager.save(order);

      const unlockRow = manager.create(UnlockedProfile, {
        companyId: company.id,
        candidateProfileId: profileId,
        unlockedByUserId: userId,
        orderId: order.id,
      });
      await manager.save(unlockRow);
    });

    // Đợt 12m (21/09/2026) — báo cho ứng viên khi hồ sơ được NTD xem lần đầu (chỉ báo 1 lần — xem
    // lại sau đó miễn phí, không tính là "vừa xem" nữa, đã return sớm ở nhánh `already` phía trên).
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (profile) {
      await this.notificationsService.create(profile.userId, 'profile_viewed', `${company.name} vừa xem hồ sơ của bạn.`);
    }

    return this.getDetail(userId, profileId);
  }
}
