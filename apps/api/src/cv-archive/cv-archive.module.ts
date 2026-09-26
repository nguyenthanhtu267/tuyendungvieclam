import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CvArchiveCandidate,
  CvArchiveEntry,
} from '../database/entities/cv-archive.entity';
import { Application } from '../database/entities/application.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CV } from '../database/entities/cv.entity';
import { User } from '../database/entities/user.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
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
import { CvArchiveService } from './cv-archive.service';
import {
  CvArchiveController,
  CvParseController,
} from './cv-archive.controller';

// Đợt 18a (26/09/2026) — "Kho CV". Xuất CvArchiveService để ApplicationsModule gọi chụp ngay khi ứng
// viên bấm Ứng tuyển, và để AdminToolsModule (18c/18f) dùng lại bản chụp hồ sơ + bộ đọc/tách CV.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CvArchiveCandidate,
      CvArchiveEntry,
      Application,
      CandidateProfile,
      CV,
      User,
      CompanyUser,
      JobPosting,
      CandidateExperience,
      CandidateEducation,
      CandidateCertificate,
      CandidateLanguage,
      CandidateSkill,
      CandidateAchievement,
      CandidateActivity,
      CandidateReference,
    ]),
  ],
  controllers: [CvArchiveController, CvParseController],
  providers: [CvArchiveService],
  exports: [CvArchiveService],
})
export class CvArchiveModule {}
