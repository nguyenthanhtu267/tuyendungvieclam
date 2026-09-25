import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CV, CvType } from '../database/entities/cv.entity';
import { SavedJob } from '../database/entities/saved-job.entity';
import { BlockedCompany } from '../database/entities/blocked-company.entity';
import { JobPosting, JobApprovalStatus } from '../database/entities/job-posting.entity';
import { SearchHistory } from '../database/entities/search-history.entity';
import { UnlockedProfile } from '../database/entities/unlocked-profile.entity';
import { CompanyFollow } from '../database/entities/company-follow.entity';
import { Company } from '../database/entities/company.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { BlockCompanyDto } from './dto/block-company.dto';
import { SaveSearchDto } from './dto/save-search.dto';
import { resolveCompanyLogoUrl } from '../common/company-logo.util';
import { ProfileService } from './profile.service';

const CV_MAX_BYTES = 2 * 1024 * 1024; // 2MB — theo Mục 9 SRS
// Đợt 12ab (24/09/2026) — "làm mới hồ sơ" tối đa 2 CV theo yêu cầu (mẫu careerviet.vn).
const CV_MAX_COUNT = 2;
// "Làm mới hồ sơ" — giãn cách tối thiểu giữa 2 lần làm mới, tránh ứng viên bấm liên tục để luôn đứng
// đầu danh sách tìm kiếm (profile.updated_at DESC là tiêu chí sắp xếp phụ ở cv-search.service.ts).
const REFRESH_COOLDOWN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CandidatesService {
  constructor(
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(CV)
    private readonly cvRepo: Repository<CV>,
    @InjectRepository(SavedJob)
    private readonly savedJobRepo: Repository<SavedJob>,
    @InjectRepository(BlockedCompany)
    private readonly blockedCompanyRepo: Repository<BlockedCompany>,
    @InjectRepository(JobPosting)
    private readonly jobRepo: Repository<JobPosting>,
    @InjectRepository(SearchHistory)
    private readonly searchHistoryRepo: Repository<SearchHistory>,
    @InjectRepository(UnlockedProfile)
    private readonly unlockedRepo: Repository<UnlockedProfile>,
    @InjectRepository(CompanyFollow)
    private readonly followRepo: Repository<CompanyFollow>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    // Đợt 13 (24/09/2026) — dùng ProfileService.refreshCompletion() làm nguồn tính "mức độ hoàn
    // thành" DUY NHẤT (xem ghi chú ở profile.service.ts), thay cho công thức 5 tiêu chí cũ riêng
    // của service này đã bị xoá bên dưới.
    private readonly profileService: ProfileService,
  ) {}

  async getOwnProfile(userId: string): Promise<CandidateProfile> {
    const profile = await this.profileRepo.findOne({ where: { userId }, relations: { cvs: true } });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');
    return profile;
  }

  async updateOwnProfile(userId: string, dto: UpdateProfileDto): Promise<CandidateProfile> {
    const profile = await this.getOwnProfile(userId);
    Object.assign(profile, dto);
    const saved = await this.profileRepo.save(profile);
    await this.profileService.refreshCompletion(profile.id);
    // refreshCompletion() lưu completionPercent mới ở bản ghi riêng của nó — nạp lại để trả về đúng
    // giá trị mới nhất cho FE thay vì bản `saved` đã cũ (chưa có % mới).
    return (await this.profileRepo.findOne({ where: { id: profile.id }, relations: { cvs: true } })) ?? saved;
  }

  async listOwnCvs(userId: string): Promise<CV[]> {
    const profile = await this.getOwnProfile(userId);
    return this.cvRepo.find({ where: { candidateProfileId: profile.id }, order: { createdAt: 'DESC' } });
  }

  async addCvFromUpload(userId: string, file: Express.Multer.File): Promise<CV> {
    if (!file) throw new BadRequestException('Vui lòng chọn tệp CV');
    if (file.size > CV_MAX_BYTES) {
      throw new BadRequestException('Tệp CV vượt quá 2MB — vui lòng dán link Google Drive thay thế');
    }
    const profile = await this.getOwnProfile(userId);
    if ((profile.cvs?.length ?? 0) >= CV_MAX_COUNT) {
      throw new BadRequestException(`Bạn chỉ có thể đính kèm tối đa ${CV_MAX_COUNT} CV — vui lòng xoá bớt trước khi thêm CV mới`);
    }
    const isFirst = (profile.cvs?.length ?? 0) === 0;
    const cv = this.cvRepo.create({
      candidateProfileId: profile.id,
      type: CvType.UPLOAD,
      originalFileName: file.originalname,
      fileData: file.buffer,
      fileMimeType: file.mimetype,
      isPrimary: isFirst,
    });
    const saved = await this.cvRepo.save(cv);
    // fileUrl trỏ vào route phục vụ tệp từ CSDL (FilesController) — chỉ đặt được sau khi có id.
    saved.fileUrl = `/files/cv/${saved.id}`;
    await this.cvRepo.save(saved);
    await this.profileService.refreshCompletion(profile.id);
    return saved;
  }

  async addCvFromLink(userId: string, externalLinkUrl: string): Promise<CV> {
    const profile = await this.getOwnProfile(userId);
    if ((profile.cvs?.length ?? 0) >= CV_MAX_COUNT) {
      throw new BadRequestException(`Bạn chỉ có thể đính kèm tối đa ${CV_MAX_COUNT} CV — vui lòng xoá bớt trước khi thêm CV mới`);
    }
    const isFirst = (profile.cvs?.length ?? 0) === 0;
    const cv = this.cvRepo.create({
      candidateProfileId: profile.id,
      type: CvType.UPLOAD,
      externalLinkUrl,
      isPrimary: isFirst,
    });
    const saved = await this.cvRepo.save(cv);
    await this.profileService.refreshCompletion(profile.id);
    return saved;
  }

  async removeCv(userId: string, cvId: string): Promise<void> {
    const profile = await this.getOwnProfile(userId);
    const cv = await this.cvRepo.findOne({ where: { id: cvId } });
    if (!cv || cv.candidateProfileId !== profile.id) throw new NotFoundException('Không tìm thấy CV');
    await this.cvRepo.remove(cv);
    if (cv.isPrimary) {
      const remaining = await this.cvRepo.find({ where: { candidateProfileId: profile.id }, order: { createdAt: 'ASC' } });
      if (remaining[0]) {
        remaining[0].isPrimary = true;
        await this.cvRepo.save(remaining[0]);
      }
    }
    await this.profileService.refreshCompletion(profile.id);
  }

  async setPrimaryCv(userId: string, cvId: string): Promise<CV> {
    const profile = await this.getOwnProfile(userId);
    const cvs = await this.cvRepo.find({ where: { candidateProfileId: profile.id } });
    const target = cvs.find((c) => c.id === cvId);
    if (!target) throw new NotFoundException('Không tìm thấy CV');
    for (const c of cvs) {
      c.isPrimary = c.id === cvId;
    }
    await this.cvRepo.save(cvs);
    return target;
  }

  async listSavedJobs(userId: string) {
    const profile = await this.getOwnProfile(userId);
    const rows = await this.savedJobRepo.find({
      where: { candidateProfileId: profile.id },
      relations: { jobPosting: { company: true } },
      order: { createdAt: 'DESC' },
    });
    // Đợt 16 (25/09/2026) — mục 22a danh sách lỗi: favicon tự động theo website khi chưa có logoUrl.
    for (const r of rows) {
      if (r.jobPosting?.company) r.jobPosting.company.logoUrl = resolveCompanyLogoUrl(r.jobPosting.company);
    }
    return rows;
  }

  async saveJob(userId: string, jobId: string) {
    const profile = await this.getOwnProfile(userId);
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    const existing = await this.savedJobRepo.findOne({
      where: { candidateProfileId: profile.id, jobPostingId: jobId },
    });
    if (existing) return existing;
    return this.savedJobRepo.save(
      this.savedJobRepo.create({ candidateProfileId: profile.id, jobPostingId: jobId }),
    );
  }

  async unsaveJob(userId: string, jobId: string) {
    const profile = await this.getOwnProfile(userId);
    await this.savedJobRepo.delete({ candidateProfileId: profile.id, jobPostingId: jobId });
  }

  async listBlockedCompanies(userId: string) {
    const profile = await this.getOwnProfile(userId);
    return this.blockedCompanyRepo.find({
      where: { candidateProfileId: profile.id },
      relations: { company: true },
      order: { createdAt: 'DESC' },
    });
  }

  async blockCompany(userId: string, dto: BlockCompanyDto) {
    if (!dto.companyId && !dto.companyNameText) {
      throw new BadRequestException('Cần chọn công ty hoặc nhập tên công ty');
    }
    const profile = await this.getOwnProfile(userId);
    return this.blockedCompanyRepo.save(
      this.blockedCompanyRepo.create({
        candidateProfileId: profile.id,
        companyId: dto.companyId,
        companyNameText: dto.companyNameText,
      }),
    );
  }

  async unblockCompany(userId: string, blockId: string) {
    const profile = await this.getOwnProfile(userId);
    const row = await this.blockedCompanyRepo.findOne({ where: { id: blockId } });
    if (!row || row.candidateProfileId !== profile.id) throw new ForbiddenException();
    await this.blockedCompanyRepo.remove(row);
  }

  // Đợt 12m (21/09/2026) — "Tìm kiếm đã lưu" (Job alert): bảng search_histories vốn có sẵn nhưng
  // trước đây không module nào đọc/ghi. owner_type cố định 'candidate_profile' để tách khỏi lượt
  // dùng của NTD tìm hồ sơ (owner_type 'company', nếu sau này cần). Khi có tin mới được Admin duyệt
  // khớp tiêu chí đã lưu, notifyJobAlertMatches() ở admin.service.ts sẽ báo qua chuông thông báo.
  async listSavedSearches(userId: string) {
    const profile = await this.getOwnProfile(userId);
    return this.searchHistoryRepo.find({
      where: { ownerType: 'candidate_profile', ownerId: profile.id },
      order: { createdAt: 'DESC' },
    });
  }

  async saveSearch(userId: string, dto: SaveSearchDto) {
    const profile = await this.getOwnProfile(userId);
    return this.searchHistoryRepo.save(
      this.searchHistoryRepo.create({
        ownerType: 'candidate_profile',
        ownerId: profile.id,
        criteria: dto.criteria,
        resultCount: dto.resultCount ?? 0,
      }),
    );
  }

  async removeSavedSearch(userId: string, id: string) {
    const profile = await this.getOwnProfile(userId);
    const row = await this.searchHistoryRepo.findOne({ where: { id } });
    if (!row || row.ownerType !== 'candidate_profile' || row.ownerId !== profile.id) {
      throw new ForbiddenException();
    }
    await this.searchHistoryRepo.remove(row);
  }

  // Đợt 12p (21/09/2026) — Batch 4 mục #2 "Gợi ý việc làm thông minh hơn": thay vì chỉ tìm chuỗi
  // theo "Vị trí mong muốn" (cách cũ, xem lịch sử ho-so/page.tsx trước đợt này), chấm điểm mỗi tin
  // theo NHIỀU tiêu chí khớp với hồ sơ ứng viên — ngành nghề, địa điểm, hình thức làm việc, cấp bậc,
  // kỹ năng/vị trí mong muốn (khớp tiêu đề tin) — cộng dồn điểm rồi sắp theo điểm cao nhất, mới nhất.
  // Chỉ trả tin có điểm > 0 (khớp ít nhất 1 tiêu chí) để tránh gợi ý ngẫu nhiên không liên quan.
  async getRecommendedJobs(userId: string, limit = 6) {
    const profile = await this.profileRepo.findOne({ where: { userId }, relations: { skills: true } });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');

    const industries = (profile.desiredIndustries ?? []).filter(Boolean);
    const locations = [...(profile.desiredLocations ?? []), profile.province].filter(Boolean) as string[];
    const jobTypes = (profile.desiredJobTypes ?? []).filter(Boolean);
    const skillNames = (profile.skills ?? []).map((s) => s.skillName).filter(Boolean);
    const keywords = [profile.desiredPosition, ...skillNames].filter(Boolean) as string[];

    // Hồ sơ chưa đủ thông tin để gợi ý có ý nghĩa — trả rỗng, FE hiện hướng dẫn điền hồ sơ.
    if (!industries.length && !locations.length && !jobTypes.length && !keywords.length && !profile.desiredLevel) {
      return [];
    }

    const blocked = await this.blockedCompanyRepo.find({ where: { candidateProfileId: profile.id } });
    const blockedCompanyIds = blocked.map((b) => b.companyId);

    const qb = this.jobRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.company', 'company')
      .where('job.approvalStatus = :status', { status: JobApprovalStatus.APPROVED })
      .andWhere('job.isPaused = false');

    if (blockedCompanyIds.length) {
      qb.andWhere('job.companyId NOT IN (:...blockedCompanyIds)', { blockedCompanyIds });
    }

    const scoreParts: string[] = [];
    if (industries.length) {
      qb.setParameter('industries', industries);
      scoreParts.push('(CASE WHEN job.industry IN (:...industries) THEN 3 ELSE 0 END)');
    }
    if (locations.length) {
      const locConds = locations.map((_, i) => `job.provinces ILIKE :loc${i}`);
      locations.forEach((v, i) => qb.setParameter(`loc${i}`, `%${v}%`));
      scoreParts.push(`(CASE WHEN (${locConds.join(' OR ')}) THEN 3 ELSE 0 END)`);
    }
    if (jobTypes.length) {
      qb.setParameter('jobTypes', jobTypes);
      scoreParts.push('(CASE WHEN job.employmentType IN (:...jobTypes) THEN 2 ELSE 0 END)');
    }
    if (profile.desiredLevel) {
      qb.setParameter('level', profile.desiredLevel);
      scoreParts.push('(CASE WHEN job.level = :level THEN 2 ELSE 0 END)');
    }
    if (keywords.length) {
      const kwConds = keywords.map((_, i) => `job.title ILIKE :kw${i}`);
      keywords.forEach((v, i) => qb.setParameter(`kw${i}`, `%${v}%`));
      scoreParts.push(`(CASE WHEN (${kwConds.join(' OR ')}) THEN 2 ELSE 0 END)`);
    }
    if (profile.desiredSalaryMin) {
      qb.setParameter('salaryMin', profile.desiredSalaryMin);
      scoreParts.push('(CASE WHEN job.salaryMax IS NULL OR job.salaryMax >= :salaryMin THEN 1 ELSE 0 END)');
    }

    const scoreExpr = scoreParts.length ? scoreParts.join(' + ') : '0';

    const jobs = await qb
      .andWhere(`(${scoreExpr}) > 0`)
      .orderBy(scoreExpr, 'DESC')
      .addOrderBy('job.createdAt', 'DESC')
      .take(limit)
      .getMany();

    return jobs;
  }

  // ===== Đợt 12ab (24/09/2026) — "Làm mới hồ sơ" =====
  // CareerViet: ứng viên bấm "Làm mới hồ sơ" để đẩy hồ sơ lên đầu danh sách tìm kiếm của NTD (dùng
  // cùng `updatedAt` mà cv-search.service.ts đã lấy làm tiêu chí sắp xếp phụ — `ORDER BY ...
  // profile.updated_at DESC`), có giãn cách 24h/lần để tránh lạm dụng.
  async refreshProfile(userId: string): Promise<CandidateProfile> {
    const profile = await this.getOwnProfile(userId);
    const msSinceUpdate = Date.now() - new Date(profile.updatedAt).getTime();
    if (msSinceUpdate < REFRESH_COOLDOWN_MS) {
      const hoursLeft = Math.ceil((REFRESH_COOLDOWN_MS - msSinceUpdate) / (60 * 60 * 1000));
      throw new BadRequestException(`Bạn vừa làm mới hồ sơ gần đây — vui lòng thử lại sau khoảng ${hoursLeft} giờ nữa`);
    }
    // .save() với entity đã tải sẵn sẽ tự cập nhật updated_at (UpdateDateColumn) dù không đổi field
    // nào khác — không cần chạm dữ liệu thật, chỉ cần "chạm" bản ghi.
    return this.profileRepo.save(profile);
  }

  // ===== Đợt 12ab (24/09/2026) — "Nhà tuyển dụng của tôi" =====
  // Chiều ngược của CvSearchService.listUnlocked() (đó là "các hồ sơ NTD đã mở", đây là "các công ty
  // đã xem hồ sơ CỦA TÔI") — cùng dựa trên bảng unlocked_profiles đã có sẵn từ Đợt 9, không cần bảng
  // mới. Chỉ trả về công ty (không lộ thêm gì khác) + thời điểm xem gần nhất.
  async listViewedByCompanies(userId: string) {
    const profile = await this.getOwnProfile(userId);
    const rows = await this.unlockedRepo.find({
      where: { candidateProfileId: profile.id },
      relations: { company: true },
      order: { unlockedAt: 'DESC' },
    });
    return rows
      .filter((r) => r.company)
      .map((r) => ({
        viewedAt: r.unlockedAt,
        company: {
          id: r.company.id,
          name: r.company.name,
          industry: r.company.industry,
          size: r.company.size,
          logoUrl: resolveCompanyLogoUrl(r.company),
        },
      }));
  }

  async listFollowedCompanies(userId: string) {
    const profile = await this.getOwnProfile(userId);
    const rows = await this.followRepo.find({
      where: { candidateProfileId: profile.id },
      relations: { company: true },
      order: { createdAt: 'DESC' },
    });
    const filtered = rows.filter((r) => r.company);
    // Đợt 16 (25/09/2026) — mục 22a danh sách lỗi: favicon tự động theo website khi chưa có logoUrl.
    for (const r of filtered) {
      r.company.logoUrl = resolveCompanyLogoUrl(r.company);
    }
    return filtered;
  }

  async followCompany(userId: string, companyId: string) {
    const profile = await this.getOwnProfile(userId);
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');
    const existing = await this.followRepo.findOne({
      where: { candidateProfileId: profile.id, companyId },
    });
    if (existing) return existing;
    return this.followRepo.save(this.followRepo.create({ candidateProfileId: profile.id, companyId }));
  }

  async unfollowCompany(userId: string, companyId: string) {
    const profile = await this.getOwnProfile(userId);
    await this.followRepo.delete({ candidateProfileId: profile.id, companyId });
  }
}
