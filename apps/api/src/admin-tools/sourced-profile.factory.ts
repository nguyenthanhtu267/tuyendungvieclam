import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'crypto';
import { User, UserRole, UserStatus } from '../database/entities/user.entity';
import {
  CandidateProfile,
  Gender,
  ProfileVisibility,
} from '../database/entities/candidate-profile.entity';
import { CV, CvType } from '../database/entities/cv.entity';
import { BlockedCompany } from '../database/entities/blocked-company.entity';
import {
  CandidateCertificate,
  CandidateEducation,
  CandidateExperience,
  CandidateLanguage,
  CandidateSkill,
  LanguageLevel,
  SkillLevel,
} from '../database/entities/candidate-sections.entity';
import { CandidateDraftDto } from '../common/dto/candidate-draft.dto';
import { ProfileService } from '../candidates/profile.service';

// Đợt 18c (26/09/2026) — tạo "hồ sơ nguồn tổng hợp": 1 User + 1 CandidateProfile THẬT (để dùng lại
// nguyên Tìm CV / mở khoá trừ điểm / ghi chú / mời ứng tuyển có sẵn), nhưng:
//  - email tài khoản là địa chỉ giả nội bộ đuôi `.invalid` (tên miền dành riêng, không bao giờ nhận
//    thư), mật khẩu ngẫu nhiên không ai biết → không ai đăng nhập được, Admin sửa bằng "Đăng nhập thay";
//  - `is_admin_sourced = true` → NTD thấy nhãn "Nguồn tổng hợp"; tắt thông báo việc làm;
//  - chế độ hiển thị Công khai để NTD tìm thấy.
export const SOURCED_EMAIL_DOMAIN = 'nguon-tong-hop.invalid';

export function isSourcedPlaceholderEmail(email?: string | null): boolean {
  return !!email && email.endsWith(`@${SOURCED_EMAIL_DOMAIN}`);
}

const trimOrUndef = (v?: string | null) =>
  v && v.trim() ? v.trim() : undefined;

@Injectable()
export class SourcedProfileFactory {
  constructor(
    private readonly dataSource: DataSource,
    private readonly profileService: ProfileService,
  ) {}

