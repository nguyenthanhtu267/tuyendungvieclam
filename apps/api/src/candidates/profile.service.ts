import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
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
  UpdatePersonalInfoDto,
  UpdateCareerInfoDto,
  QuickFieldsDto,
  ExperienceDto,
  EducationDto,
  CertificateDto,
  LanguageDto,
  SkillDto,
  AchievementDto,
  ActivityDto,
  ReferenceDto,
} from './dto/profile-sections.dto';
import { sanitizeRichText } from '../common/sanitize-html.util';

// Đợt 12n (21/09/2026) — các mục "danh sách" có ô mô tả dài dùng RichTextEditor ở frontend
// (Kinh nghiệm, Thành tích, Hoạt động) — khử độc HTML khi lưu, xem sanitize-html.util.ts.
const SECTIONS_WITH_RICH_DESCRIPTION = new Set<SectionKey>(['experiences', 'achievements', 'activities']);

export type SectionKey =
  | 'experiences'
  | 'educations'
  | 'certificates'
  | 'languages'
  | 'skills'
  | 'achievements'
  | 'activities'
  | 'references';

const AVATAR_MAX_BYTES = 1 * 1024 * 1024; // 1MB — theo quyết định 18/09/2026

// Đợt 8 — 6 mục bắt buộc để tính "mức độ hoàn thành" (quyết định lúc đó).
// Đợt 13 (24/09/2026) — người dùng chốt lại: CHỈ còn 3 mục bắt buộc để đạt 100% — Tiêu đề hồ sơ,
// Thông tin cá nhân, Kinh nghiệm làm việc. Mục tiêu nghề nghiệp/Học vấn/Kỹ năng chuyên môn (và các
// mục còn lại) chuyển sang không bắt buộc (xem computeSectionStatus() bên dưới).
const REQUIRED_SECTIONS = ['profileTitle', 'personalInfo', 'experiences'] as const;

// Thứ tự 13 mục hiển thị ở mục lục bên phải trang /ho-so/truc-tuyen.
export const SECTION_ORDER = [
  'profileTitle',
  'avatar',
  'personalInfo',
  'careerObjective',
  'careerInfo',
  'experiences',
  'educations',
  'certificates',
  'languages',
  'skills',
  'achievements',
  'activities',
  'references',
] as const;

@Injectable()
export class ProfileService {
  // Ánh xạ mỗi mục "danh sách" (8 mục) tới repo + DTO tương ứng — dùng chung 1 bộ route.
  private sectionRepos: Record<SectionKey, Repository<any>>;
  private sectionDtos: Record<SectionKey, new () => any> = {
    experiences: ExperienceDto,
    educations: EducationDto,
    certificates: CertificateDto,
    languages: LanguageDto,
    skills: SkillDto,
    achievements: AchievementDto,
    activities: ActivityDto,
    references: ReferenceDto,
  };

  constructor(
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
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
  ) {
    this.sectionRepos = {
      experiences: this.experienceRepo,
      educations: this.educationRepo,
      certificates: this.certificateRepo,
      languages: this.languageRepo,
      skills: this.skillRepo,
      achievements: this.achievementRepo,
      activities: this.activityRepo,
      references: this.referenceRepo,
    };
  }

