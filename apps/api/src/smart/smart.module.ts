import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobPosting } from '../database/entities/job-posting.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CandidateSkill } from '../database/entities/candidate-sections.entity';
import { Application } from '../database/entities/application.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { SmartController, SmartPublicController } from './smart.controller';
import { SmartService } from './smart.service';

@Module({
  imports: [TypeOrmModule.forFeature([JobPosting, CandidateProfile, CandidateSkill, Application, CompanyUser])],
  controllers: [SmartController, SmartPublicController],
  providers: [SmartService],
})
export class SmartModule {}
