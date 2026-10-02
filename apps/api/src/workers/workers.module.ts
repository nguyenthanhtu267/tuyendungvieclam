import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerApplication, WorkerContact, WorkerNote, WorkerPhoneView, WorkerProfile } from '../database/entities/worker-profile.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { JobReport } from '../database/entities/job-report.entity';
import { Company } from '../database/entities/company.entity';
import { WorkersController, WorkersPublicController } from './workers.controller';
import { WorkersService } from './workers.service';
import { WorkerSourcingController, WorkerSourcingPublicController } from './worker-sourcing.controller';
import { WorkerSourcingService } from './worker-sourcing.service';
import { AdminAuditLog } from '../database/entities/admin-audit-log.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([WorkerContact, WorkerProfile, WorkerNote, WorkerApplication, JobPosting, CompanyUser, Company, JobReport, WorkerPhoneView, AdminAuditLog]), NotificationsModule],
  controllers: [WorkersPublicController, WorkerSourcingPublicController, WorkersController, WorkerSourcingController],
  providers: [WorkersService, WorkerSourcingService],
})
export class WorkersModule {}