  private async getOwnProfileEntity(userId: string): Promise<CandidateProfile> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');
    return profile;
  }

  private assertSection(section: string): asserts section is SectionKey {
    if (!(section in this.sectionRepos)) throw new NotFoundException('Không tìm thấy mục hồ sơ này');
  }

  async getFullProfile(userId: string) {
    const profile = await this.getOwnProfileEntity(userId);
    const [experiences, educations, certificates, languages, skills, achievements, activities, references] =
      await Promise.all([
        this.experienceRepo.find({ where: { candidateProfileId: profile.id }, order: { startDate: 'DESC' } }),
        this.educationRepo.find({ where: { candidateProfileId: profile.id }, order: { startDate: 'DESC' } }),
        this.certificateRepo.find({ where: { candidateProfileId: profile.id }, order: { issueDate: 'DESC' } }),
        this.languageRepo.find({ where: { candidateProfileId: profile.id } }),
        this.skillRepo.find({ where: { candidateProfileId: profile.id } }),
        this.achievementRepo.find({ where: { candidateProfileId: profile.id }, order: { date: 'DESC' } }),
        this.activityRepo.find({ where: { candidateProfileId: profile.id }, order: { startDate: 'DESC' } }),
        this.referenceRepo.find({ where: { candidateProfileId: profile.id } }),
      ]);

    const sections = { experiences, educations, certificates, languages, skills, achievements, activities, references };
    const status = this.computeSectionStatus(profile, sections);
    return { profile, sections, status };
  }

  computeSectionStatus(profile: CandidateProfile, sections: Record<SectionKey, any[]>) {
    const status: Record<string, 'completed' | 'incomplete' | 'optional'> = {};
    status.profileTitle = profile.profileTitle ? 'completed' : 'incomplete';
    status.avatar = profile.avatarMimeType ? 'completed' : 'optional';
    status.personalInfo =
      profile.lastName && profile.firstName && profile.phone && profile.dateOfBirth ? 'completed' : 'incomplete';
    status.careerObjective = profile.careerObjective ? 'completed' : 'optional';
    // Đợt 13 (24/09/2026) — careerInfo/educations/skills không còn nằm trong REQUIRED_SECTIONS, đổi
    // trạng thái mặc định khi trống từ 'incomplete' sang 'optional' cho khớp (trước đó bị đánh dấu
    // "còn thiếu" dù không còn tính vào % hoàn thành nữa).
    status.careerInfo = profile.desiredPosition && profile.desiredLevel ? 'completed' : 'optional';
    status.experiences = sections.experiences.length > 0 ? 'completed' : 'incomplete';
    status.educations = sections.educations.length > 0 ? 'completed' : 'optional';
    status.certificates = sections.certificates.length > 0 ? 'completed' : 'optional';
    status.languages = sections.languages.length > 0 ? 'completed' : 'optional';
    status.skills = sections.skills.length > 0 ? 'completed' : 'optional';
    status.achievements = sections.achievements.length > 0 ? 'completed' : 'optional';
    status.activities = sections.activities.length > 0 ? 'completed' : 'optional';
    status.references = sections.references.length > 0 ? 'completed' : 'optional';
    return status;
  }

  private percentFromStatus(status: Record<string, string>): number {
    const done = REQUIRED_SECTIONS.filter((k) => status[k] === 'completed').length;
    return Math.round((done / REQUIRED_SECTIONS.length) * 100);
  }

  // Đợt 13 (24/09/2026) — bỏ `private`: đây phải là nguồn tính "mức độ hoàn thành" DUY NHẤT của
  // toàn hệ thống. Trước đó candidates.service.ts có 1 công thức tính hoàn toàn khác (5 tiêu chí cũ:
  // fullName/desiredPosition/desiredLevel/salary/hasCv) và tự ghi đè completionPercent mỗi khi NTD
  // upload CV/đổi trạng thái hiển thị/sửa hồ sơ nhanh — khiến % hiển thị ở /ho-so/truc-tuyen có thể
  // bị ghi đè sai ngay sau khi tính đúng theo REQUIRED_SECTIONS. Nay candidates.service.ts gọi thẳng
  // hàm này thay vì tự tính lấy.
  async refreshCompletion(profileId: string) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) return;
    const [experiences, educations, skills] = await Promise.all([
      this.experienceRepo.count({ where: { candidateProfileId: profileId } }),
      this.educationRepo.count({ where: { candidateProfileId: profileId } }),
      this.skillRepo.count({ where: { candidateProfileId: profileId } }),
    ]);
    const status = this.computeSectionStatus(profile, {
      experiences: new Array(experiences),
      educations: new Array(educations),
      certificates: [],
      languages: [],
      skills: new Array(skills),
      achievements: [],
      activities: [],
      references: [],
    });
    profile.completionPercent = this.percentFromStatus(status);
    await this.profileRepo.save(profile);
  }

  async updatePersonalInfo(userId: string, dto: UpdatePersonalInfoDto) {
    const profile = await this.getOwnProfileEntity(userId);
    Object.assign(profile, dto);
    if (dto.lastName || dto.firstName) {
      profile.fullName = [profile.lastName, profile.firstName].filter(Boolean).join(' ') || profile.fullName;
    }
    const saved = await this.profileRepo.save(profile);
    await this.refreshCompletion(profile.id);
    return saved;
  }

  async updateCareerInfo(userId: string, dto: UpdateCareerInfoDto) {
    const profile = await this.getOwnProfileEntity(userId);
    const min = dto.desiredSalaryMin ?? profile.desiredSalaryMin;
    const max = dto.desiredSalaryMax ?? profile.desiredSalaryMax;
    if (min != null && max != null && min > max) {
      throw new BadRequestException('Mức lương "Từ" không được lớn hơn mức lương "Đến"');
    }
    // "Mục tiêu nghề nghiệp" dùng RichTextEditor ở frontend (/ho-so/truc-tuyen) — khử độc HTML khi lưu.
    Object.assign(profile, dto, {
      careerObjective:
        dto.careerObjective !== undefined ? sanitizeRichText(dto.careerObjective) : profile.careerObjective,
    });
    const saved = await this.profileRepo.save(profile);
    await this.refreshCompletion(profile.id);
    return saved;
  }

  async updateQuickFields(userId: string, dto: QuickFieldsDto) {
    const profile = await this.getOwnProfileEntity(userId);
    Object.assign(profile, dto);
    const saved = await this.profileRepo.save(profile);
    await this.refreshCompletion(profile.id);
    return saved;
  }

  async setAvatar(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng chọn ảnh đại diện');
    if (file.size > AVATAR_MAX_BYTES) {
      throw new BadRequestException('Ảnh đại diện vượt quá 1MB');
    }
    const profile = await this.getOwnProfileEntity(userId);
    profile.avatarData = file.buffer;
    profile.avatarMimeType = file.mimetype;
    await this.profileRepo.save(profile);
    await this.refreshCompletion(profile.id);
    return { avatarUrl: `/files/avatar/${profile.id}` };
  }

  async removeAvatar(userId: string) {
    const profile = await this.getOwnProfileEntity(userId);
    profile.avatarData = null as any;
    profile.avatarMimeType = null as any;
    await this.profileRepo.save(profile);
    await this.refreshCompletion(profile.id);
  }

  private normalizeDateRange<T extends { isCurrent?: boolean; endDate?: string }>(dto: T): T {
    // Đang làm việc/tham gia (isCurrent) thì "Đến ngày" luôn bị khoá và xoá về null (đợt 8 kiểm thử
    // đã kiểm tra ô "Đến ngày" bị khoá trên giao diện — service cũng chặn lại phía sau để nhất quán).
    if (dto.isCurrent) return { ...dto, endDate: undefined };
    return dto;
  }

  private async validateSectionPayload(section: SectionKey, body: unknown) {
    const DtoClass = this.sectionDtos[section];
    const instance = plainToInstance(DtoClass, body, { excludeExtraneousValues: false });
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
      const message = errors
        .flatMap((e) => Object.values(e.constraints ?? {}))
        .join('; ');
      throw new BadRequestException(message || 'Dữ liệu không hợp lệ');
    }
    return instance;
  }

  async listSection(userId: string, section: string) {
    this.assertSection(section);
    const profile = await this.getOwnProfileEntity(userId);
    return this.sectionRepos[section].find({ where: { candidateProfileId: profile.id } });
  }

  private sanitizeSectionPayload(section: SectionKey, payload: any) {
    if (SECTIONS_WITH_RICH_DESCRIPTION.has(section) && 'description' in payload) {
      payload.description = sanitizeRichText(payload.description);
    }
    return payload;
  }

  async addSectionItem(userId: string, section: string, body: unknown) {
    this.assertSection(section);
    const profile = await this.getOwnProfileEntity(userId);
    let payload = await this.validateSectionPayload(section, body);
    payload = this.normalizeDateRange(payload as any);
    payload = this.sanitizeSectionPayload(section, payload);
    const repo = this.sectionRepos[section];
    const row = repo.create({ ...payload, candidateProfileId: profile.id });
    const saved = await repo.save(row);
    await this.refreshCompletion(profile.id);
    return saved;
  }

  async updateSectionItem(userId: string, section: string, id: string, body: unknown) {
    this.assertSection(section);
    const profile = await this.getOwnProfileEntity(userId);
    const repo = this.sectionRepos[section];
    const existing = await repo.findOne({ where: { id } });
    if (!existing || existing.candidateProfileId !== profile.id) {
      throw new ForbiddenException('Bạn không có quyền sửa mục này');
    }
    let payload = await this.validateSectionPayload(section, body);
    payload = this.normalizeDateRange(payload as any);
    payload = this.sanitizeSectionPayload(section, payload);
    Object.assign(existing, payload);
    const saved = await repo.save(existing);
    await this.refreshCompletion(profile.id);
    return saved;
  }

  async removeSectionItem(userId: string, section: string, id: string) {
    this.assertSection(section);
    const profile = await this.getOwnProfileEntity(userId);
    const repo = this.sectionRepos[section];
    const existing = await repo.findOne({ where: { id } });
    if (!existing || existing.candidateProfileId !== profile.id) {
      throw new ForbiddenException('Bạn không có quyền xóa mục này');
    }
    await repo.remove(existing);
    await this.refreshCompletion(profile.id);
  }
}
