import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import {
  CvArchiveCandidate,
  CvArchiveEntry,
  CvShareStatus,
} from '../database/entities/cv-archive.entity';
import {
  CandidateProfile,
  ProfileVisibility,
} from '../database/entities/candidate-profile.entity';
import { User } from '../database/entities/user.entity';
import { Company } from '../database/entities/company.entity';
import { AdminSetting } from '../database/entities/admin-setting.entity';
import { AdminAuditLog } from '../database/entities/admin-audit-log.entity';
import { CandidateProfileRequest } from '../database/entities/admin-tools.entity';
import { UnlockedProfile } from '../database/entities/unlocked-profile.entity';
import { CvArchiveService } from '../cv-archive/cv-archive.service';
import { CandidateDraftDto } from '../common/dto/candidate-draft.dto';
import { snapshotToDraft } from '../common/candidate-draft.util';
import { digitsOnly, normalizeSearchText } from '../common/search-text.util';
import { unaccentSql } from '../common/sql-unaccent.util';
import { ParsedCv } from '../common/cv-parser.util';
import {
  SourcedProfileFactory,
  isSourcedPlaceholderEmail,
} from './sourced-profile.factory';
import { AdminActor, SYSTEM_ACTOR, logAdminAction } from './admin-audit';
import { CreateProfileRequestDto } from './dto/admin-tools.dto';

// Đợt 18c (26/09/2026) — Admin "Nguồn ngoài → CV ứng viên":
//  1. HÀNG CHỜ CHIA SẺ: mỗi người trong Kho CV của các NTD (CV ứng tuyển + CV NTD tự nhập — theo lựa
//     chọn người dùng) chờ Admin duyệt thủ công, hoặc TỰ ĐỘNG sau 15 phút khi bật công tắc chung (chỉ
//     áp dụng cho CV nộp SAU lúc bật). Duyệt = tạo "hồ sơ nguồn tổng hợp" cho NTD khác tìm thấy.
//     Thông minh: ứng viên đã tự Công khai sẵn trong Tìm CV → không tạo bản sao trùng (already_public);
//     cùng 1 người ở nhiều công ty → dùng chung 1 bản sao; công ty gốc không thấy bản sao (xem cv-search).
//     Ứng viên để "Khoá" vẫn được đưa vào (lựa chọn người dùng) — hàng chờ gắn nhãn để Admin biết.
//  2. HỒ SƠ NGUỒN TỔNG HỢP Admin tự tạo (dán nội dung / tải file / dán link ngoài web).
//  3. YÊU CẦU GỠ / NHẬN LẠI hồ sơ từ người thật (trang công khai /yeu-cau-ho-so).

const AUTO_SHARE_DELAY_MS = 15 * 60 * 1000;
const AUTO_SHARE_SWEEP_MS = 60 * 1000;
const SETTING_ID = 'singleton';

export type RealProfileState =
  'none' | 'deleted' | 'public' | 'locked' | 'not_searchable';

