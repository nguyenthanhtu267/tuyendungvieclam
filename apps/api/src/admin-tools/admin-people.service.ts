import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../database/entities/user.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { Company } from '../database/entities/company.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { AdminAuditLog } from '../database/entities/admin-audit-log.entity';
import { ProfileService } from '../candidates/profile.service';
import { UserStatusCache } from '../auth/user-status.cache';
import { digitsOnly, normalizeSearchText } from '../common/search-text.util';
import { unaccentSql } from '../common/sql-unaccent.util';
import { AdminActor, logAdminAction } from './admin-audit';
import { SOURCED_EMAIL_DOMAIN } from './sourced-profile.factory';
import {
  PeopleQueryDto,
  UpdateCandidateBasicDto,
  UpdateCompanyInfoDto,
  UpdateUserDto,
} from './dto/admin-tools.dto';

// Đợt 18e (26/09/2026) — "Admin sửa được MỌI thông tin" (theo lựa chọn người dùng: sửa nhanh ngay trong
// Admin + "Đăng nhập thay"):
//  - Danh sách mọi tài khoản (ứng viên / NTD / quản trị), tìm theo email, họ tên, SĐT, tên công ty — gõ
//    không dấu vẫn ra.
//  - Sửa nhanh: họ tên, email đăng nhập, SĐT, khoá/mở khoá; thông tin công ty; thông tin chính của hồ sơ
//    ứng viên. Tài khoản quản trị chỉ Admin (không phải Moderator) sửa được.
//  - "Đăng nhập thay": cấp token 2 giờ của người dùng đó cho Admin để sửa 100% mọi thứ qua đúng giao
//    diện của họ (hồ sơ 13 mục, tin đăng, đội ngũ…). Chỉ Admin, chỉ vào tài khoản ứng viên/NTD, luôn ghi
//    nhật ký thao tác.

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.MODERATOR];
const IMPERSONATE_ROLES = [
  UserRole.CANDIDATE,
  UserRole.EMPLOYER_MAIN,
  UserRole.EMPLOYER_SUB,
];

