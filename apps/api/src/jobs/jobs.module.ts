import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobPosting } from '../database/entities/job-posting.entity';
import { Company } from '../database/entities/company.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CandidateSkill } from '../database/entities/candidate-sections.entity';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [TypeOrmModule.forFeature([JobPosting, Company, CandidateProfile, CandidateSkill])],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
