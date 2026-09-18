import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { JobsModule } from './jobs/jobs.module';
import { CandidatesModule } from './candidates/candidates.module';
import { ApplicationsModule } from './applications/applications.module';
import { EmployerModule } from './employer/employer.module';
import { AdminModule } from './admin/admin.module';
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
        // Chỉ dùng synchronize trong môi trường dev để scaffold nhanh.
        // Khi lên production PHẢI chuyển sang migration (typeorm migration:generate/run).
        synchronize: true,
        logging: false,
      }),
    }),
    AuthModule,
    UsersModule,
    JobsModule,
    CandidatesModule,
    ApplicationsModule,
    EmployerModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