@Injectable()
export class CvSourcingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CvSourcingService.name);
  private timer?: ReturnType<typeof setInterval>;
  private sweeping = false;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CvArchiveCandidate)
    private readonly cardRepo: Repository<CvArchiveCandidate>,
    @InjectRepository(CvArchiveEntry)
    private readonly entryRepo: Repository<CvArchiveEntry>,
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(AdminSetting)
    private readonly settingRepo: Repository<AdminSetting>,
    @InjectRepository(AdminAuditLog)
    private readonly auditRepo: Repository<AdminAuditLog>,
    @InjectRepository(CandidateProfileRequest)
    private readonly requestRepo: Repository<CandidateProfileRequest>,
    @InjectRepository(UnlockedProfile)
    private readonly unlockedRepo: Repository<UnlockedProfile>,
    private readonly cvArchiveService: CvArchiveService,
    private readonly factory: SourcedProfileFactory,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(
      () => void this.autoShareSweep(),
      AUTO_SHARE_SWEEP_MS,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ===================================================================================================
  // Công tắc tự động 15 phút
  // ===================================================================================================

  private async getSetting(): Promise<AdminSetting> {
    let row = await this.settingRepo.findOne({ where: { id: SETTING_ID } });
    if (!row)
      row = await this.settingRepo.save(
        this.settingRepo.create({ id: SETTING_ID }),
      );
    return row;
  }

  async getAutoShare() {
    const s = await this.getSetting();
    return {
      enabled: s.cvAutoShareEnabled,
      enabledAt: s.cvAutoShareEnabledAt ?? null,
    };
  }

  async setAutoShare(admin: AdminActor, enabled: boolean) {
    const s = await this.getSetting();
    if (enabled && !s.cvAutoShareEnabled) s.cvAutoShareEnabledAt = new Date();
    s.cvAutoShareEnabled = enabled;
    await this.settingRepo.save(s);
    await logAdminAction(
      this.auditRepo,
      admin,
      enabled ? 'cv.auto_share_on' : 'cv.auto_share_off',
      'setting',
    );
    return this.getAutoShare();
  }

  async autoShareSweep() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const s = await this.getSetting();
      if (!s.cvAutoShareEnabled || !s.cvAutoShareEnabledAt) return;
      // Chỉ CV nộp SAU lúc bật công tắc (lọc ngay trong truy vấn — nếu lọc sau thì hàng tồn cũ nằm mãi
      // ở đầu danh sách và chặn không tới lượt CV mới).
      const cutoff = new Date(Date.now() - AUTO_SHARE_DELAY_MS);
      if (cutoff.getTime() < s.cvAutoShareEnabledAt.getTime()) return;
      const due = await this.cardRepo.find({
        where: {
          shareStatus: 'pending',
          lastAppliedAt: Between(s.cvAutoShareEnabledAt, cutoff),
        },
        withDeleted: true,
        order: { lastAppliedAt: 'ASC' },
        take: 30,
      });
      for (const card of due) {
        try {
          await this.shareCard(SYSTEM_ACTOR, card.id);
        } catch (err) {
          this.logger.warn(
            `Tự động chia sẻ thẻ ${card.id} lỗi: ${(err as Error).message}`,
          );
          await this.cardRepo.update(
            { id: card.id },
            { shareStatus: 'dismissed', shareDecidedAt: new Date() },
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Lỗi quét tự động chia sẻ CV: ${(err as Error).message}`,
      );
    } finally {
      this.sweeping = false;
    }
  }

  // ===================================================================================================
  // Hàng chờ chia sẻ
  // ===================================================================================================

  private async realStates(
    cards: CvArchiveCandidate[],
  ): Promise<Map<string, RealProfileState>> {
    const ids = [
      ...new Set(
        cards.map((c) => c.candidateProfileId).filter((v): v is string => !!v),
      ),
    ];
    const profiles = ids.length
      ? await this.profileRepo.find({
          where: { id: In(ids) },
          select: { id: true, visibility: true, profileTitle: true },
        })
      : [];
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const out = new Map<string, RealProfileState>();
    for (const c of cards) {
      if (!c.candidateProfileId) out.set(c.id, 'none');
      else {
        const p = byId.get(c.candidateProfileId);
        out.set(
          c.id,
          !p
            ? 'deleted'
            : p.visibility === ProfileVisibility.LOCKED
              ? 'locked'
              : p.profileTitle
                ? 'public'
                : 'not_searchable',
        );
      }
    }
    return out;
  }

  async listQueue(query: {
    status?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }) {
    const status = (query.status as CvShareStatus) || 'pending';
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
    const qb = this.cardRepo
      .createQueryBuilder('c')
      .withDeleted()
      .leftJoin(Company, 'co', 'co.id = c.company_id')
      .where('c.share_status = :status', { status });
    const terms = normalizeSearchText(query.q)
      .split(' ')
      .filter(Boolean)
      .slice(0, 8);
    terms.forEach((t, i) => {
      const esc = t.replace(/[\\%_]/g, (ch) => `\\${ch}`);
      qb.andWhere(
        `(c.search_text LIKE :t${i} OR ${unaccentSql('co.name')} LIKE :t${i})`,
        { [`t${i}`]: `%${esc}%` },
      );
    });
    const [cards, total] = await qb
      .orderBy('c.last_applied_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const countsRaw = await this.cardRepo
      .createQueryBuilder('c')
      .withDeleted()
      .select('c.share_status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.share_status')
      .getRawMany<{ status: string; count: string }>();
    const counts = Object.fromEntries(
      countsRaw.map((r) => [r.status, Number(r.count)]),
    );

    const companyIds = [...new Set(cards.map((c) => c.companyId))];
    const companies = companyIds.length
      ? await this.companyRepo.find({
          where: { id: In(companyIds) },
          select: { id: true, name: true },
        })
      : [];
    const companyName = new Map(companies.map((c) => [c.id, c.name]));
    const ids = cards.map((c) => c.id);
    const entries = ids.length
      ? await this.entryRepo.find({
          where: { archiveCandidateId: In(ids) },
          select: {
            id: true,
            archiveCandidateId: true,
            jobTitle: true,
            appliedAt: true,
            entrySource: true,
          },
          order: { appliedAt: 'DESC' },
        })
      : [];
    const states = await this.realStates(cards);

    return {
      items: cards.map((c) => {
        const mine = entries.filter((e) => e.archiveCandidateId === c.id);
        return {
          id: c.id,
          companyId: c.companyId,
          companyName: companyName.get(c.companyId) ?? '—',
          fullName: c.fullName,
          headline: c.headline ?? null,
          phone: c.phone ?? null,
          email: c.email ?? null,
          province: c.province ?? null,
          yearsOfExperience: c.yearsOfExperience ?? null,
          skills: c.skillsText
            ? c.skillsText.split(', ').filter(Boolean).slice(0, 6)
            : [],
          lastAppliedAt: c.lastAppliedAt,
          positions: mine.slice(0, 3).map((e) => e.jobTitle),
          fromImport: mine.some((e) => e.entrySource === 'employer_import'),
          realProfileState: states.get(c.id) ?? 'none',
          shareStatus: c.shareStatus,
          sharedProfileId: c.sharedProfileId ?? null,
          shareDecidedAt: c.shareDecidedAt ?? null,
        };
      }),
      total,
      page,
      pageSize,
      counts: {
        pending: counts.pending ?? 0,
        shared: counts.shared ?? 0,
        already_public: counts.already_public ?? 0,
        dismissed: counts.dismissed ?? 0,
      },
    };
  }

  // Xem trước thẻ + bản nháp hồ sơ tổng hợp (Admin sửa lại trước khi duyệt).
  async getCardDraft(cardId: string) {
    const detail = await this.cvArchiveService.detailForCompany(null, cardId);
    const card = await this.cardRepo.findOne({
      where: { id: cardId },
      withDeleted: true,
    });
    if (!card) throw new NotFoundException('Không tìm thấy thẻ');
    const latest = detail.entries[0];
    const draft = latest
      ? snapshotToDraft(
          latest.snapshot,
          latest.cvParsed as Partial<ParsedCv> | null,
          latest.jobTitle,
        )
      : null;
    const company = await this.companyRepo.findOne({
      where: { id: card.companyId },
      select: { id: true, name: true },
    });
    const state = (await this.realStates([card])).get(card.id) ?? 'none';
    return {
      card: detail,
      companyName: company?.name ?? '—',
      realProfileState: state,
      draft,
      shareStatus: card.shareStatus,
    };
  }

  async shareCard(
    admin: AdminActor,
    cardId: string,
    override?: CandidateDraftDto,
  ) {
    const card = await this.cardRepo.findOne({
      where: { id: cardId },
      withDeleted: true,
    });
    if (!card) throw new NotFoundException('Không tìm thấy thẻ');
    if (card.shareStatus === 'shared' && card.sharedProfileId) {
      return { status: 'shared' as const, profileId: card.sharedProfileId };
    }

    // Ứng viên đã tự Công khai sẵn trong Tìm CV → NTD khác đã tìm thấy được, không tạo bản sao trùng.
    const state = (await this.realStates([card])).get(card.id);
    if (state === 'public') {
      await this.cardRepo.update(
        { id: card.id },
        { shareStatus: 'already_public', shareDecidedAt: new Date() },
      );
      await logAdminAction(
        this.auditRepo,
        admin,
        'cv.share_already_public',
        'cv_archive',
        card.id,
        card.fullName,
      );
      return { status: 'already_public' as const, profileId: null };
    }

    // Cùng 1 người đã có bản sao (từ thẻ ở công ty khác) → dùng chung, không tạo thêm.
    const sameCards = await this.findSamePersonCards(card);
    let profileId =
      sameCards.find((c) => c.sharedProfileId && c.shareStatus === 'shared')
        ?.sharedProfileId ?? null;
    if (
      profileId &&
      !(await this.profileRepo.exists({ where: { id: profileId } }))
    )
      profileId = null;

    if (!profileId) {
      const detail = await this.cvArchiveService.detailForCompany(
        null,
        card.id,
      );
      const latest = detail.entries[0];
      if (!latest && !override)
        throw new BadRequestException('Thẻ chưa có dữ liệu hồ sơ');
      const draft =
        override ??
        snapshotToDraft(
          latest.snapshot,
          latest.cvParsed as Partial<ParsedCv> | null,
          latest.jobTitle,
        );
      const company = await this.companyRepo.findOne({
        where: { id: card.companyId },
        select: { id: true, name: true },
      });
      const fileEntry = detail.entries.find((e) => e.cvHasFile);
      const file = fileEntry
        ? await this.cvArchiveService
            .getFileForCompany(null, fileEntry.id)
            .catch(() => null)
        : null;
      const created = await this.factory.create(draft, {
        sourceLabel: `Kho CV — ${company?.name ?? 'NTD'}${latest?.entrySource === 'employer_import' ? ' (CV NTD nhập từ nguồn ngoài)' : ''}`,
        file:
          file?.cvFileData && fileEntry
            ? {
                buffer: file.cvFileData,
                mimetype: file.cvMimeType || 'application/octet-stream',
                originalname: file.cvFileName || 'cv',
              }
            : null,
        copyBlockedFromProfileId:
          state === 'locked' || state === 'not_searchable'
            ? card.candidateProfileId
            : null,
      });
      profileId = created.id;
    }

    // Đánh dấu MỌI thẻ của cùng người này (ở mọi công ty) đã chia sẻ, trỏ về cùng 1 bản sao → mọi công
    // ty đã có người này trong Kho CV đều không thấy bản sao trong Tìm CV (khỏi trả điểm cho người quen).
    const toMark = [
      card,
      ...sameCards.filter(
        (c) => c.shareStatus === 'pending' || c.id === card.id,
      ),
    ];
    await this.cardRepo.update(
      { id: In([...new Set(toMark.map((c) => c.id))]) },
      {
        shareStatus: 'shared',
        sharedProfileId: profileId,
        shareDecidedAt: new Date(),
      },
    );
    await logAdminAction(
      this.auditRepo,
      admin,
      'cv.share',
      'candidate_profile',
      profileId,
      card.fullName,
    );
    return { status: 'shared' as const, profileId };
  }

  private async findSamePersonCards(
    card: CvArchiveCandidate,
  ): Promise<CvArchiveCandidate[]> {
    const conds: string[] = [];
    const params: Record<string, string> = { id: card.id };
    if (card.candidateProfileId) {
      conds.push('c.candidate_profile_id = :pid');
      params.pid = card.candidateProfileId;
    }
    if (card.email) {
      conds.push('LOWER(c.email) = :email');
      params.email = card.email.toLowerCase();
    }
    const phone = digitsOnly(card.phone);
    if (phone.length >= 8) {
      conds.push(
        `regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = :phone`,
      );
      params.phone = phone;
    }
    if (conds.length === 0) return [];
    return this.cardRepo
      .createQueryBuilder('c')
      .withDeleted()
      .where('c.id != :id')
      .andWhere(`(${conds.join(' OR ')})`)
      .setParameters(params)
      .getMany();
  }

  async bulkShare(admin: AdminActor, ids: string[]) {
    const result = { shared: 0, alreadyPublic: 0, failed: 0 };
    for (const id of ids.slice(0, 100)) {
      try {
        const r = await this.shareCard(admin, id);
        if (r.status === 'shared') result.shared++;
        else result.alreadyPublic++;
      } catch {
        result.failed++;
      }
    }
    return result;
  }

  async dismissCards(admin: AdminActor, ids: string[]) {
    const unique = [...new Set(ids)].slice(0, 100);
    if (unique.length === 0) return { dismissed: 0 };
    const res = await this.cardRepo
      .createQueryBuilder()
      .update(CvArchiveCandidate)
      .set({ shareStatus: 'dismissed', shareDecidedAt: new Date() })
      .where('id IN (:...ids)', { ids: unique })
      .andWhere("share_status IN ('pending', 'already_public')")
      .execute();
    await logAdminAction(
      this.auditRepo,
      admin,
      'cv.dismiss',
      'cv_archive',
      undefined,
      `${res.affected ?? 0} thẻ`,
    );
    return { dismissed: res.affected ?? 0 };
  }

  // Đưa thẻ đã bỏ qua trở lại hàng chờ.
  async requeueCard(admin: AdminActor, id: string) {
    await this.cardRepo.update(
      { id, shareStatus: In(['dismissed', 'already_public']) },
      { shareStatus: 'pending', shareDecidedAt: null },
    );
    await logAdminAction(this.auditRepo, admin, 'cv.requeue', 'cv_archive', id);
    return { success: true as const };
  }

  // ===================================================================================================
  // Hồ sơ nguồn tổng hợp
  // ===================================================================================================

  async listSourced(query: { q?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
    const qb = this.profileRepo
      .createQueryBuilder('p')
      .where('p.is_admin_sourced = true');
    const terms = normalizeSearchText(query.q)
      .split(' ')
      .filter(Boolean)
      .slice(0, 6);
    terms.forEach((t, i) => {
      qb.andWhere(
        `(${unaccentSql('p.full_name')} LIKE :s${i} OR ${unaccentSql("COALESCE(p.profile_title, '')")} LIKE :s${i}
          OR ${unaccentSql("COALESCE(p.source_label, '')")} LIKE :s${i}
          OR regexp_replace(COALESCE(p.phone, ''), '[^0-9]', '', 'g') LIKE :s${i}
          OR LOWER(COALESCE(p.contact_email, '')) LIKE :s${i})`,
        { [`s${i}`]: `%${t}%` },
      );
    });
    const [rows, total] = await qb
      .orderBy('p.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    const ids = rows.map((r) => r.id);
    const unlockRows = ids.length
      ? await this.unlockedRepo
          .createQueryBuilder('u')
          .select('u.candidate_profile_id', 'pid')
          .addSelect('COUNT(*)', 'count')
          .where('u.candidate_profile_id IN (:...ids)', { ids })
          .groupBy('u.candidate_profile_id')
          .getRawMany<{ pid: string; count: string }>()
      : [];
    const unlocks = new Map(unlockRows.map((r) => [r.pid, Number(r.count)]));
    return {
      items: rows.map((p) => ({
        id: p.id,
        userId: p.userId,
        fullName: p.fullName,
        profileTitle: p.profileTitle ?? null,
        phone: p.phone ?? null,
        email: p.contactEmail ?? null,
        province: p.province ?? null,
        sourceLabel: p.sourceLabel ?? null,
        completionPercent: p.completionPercent,
        unlockCount: unlocks.get(p.id) ?? 0,
        createdAt: p.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  async createSourced(
    admin: AdminActor,
    dto: CandidateDraftDto,
    file?: { buffer: Buffer; mimetype: string; originalname: string } | null,
  ) {
    const label = [
      dto.sourceLabel?.trim() || 'Admin nhập tay',
      dto.sourceUrl?.trim(),
    ]
      .filter(Boolean)
      .join(' · ');
    const profile = await this.factory.create(dto, {
      sourceLabel: label,
      file,
    });
    await logAdminAction(
      this.auditRepo,
      admin,
      'cv.sourced_create',
      'candidate_profile',
      profile.id,
      profile.fullName,
    );
    return { id: profile.id };
  }

  async deleteSourced(admin: AdminActor, profileId: string) {
    const p = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!p || !p.isAdminSourced)
      throw new NotFoundException('Không tìm thấy hồ sơ nguồn tổng hợp');
    const user = await this.userRepo.findOne({ where: { id: p.userId } });
    if (user && !isSourcedPlaceholderEmail(user.email)) {
      throw new BadRequestException(
        'Hồ sơ này đã được người thật nhận lại — không xoá từ đây được',
      );
    }
    await this.dataSource.transaction(async (m) => {
      // Thẻ Kho CV đang trỏ tới bản sao này → "bỏ qua" (không tự động chia sẻ lại).
      await m.update(
        CvArchiveCandidate,
        { sharedProfileId: profileId },
        {
          sharedProfileId: null,
          shareStatus: 'dismissed',
          shareDecidedAt: new Date(),
        },
      );
      if (user)
        await m.delete(User, { id: user.id }); // CASCADE xoá hồ sơ + các mục + CV + lượt mở khoá
      else await m.delete(CandidateProfile, { id: profileId });
    });
    await logAdminAction(
      this.auditRepo,
      admin,
      'cv.sourced_delete',
      'candidate_profile',
      profileId,
      p.fullName,
    );
    return { success: true as const };
  }

  // ===================================================================================================
  // Yêu cầu gỡ / nhận lại hồ sơ
  // ===================================================================================================

  async createPublicRequest(dto: CreateProfileRequestDto) {
    const row = await this.requestRepo.save(
      this.requestRepo.create({
        fullName: dto.fullName.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() || null,
        requestType: dto.requestType,
        note: dto.note?.trim() || null,
      }),
    );
    return { id: row.id, success: true as const };
  }

  async listRequests(status = 'pending') {
    const rows = await this.requestRepo.find({
      where: { status: status as CandidateProfileRequest['status'] },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    // Tự gợi ý hồ sơ nguồn tổng hợp khớp theo email / SĐT / họ tên (không dấu).
    const out = [];
    for (const r of rows) {
      const conds = [`LOWER(COALESCE(p.contact_email, '')) = :email`];
      const params: Record<string, string> = {
        email: r.email.toLowerCase(),
        name: normalizeSearchText(r.fullName),
      };
      const phone = digitsOnly(r.phone);
      if (phone.length >= 8) {
        conds.push(
          `regexp_replace(COALESCE(p.phone, ''), '[^0-9]', '', 'g') = :phone`,
        );
        params.phone = phone;
      }
      conds.push(`${unaccentSql('p.full_name')} = :name`);
      const matches = await this.profileRepo
        .createQueryBuilder('p')
        .where('p.is_admin_sourced = true')
        .andWhere(`(${conds.join(' OR ')})`)
        .setParameters(params)
        .take(10)
        .getMany();
      out.push({
        ...r,
        matches: matches.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          profileTitle: p.profileTitle ?? null,
          phone: p.phone ?? null,
          email: p.contactEmail ?? null,
          sourceLabel: p.sourceLabel ?? null,
        })),
      });
    }
    return out;
  }

  private async getPendingRequest(id: string) {
    const r = await this.requestRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Không tìm thấy yêu cầu');
    if (r.status !== 'pending')
      throw new ConflictException('Yêu cầu này đã được xử lý');
    return r;
  }

  async resolveRemove(
    admin: AdminActor,
    requestId: string,
    profileId: string,
    adminNote?: string,
  ) {
    const r = await this.getPendingRequest(requestId);
    await this.deleteSourced(admin, profileId);
    await this.requestRepo.update(
      { id: r.id },
      {
        status: 'resolved',
        resolvedProfileId: profileId,
        adminNote: adminNote ?? 'Đã gỡ hồ sơ',
        resolvedAt: new Date(),
      },
    );
    return { success: true as const };
  }

  // Chuyển giao hồ sơ cho người thật: đổi email đăng nhập thành email thật + đặt mật khẩu tạm (Admin báo
  // qua kênh ngoài hệ thống — Giai đoạn 1 không gửi email), bỏ nhãn "Nguồn tổng hợp".
  async resolveClaim(
    admin: AdminActor,
    requestId: string,
    profileId: string,
    adminNote?: string,
  ) {
    const r = await this.getPendingRequest(requestId);
    const p = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!p || !p.isAdminSourced)
      throw new NotFoundException('Không tìm thấy hồ sơ nguồn tổng hợp');
    const taken = await this.userRepo
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email: r.email.toLowerCase() })
      .getOne();
    if (taken && taken.id !== p.userId) {
      throw new ConflictException(
        'Email này đã có tài khoản trên web — hãy chọn "Gỡ hồ sơ" (người này đã tự có hồ sơ riêng) hoặc liên hệ họ dùng email khác',
      );
    }
    const tempPassword = randomBytes(6).toString('base64url');
    await this.dataSource.transaction(async (m) => {
      await m.update(
        User,
        { id: p.userId },
        {
          email: r.email.toLowerCase(),
          fullName: r.fullName,
          passwordHash: await argon2.hash(tempPassword),
        },
      );
      await m.update(
        CandidateProfile,
        { id: p.id },
        {
          isAdminSourced: false,
          claimedAt: new Date(),
          allowJobNotifications: true,
          contactEmail: p.contactEmail || r.email,
        },
      );
      await m.update(
        CandidateProfileRequest,
        { id: r.id },
        {
          status: 'resolved',
          resolvedProfileId: p.id,
          adminNote: adminNote ?? 'Đã chuyển giao',
          resolvedAt: new Date(),
        },
      );
    });
    await logAdminAction(
      this.auditRepo,
      admin,
      'cv.sourced_claim',
      'candidate_profile',
      p.id,
      `${p.fullName} → ${r.email}`,
    );
    return { email: r.email.toLowerCase(), tempPassword };
  }

  async rejectRequest(
    admin: AdminActor,
    requestId: string,
    adminNote?: string,
  ) {
    const r = await this.getPendingRequest(requestId);
    await this.requestRepo.update(
      { id: r.id },
      {
        status: 'rejected',
        adminNote: adminNote ?? null,
        resolvedAt: new Date(),
      },
    );
    await logAdminAction(
      this.auditRepo,
      admin,
      'cv.request_reject',
      'candidate_profile_request',
      r.id,
      r.email,
    );
    return { success: true as const };
  }

  // Thống kê nhỏ cho đầu trang.
  async summary() {
    const [pending, sourced, requests, recentShared] = await Promise.all([
      this.cardRepo.count({
        where: { shareStatus: 'pending' },
        withDeleted: true,
      }),
      this.profileRepo.count({ where: { isAdminSourced: true } }),
      this.requestRepo.count({ where: { status: 'pending' } }),
      this.cardRepo.count({
        where: {
          shareStatus: 'shared',
          shareDecidedAt: MoreThanOrEqual(new Date(Date.now() - 7 * 86400000)),
        },
        withDeleted: true,
      }),
    ]);
    return { pending, sourced, requests, sharedLast7Days: recentShared };
  }
}
