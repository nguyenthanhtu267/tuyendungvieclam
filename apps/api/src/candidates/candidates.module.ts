import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CV } from '../database/entities/cv.entity';
import { SavedJob } from '../database/entities/saved-job.entity';
import { BlockedCompany } from '../database/entities/blocked-company.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { SearchHistory } from '../database/entities/search-history.entity';
// Đợt 12ab (24/09/2026) — "Nhà tuyển dụng của tôi" (công ty đã xem hồ sơ qua UnlockedProfile, +
// Theo dõi công ty qua CompanyFollow), "Đánh giá mức độ tương thích" (cần Company để tra ngành/tên).
import { UnlockedProfile } from '../database/entities/unlocked-profile.entity';
import { CompanyFollow } from '../database/entities/company-follow.entity';
import { Company } from '../database/entities/company.entity';
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
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CandidateProfile,
      CV,
      SavedJob,
      BlockedCompany,
      JobPosting,
      SearchHistory,
      CandidateExperience,
      CandidateEducation,
      CandidateCertificate,
      CandidateLanguage,
      CandidateSkill,
      CandidateAchievement,
      CandidateActivity,
      CandidateReference,
      UnlockedProfile,
      CompanyFollow,
      Company,
    ]),
  ],
  controllers: [CandidatesController, ProfileController],
  providers: [CandidatesService, ProfileService],
  exports: [CandidatesService],
})
export class CandidatesModule {}
