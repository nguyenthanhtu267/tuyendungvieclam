import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CvSearchService } from './cv-search.service';
import { CvSearchController } from './cv-search.controller';
import { CompanyUser } from '../database/entities/company-user.entity';
import { Company } from '../database/entities/company.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { UnlockedProfile } from '../database/entities/unlocked-profile.entity';
import { Order } from '../database/entities/order.entity';
import { NotificationsModule } from '../notifications/notifications.module';
// Đợt 12ac (24/09/2026) — "Ghi chú riêng"/"Ẩn khỏi danh sách" (CandidateNote) + "Mời ứng tuyển" (cần
// JobPosting để kiểm tra tin thuộc đúng công ty đang thao tác).
import { CandidateNote } from '../database/entities/candidate-note.entity';
import { JobPosting } from '../database/entities/job-posting.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanyUser, Company, CandidateProfile, UnlockedProfile, Order, CandidateNote, JobPosting]),
    NotificationsModule,
  ],
  controllers: [CvSearchController],
  providers: [CvSearchService],
})
export class CvSearchModule {}