@Injectable()
export class AdminPeopleService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(CompanyUser)
    private readonly companyUserRepo: Repository<CompanyUser>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(AdminAuditLog)
    private readonly auditRepo: Repository<AdminAuditLog>,
    private readonly profileService: ProfileService,
    private readonly jwtService: JwtService,
  ) {}

  async list(q: PeopleQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoin(CompanyUser, 'cu', 'cu.user_id = u.id')
      .leftJoin(Company, 'co', 'co.id = cu.company_id')
      .leftJoin(CandidateProfile, 'cp', 'cp.user_id = u.id');
    if (q.role === 'candidate')
      qb.andWhere('u.role = :r', { r: UserRole.CANDIDATE });
    if (q.role === 'employer')
      qb.andWhere('u.role IN (:...r)', {
        r: [UserRole.EMPLOYER_MAIN, UserRole.EMPLOYER_SUB],
      });
    if (q.role === 'admin')
      qb.andWhere('u.role IN (:...r)', { r: ADMIN_ROLES });
    if (q.status) qb.andWhere('u.status = :status', { status: q.status });
    if (!q.includeSourced)
      qb.andWhere('u.email NOT LIKE :sourced', {
        sourced: `%@${SOURCED_EMAIL_DOMAIN}`,
      });
    normalizeSearchText(q.q)
      .split(' ')
      .filter(Boolean)
      .slice(0, 6)
      .forEach((t, i) => {
        const digits = digitsOnly(t);
        qb.andWhere(
          `(${unaccentSql('u.email')} LIKE :k${i} OR ${unaccentSql("COALESCE(u.full_name, '')")} LIKE :k${i}
            OR ${unaccentSql("COALESCE(cp.full_name, '')")} LIKE :k${i} OR ${unaccentSql("COALESCE(co.name, '')")} LIKE :k${i}
            ${digits.length >= 3 ? `OR regexp_replace(COALESCE(u.phone, '') || ' ' || COALESCE(cp.phone, ''), '[^0-9]', '', 'g') LIKE :d${i}` : ''})`,
          { [`k${i}`]: `%${t}%`, [`d${i}`]: `%${digits}%` },
        );
      });
    const total = await qb.getCount();
    const rows = await qb
      .select([
        'u.id AS id',
        'u.email AS email',
        'u.full_name AS "userFullName"',
        'u.phone AS "userPhone"',
        'u.role AS role',
        'u.status AS status',
        'u.created_at AS "createdAt"',
        'co.id AS "companyId"',
        'co.name AS "companyName"',
        'cu.type AS "companyUserType"',
        'cp.id AS "profileId"',
        'cp.full_name AS "profileFullName"',
        'cp.phone AS "profilePhone"',
        'cp.is_admin_sourced AS "isAdminSourced"',
      ])
      .orderBy('u.created_at', 'DESC')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<Record<string, string | boolean | Date | null>>();
    return {
      items: rows.map((r) => ({
        id: r.id,
        email: r.email,
        fullName:
          (r.profileFullName as string) || (r.userFullName as string) || null,
        phone: (r.userPhone as string) || (r.profilePhone as string) || null,
        role: r.role,
        status: r.status,
        createdAt: r.createdAt,
        companyId: r.companyId ?? null,
        companyName: r.companyName ?? null,
        companyUserType: r.companyUserType ?? null,
        profileId: r.profileId ?? null,
        isAdminSourced: !!r.isAdminSourced,
      })),
      total,
      page,
      pageSize,
    };
  }

  async detail(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    const link = await this.companyUserRepo.findOne({ where: { userId } });
    const company = link
      ? await this.companyRepo.findOne({ where: { id: link.companyId } })
      : null;
    const profile = await this.profileRepo.findOne({ where: { userId } });
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName ?? null,
        phone: user.phone ?? null,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
      company: company
        ? {
            id: company.id,
            name: company.name,
            taxCode: company.taxCode,
            industry: company.industry ?? null,
            size: company.size ?? null,
            website: company.website ?? null,
            logoUrl: company.logoUrl ?? null,
            description: company.description ?? null,
            approvalStatus: company.approvalStatus,
            companyUserType: link?.type ?? null,
          }
        : null,
      profile: profile
        ? {
            id: profile.id,
            fullName: profile.fullName,
            profileTitle: profile.profileTitle ?? null,
            phone: profile.phone ?? null,
            contactEmail: profile.contactEmail ?? null,
            province: profile.province ?? null,
            desiredPosition: profile.desiredPosition ?? null,
            visibility: profile.visibility,
            hideContactInfo: profile.hideContactInfo,
            completionPercent: profile.completionPercent,
            isAdminSourced: profile.isAdminSourced,
            sourceLabel: profile.sourceLabel ?? null,
          }
        : null,
    };
  }

  private assertCanManage(admin: AdminActor, target: User) {
    if (ADMIN_ROLES.includes(target.role) && admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Chỉ Admin mới sửa được tài khoản quản trị');
    }
  }

  async updateUser(admin: AdminActor, userId: string, dto: UpdateUserDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    this.assertCanManage(admin, user);
    const changes: string[] = [];
    if (dto.status !== undefined && dto.status !== user.status) {
      if (user.id === admin.userId)
        throw new BadRequestException(
          'Không thể tự khoá tài khoản của chính mình',
        );
      user.status = dto.status;
      changes.push(`trạng thái → ${dto.status}`);
    }
    if (dto.role !== undefined && dto.role !== user.role) {
      if (admin.role !== UserRole.ADMIN)
        throw new ForbiddenException('Chỉ Admin mới đổi được vai trò');
      if (!ADMIN_ROLES.includes(user.role))
        throw new BadRequestException(
          'Chỉ đổi vai trò giữa Admin và Moderator',
        );
      if (user.id === admin.userId)
        throw new BadRequestException(
          'Không thể tự đổi vai trò của chính mình',
        );
      user.role = dto.role;
      changes.push(`vai trò → ${dto.role}`);
    }
    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (email !== user.email.toLowerCase()) {
        const taken = await this.userRepo
          .createQueryBuilder('u')
          .where('LOWER(u.email) = :email AND u.id != :id', {
            email,
            id: user.id,
          })
          .getOne();
        if (taken)
          throw new ConflictException(
            'Email này đã được tài khoản khác sử dụng',
          );
        user.email = email;
        changes.push(`email → ${email}`);
      }
    }
    if (dto.fullName !== undefined) {
      user.fullName = dto.fullName.trim() || null;
      changes.push('họ tên');
    }
    if (dto.phone !== undefined) {
      user.phone = dto.phone.trim() || null;
      changes.push('SĐT');
    }
    await this.userRepo.save(user);
    UserStatusCache.invalidate(user.id);
    await logAdminAction(
      this.auditRepo,
      admin,
      'user.update',
      'user',
      user.id,
      `${user.email}: ${changes.join(', ') || 'không đổi'}`,
    );
    return this.detail(user.id);
  }

  async updateCompany(
    admin: AdminActor,
    companyId: string,
    dto: UpdateCompanyInfoDto,
  ) {
    const company = await this.companyRepo.findOne({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');
    if (dto.taxCode !== undefined && dto.taxCode.trim() !== company.taxCode) {
      const taken = await this.companyRepo.findOne({
        where: { taxCode: dto.taxCode.trim() },
      });
      if (taken && taken.id !== company.id)
        throw new ConflictException('Mã số thuế đã thuộc công ty khác');
      company.taxCode = dto.taxCode.trim();
    }
    if (dto.name !== undefined) company.name = dto.name.trim();
    if (dto.industry !== undefined)
      company.industry = dto.industry.trim() || null;
    if (dto.size !== undefined) company.size = dto.size.trim() || null;
    if (dto.website !== undefined) company.website = dto.website.trim() || null;
    if (dto.logoUrl !== undefined) company.logoUrl = dto.logoUrl.trim() || null;
    if (dto.description !== undefined)
      company.description = dto.description.trim() || null;
    await this.companyRepo.save(company);
    await logAdminAction(
      this.auditRepo,
      admin,
      'company.admin_edit',
      'company',
      company.id,
      company.name,
    );
    return { success: true as const };
  }

  async updateCandidate(
    admin: AdminActor,
    profileId: string,
    dto: UpdateCandidateBasicDto,
  ) {
    const profile = await this.profileRepo.findOne({
      where: { id: profileId },
    });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');
    if (dto.fullName !== undefined) {
      profile.fullName = dto.fullName.trim();
      // Họ/tên tách riêng của hồ sơ 13 mục không còn khớp → xoá để giao diện hiện đúng họ tên mới.
      profile.lastName = null;
      profile.firstName = null;
    }
    if (dto.profileTitle !== undefined)
      profile.profileTitle = dto.profileTitle.trim() || null;
    if (dto.phone !== undefined) profile.phone = dto.phone.trim() || null;
    if (dto.contactEmail !== undefined)
      profile.contactEmail = dto.contactEmail.trim() || null;
    if (dto.province !== undefined)
      profile.province = dto.province.trim() || null;
    if (dto.desiredPosition !== undefined)
      profile.desiredPosition = dto.desiredPosition.trim() || null;
    if (dto.visibility !== undefined) profile.visibility = dto.visibility;
    if (dto.hideContactInfo !== undefined)
      profile.hideContactInfo = dto.hideContactInfo;
    await this.profileRepo.save(profile);
    await this.profileService.refreshCompletion(profile.id);
    await logAdminAction(
      this.auditRepo,
      admin,
      'candidate.admin_edit',
      'candidate_profile',
      profile.id,
      profile.fullName,
    );
    return { success: true as const };
  }

  async impersonate(admin: AdminActor, userId: string) {
    if (admin.role !== UserRole.ADMIN)
      throw new ForbiddenException('Chỉ Admin mới dùng được "Đăng nhập thay"');
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    if (!IMPERSONATE_ROLES.includes(user.role)) {
      throw new BadRequestException(
        'Chỉ đăng nhập thay được tài khoản ứng viên hoặc nhà tuyển dụng',
      );
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new BadRequestException(
        'Tài khoản đang bị khoá — mở khoá trước khi đăng nhập thay',
      );
    }
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role, imp: admin.userId },
      { expiresIn: '2h' },
    );
    await logAdminAction(
      this.auditRepo,
      admin,
      'user.impersonate',
      'user',
      user.id,
      user.email,
    );
    return {
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
      expiresInMinutes: 120,
    };
  }
}
