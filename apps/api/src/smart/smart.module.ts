import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobPosting } from '../database/entities/job-posting.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CandidateSkill } from '../database/entities/candidate-sections.entity';
import { Application } from '../database/entities/application.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { resolveJwtSecret } from '../config/env-guard';
import { JobReport } from '../database/entities/job-report.entity';
import { CandidateExperience, CandidateEducation, CandidateCertificate } from '../database/entities/candidate-sections.entity';
import { Smart2Service } from './smart2.service';
import { Smart3Service } from './smart3.service';
import { Smart4Service } from './smart4.service';
import { CvSearchModule } from '../cv-search/cv-search.module';
import { SmartController, SmartPublicController, SmartSharePublicController } from './smart.controller';
import { SmartService } from './smart.service';

@Module({
  imports: [
    CvSearchModule,
    TypeOrmModule.forFeature([JobPosting, CandidateProfile, CandidateSkill, CandidateExperience, CandidateEducation, CandidateCertificate, Application, CompanyUser, JobReport]),
    // Khoá riêng cho link chia sẻ hồ sơ — khác khoá đăng nhập nên token chia sẻ không dùng để đăng nhập được.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({ secret: `${resolveJwtSecret(c.get<string>('JWT_SECRET'))}:profile-share` }),
    }),
  ],
  controllers: [SmartController, SmartPublicController, SmartSharePublicController],
  providers: [SmartService, Smart2Service, Smart3Service, Smart4Service],
})
export class SmartModule {}
