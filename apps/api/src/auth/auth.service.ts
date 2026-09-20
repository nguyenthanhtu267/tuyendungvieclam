import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterEmployerDto } from './dto/register-employer.dto';
import { LoginDto } from './dto/login.dto';
import { User, UserRole } from '../database/entities/user.entity';
import { Company, CompanyApprovalStatus } from '../database/entities/company.entity';
import { CompanyUser, CompanyUserType } from '../database/entities/company-user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(CompanyUser) private readonly companyUserRepo: Repository<CompanyUser>,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email này đã được đăng ký');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.createCandidate({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      phone: dto.phone,
    });

    return this.buildAuthResponse(user.id, user.email, user.role);
  }

  // Đăng ký Nhà tuyển dụng: tạo User(employer_main) + Company + liên kết CompanyUser(main).
  // Quyết định 18/09/2026 (đợt 4, cập nhật đợt 5): nay đã có module Admin (C1) kiểm duyệt,
  // nên công ty mới đăng ký trở lại trạng thái PENDING (chờ Admin duyệt) đúng theo SRS gốc —
  // thay cho quyết định tạm thời tự động duyệt ở đợt 4 (khi chưa có màn Admin).
  // Nhà tuyển dụng vẫn dùng được Dashboard/đăng tin ngay trong lúc chờ duyệt; tin tuyển dụng của
  // họ vẫn cần được Admin duyệt riêng mới hiển thị công khai (xem employer.service.ts::createJob).
  async registerEmployer(dto: RegisterEmployerDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email này đã được đăng ký');
    }
    const existingCompany = await this.companyRepo.findOne({ where: { taxCode: dto.taxCode } });
    if (existingCompany) {
      throw new ConflictException('Mã số thuế này đã được đăng ký');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.userRepo.save(
      this.userRepo.create({
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        role: UserRole.EMPLOYER_MAIN,
      }),
    );

    const company = await this.companyRepo.save(
      this.companyRepo.create({
        name: dto.companyName,
        taxCode: dto.taxCode,
        industry: dto.industry,
        size: dto.size,
        website: dto.website,
        approvalStatus: CompanyApprovalStatus.PENDING,
      }),
    );

    await this.companyUserRepo.save(
      this.companyUserRepo.create({
        companyId: company.id,
        userId: user.id,
        type: CompanyUserType.MAIN,
      }),
    );

    return this.buildAuthResponse(user.id, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const passwordOk = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    return this.buildAuthResponse(user.id, user.email, user.role);
  }

  // Bảo mật (đợt 12a, 20/09/2026) — cho phép người dùng đã đăng nhập tự đổi mật khẩu. Đây là cách
  // thực tế để đóng rủi ro "mật khẩu Admin mẫu lộ trong seed script": sau khi triển khai, đăng
  // nhập bằng mật khẩu mẫu rồi đổi ngay qua endpoint này. Giai đoạn 1 không có email/SMS (quyết
  // định phạm vi ban đầu) nên không làm luồng "quên mật khẩu" tự phục vụ qua email — xem
  // adminResetPassword() ở admin/admin.service.ts cho trường hợp người dùng bị khoá tài khoản.
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('Không tìm thấy tài khoản');
    const ok = await argon2.verify(user.passwordHash, currentPassword);
    if (!ok) throw new BadRequestException('Mật khẩu hiện tại không đúng');
    if (newPassword.length < 6) throw new BadRequestException('Mật khẩu mới phải có ít nhất 6 ký tự');
    user.passwordHash = await argon2.hash(newPassword);
    await this.userRepo.save(user);
    return { success: true };
  }

  private async buildAuthResponse(userId: string, email: string, role: string) {
    const accessToken = await this.jwtService.signAsync({ sub: userId, email, role });
    return {
      accessToken,
      user: { id: userId, email, role },
    };
  }
}
