import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobPosting } from '../database/entities/job-posting.entity';
import { Company } from '../database/entities/company.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CandidateSkill } from '../database/entities/candidate-sections.entity';
import { Application } from '../database/entities/application.entity';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobAlertsService } from './job-alerts.service';
import { SearchHistory } from '../database/entities/search-history.entity';
import { Notification } from '../database/entities/notification.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JobPosting,
      Company,
      CandidateProfile,
      CandidateSkill,
      Application,
      SearchHistory,
      Notification,
    ]),
    NotificationsModule,
  ],
  controllers: [JobsController],
  providers: [JobsService, JobAlertsService],
  exports: [JobsService],
})
export class JobsModule {}