  async create(
    dto: CandidateDraftDto,
    opts: {
      sourceLabel: string;
      file?: { buffer: Buffer; mimetype: string; originalname: string } | null;
      copyBlockedFromProfileId?: string | null;
    },
  ): Promise<CandidateProfile> {
    const title =
      trimOrUndef(dto.profileTitle) ?? trimOrUndef(dto.desiredPosition);
    if (!title) {
      throw new BadRequestException(
        'Vui lòng nhập Tiêu đề hồ sơ (hoặc Vị trí mong muốn) — Tìm CV chỉ hiện hồ sơ có tiêu đề',
      );
    }
    const passwordHash = await argon2.hash(
      randomBytes(24).toString('base64url'),
    );

    const profile = await this.dataSource.transaction(
      async (m: EntityManager) => {
        const user = await m.save(
          User,
          m.create(User, {
            email: `nguon-${randomUUID().slice(0, 13)}@${SOURCED_EMAIL_DOMAIN}`,
            passwordHash,
            role: UserRole.CANDIDATE,
            status: UserStatus.ACTIVE,
            fullName: dto.fullName.trim(),
          }),
        );
        const saved = await m.save(
          CandidateProfile,
          m.create(CandidateProfile, {
            userId: user.id,
            fullName: dto.fullName.trim(),
            profileTitle: title,
            phone: trimOrUndef(dto.phone),
            contactEmail: trimOrUndef(dto.email),
            dateOfBirth: dto.dateOfBirth,
            gender: dto.gender as Gender | undefined,
            province: trimOrUndef(dto.province),
            address: trimOrUndef(dto.address),
            careerObjective: trimOrUndef(dto.careerObjective),
            desiredPosition: trimOrUndef(dto.desiredPosition) ?? title,
            desiredLevel: trimOrUndef(dto.desiredLevel),
            desiredSalaryMin: dto.desiredSalaryMin,
            desiredSalaryMax: dto.desiredSalaryMax,
            yearsOfExperience: dto.yearsOfExperience,
            highestDegree: trimOrUndef(dto.highestDegree),
            desiredIndustries: dto.desiredIndustries?.length
              ? dto.desiredIndustries
              : undefined,
            desiredLocations: dto.desiredLocations?.length
              ? dto.desiredLocations
              : trimOrUndef(dto.province)
                ? [dto.province!.trim()]
                : undefined,
            salaryCurrency: 'VND',
            visibility: ProfileVisibility.PUBLIC,
            allowJobNotifications: false,
            hideContactInfo: false,
            isAdminSourced: true,
            sourceLabel: opts.sourceLabel.slice(0, 250),
          }),
        );

        const pid = saved.id;
        if (dto.experiences?.length) {
          await m.save(
            CandidateExperience,
            dto.experiences.map((e) =>
              m.create(CandidateExperience, {
                candidateProfileId: pid,
                position: e.position.trim(),
                companyName: trimOrUndef(e.companyName),
                startDate: e.startDate,
                endDate: e.isCurrent ? undefined : e.endDate,
                isCurrent: !!e.isCurrent,
                description: trimOrUndef(e.description),
              }),
            ),
          );
        }
        if (dto.educations?.length) {
          await m.save(
            CandidateEducation,
            dto.educations.map((e) =>
              m.create(CandidateEducation, {
                candidateProfileId: pid,
                schoolName: trimOrUndef(e.schoolName),
                degree: trimOrUndef(e.degree),
                major: trimOrUndef(e.major),
                startDate: e.startDate,
                endDate: e.endDate,
              }),
            ),
          );
        }
        const skills = [
          ...new Set((dto.skills ?? []).map((s) => s.trim()).filter(Boolean)),
        ];
        if (skills.length) {
          await m.save(
            CandidateSkill,
            skills.map((skillName) =>
              m.create(CandidateSkill, {
                candidateProfileId: pid,
                skillName,
                level: SkillLevel.INTERMEDIATE,
              }),
            ),
          );
        }
        if (dto.languages?.length) {
          await m.save(
            CandidateLanguage,
            dto.languages.map((l) =>
              m.create(CandidateLanguage, {
                candidateProfileId: pid,
                language: l.language.trim(),
                level: (l.level as LanguageLevel) ?? LanguageLevel.FAIR,
              }),
            ),
          );
        }
        const certs = (dto.certificates ?? [])
          .map((c) => c.trim())
          .filter(Boolean);
        if (certs.length) {
          await m.save(
            CandidateCertificate,
            certs.map((name) =>
              m.create(CandidateCertificate, { candidateProfileId: pid, name }),
            ),
          );
        }
        if (opts.file) {
          const cv = await m.save(
            CV,
            m.create(CV, {
              candidateProfileId: pid,
              type: CvType.UPLOAD,
              originalFileName: opts.file.originalname,
              fileMimeType: opts.file.mimetype,
              fileData: opts.file.buffer,
              isPrimary: true,
            }),
          );
          cv.fileUrl = `/files/cv/${cv.id}`;
          await m.save(CV, cv);
        }
        // Ứng viên thật đã chặn công ty nào thì bản sao cũng chặn đúng các công ty đó.
        if (opts.copyBlockedFromProfileId) {
          const blocked = await m.find(BlockedCompany, {
            where: { candidateProfileId: opts.copyBlockedFromProfileId },
          });
          if (blocked.length) {
            await m.save(
              BlockedCompany,
              blocked.map((b) =>
                m.create(BlockedCompany, {
                  candidateProfileId: pid,
                  companyId: b.companyId,
                  companyNameText: b.companyNameText,
                }),
              ),
            );
          }
        }
        return saved;
      },
    );

    await this.profileService.refreshCompletion(profile.id);
    return profile;
  }
}
