import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerApplication, WorkerContact, WorkerNote, WorkerProfile } from '../database/entities/worker-profile.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { JobReport } from '../database/entities/job-report.entity';
import { Company } from '../database/entities/company.entity';
import { WorkersController, WorkersPublicController } from './workers.controller';
import { WorkersService } from './workers.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([WorkerContact, WorkerProfile, WorkerNote, WorkerApplication, JobPosting, CompanyUser, Company, JobReport]), NotificationsModule],
  controllers: [WorkersPublicController, WorkersController],
  providers: [WorkersService],
})
export class WorkersModule {}
