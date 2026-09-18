import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CV } from '../database/entities/cv.entity';
import { SavedJob } from '../database/entities/saved-job.entity';
import { BlockedCompany } from '../database/entities/blocked-company.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';

@Module({
  imports: [TypeOrmModule.forFeature([CandidateProfile, CV, SavedJob, BlockedCompany, JobPosting])],
  controllers: [CandidatesController],
  providers: [CandidatesService],
  exports: [CandidatesService],
})
export class CandidatesModule {}
