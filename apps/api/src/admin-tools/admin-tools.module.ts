import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { resolveJwtSecret } from '../config/env-guard';
import {
  CvArchiveCandidate,
  CvArchiveEntry,
} from '../database/entities/cv-archive.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { User } from '../database/entities/user.entity';
import { Company } from '../database/entities/company.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { AdminSetting } from '../database/entities/admin-setting.entity';
import { AdminAuditLog } from '../database/entities/admin-audit-log.entity';
import { UnlockedProfile } from '../database/entities/unlocked-profile.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { Application } from '../database/entities/application.entity';
import {
  AdminCandidateNote,
  CandidateProfileRequest,
} from '../database/entities/admin-tools.entity';
import { CvArchiveModule } from '../cv-archive/cv-archive.module';
import { CandidatesModule } from '../candidates/candidates.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SourcedProfileFactory } from './sourced-profile.factory';
import { CvSourcingService } from './cv-sourcing.service';
import { AdminPeopleService } from './admin-people.service';
import { AdminCandidatesService } from './admin-candidates.service';
import {
  CvSourcingController,
  PublicProfileRequestController,
} from './cv-sourcing.controller';
import { AdminPeopleController } from './admin-people.controller';
import { AdminCandidatesController } from './admin-candidates.controller';

// Đợt 18c–18f (26/09/2026) — nhóm công cụ quản trị mới: nguồn CV tổng hợp, sửa mọi tài khoản + đăng
// nhập thay, quản lý ứng viên thông minh, yêu cầu gỡ/nhận lại hồ sơ.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CvArchiveCandidate,
      CvArchiveEntry,
      CandidateProfile,
      User,
      Company,
      CompanyUser,
      AdminSetting,
      AdminAuditLog,
      UnlockedProfile,
      JobPosting,
      Application,
      AdminCandidateNote,
      CandidateProfileRequest,
    ]),
    CvArchiveModule,
    CandidatesModule,
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: resolveJwtSecret(configService.get<string>('JWT_SECRET')),
      }),
    }),
  ],
  providers: [
    SourcedProfileFactory,
    CvSourcingService,
    AdminPeopleService,
    AdminCandidatesService,
  ],
  controllers: [
    CvSourcingController,
    PublicProfileRequestController,
    AdminPeopleController,
    AdminCandidatesController,
  ],
})
export class AdminToolsModule {}
