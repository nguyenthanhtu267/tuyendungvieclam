import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from '../database/entities/application.entity';
import { ApplicationStatusHistory } from '../database/entities/application-status-history.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CV } from '../database/entities/cv.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { CvArchiveModule } from '../cv-archive/cv-archive.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Application,
      ApplicationStatusHistory,
      CandidateProfile,
      CV,
      JobPosting,
    ]),
    // Đợt 18a (26/09/2026) — tự động lưu vào Kho CV của NTD mỗi lần ứng tuyển.
    CvArchiveModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
