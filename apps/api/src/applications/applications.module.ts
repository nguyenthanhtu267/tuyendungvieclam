import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from '../database/entities/application.entity';
import { ApplicationStatusHistory } from '../database/entities/application-status-history.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CV } from '../database/entities/cv.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { ApplicationsController, PublicApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { CompanyUser } from '../database/entities/company-user.entity';
import { Notification } from '../database/entities/notification.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApplicationRemindersService } from './application-reminders.service';
import { CvArchiveModule } from '../cv-archive/cv-archive.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Application,
      ApplicationStatusHistory,
      CandidateProfile,
      CV,
      JobPosting,
      CompanyUser,
      Notification,
    ]),
    NotificationsModule,
    // Đợt 18a (26/09/2026) — tự động lưu vào Kho CV của NTD mỗi lần ứng tuyển.
    CvArchiveModule,
  ],
  controllers: [ApplicationsController, PublicApplicationsController],
  providers: [ApplicationsService, ApplicationRemindersService],
})
export class ApplicationsModule {}
