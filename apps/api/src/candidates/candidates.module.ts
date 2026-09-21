import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CV } from '../database/entities/cv.entity';
import { SavedJob } from '../database/entities/saved-job.entity';
import { BlockedCompany } from '../database/entities/blocked-company.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { SearchHistory } from '../database/entities/search-history.entity';
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
    ]),
  ],
  controllers: [CandidatesController, ProfileController],
  providers: [CandidatesService, ProfileService],
  exports: [CandidatesService],
})
export class CandidatesModule {}
