import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { JobsModule } from './jobs/jobs.module';
import { CandidatesModule } from './candidates/candidates.module';
import { ApplicationsModule } from './applications/applications.module';
import { EmployerModule } from './employer/employer.module';
import { AdminModule } from './admin/admin.module';
import { FilesModule } from './files/files.module';
import { CvSearchModule } from './cv-search/cv-search.module';
import { HealthModule } from './health/health.module';
import { PresenceModule } from './presence/presence.module';
import { isProduction } from './config/env-guard';
import {
  User,
  CandidateProfile,
  CV,
  Company,
  CompanyUser,
  JobPosting,
  Application,
  SavedJob,
  BlockedCompany,
  SearchHistory,
  ServicePackage,
  Order,
  Payment,
  Invoice,
  Notification,
  CandidateExperience,
  CandidateEducation,
  CandidateCertificate,
  CandidateLanguage,
  CandidateSkill,
  CandidateAchievement,
  CandidateActivity,
  CandidateReference,
  UnlockedProfile,
} from './database/entities';

const entities = [
  User,
  CandidateProfile,
  CV,
  Company,
  CompanyUser,
  JobPosting,
  Application,
  SavedJob,
  BlockedCompany,
  SearchHistory,
  ServicePackage,
  Order,
  Payment,
  Invoice,
  Notification,
  CandidateExperience,
  CandidateEducation,
  CandidateCertificate,
  CandidateLanguage,
  CandidateSkill,
  CandidateAchievement,
  CandidateActivity,
  CandidateReference,
  UnlockedProfile,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        url: configService.get<string>('DATABASE_URL'),
        entities,
        // Đợt 12a (20/09/2026): synchronize chỉ còn bật ở môi trường dev để scaffold nhanh — với
        // dữ liệu thật, một thay đổi entity vô tình có thể làm mất cột/dữ liệu không khôi phục
        // được. Production dùng migrations thật (xem database/migrations/ + npm run migration:run).
        synchronize: !isProduction(),
        logging: false,
        // CSDL hosting thật (Supabase, Render, v.v.) yêu cầu kết nối SSL — bật qua biến môi trường
        // DATABASE_SSL=true khi triển khai (đợt 7, 18/09/2026). rejectUnauthorized:false vì các dịch
        // vụ này dùng chứng chỉ do họ tự quản lý, không nằm trong danh sách CA gốc mặc định của Node.
        ssl: configService.get<string>('DATABASE_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      }),
    }),
    // Bảo mật (đợt 12a, 20/09/2026): giới hạn số request mặc định 100 lần/60s theo IP cho toàn bộ
    // API — chống dò mật khẩu/spam cơ bản. Endpoint đăng nhập/đăng ký còn bị giới hạn chặt hơn
    // riêng qua @Throttle() ở auth.controller.ts.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    AuthModule,
    UsersModule,
    JobsModule,
    CandidatesModule,
    ApplicationsModule,
    EmployerModule,
    AdminModule,
    FilesModule,
    CvSearchModule,
    HealthModule,
    PresenceModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
