import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController, PublicSettingsController, MailScanCronController, SourceScanCronController } from './admin.controller';
import { Company } from '../database/entities/company.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { Application } from '../database/entities/application.entity';
import { User } from '../database/entities/user.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { Order } from '../database/entities/order.entity';
import { Payment } from '../database/entities/payment.entity';
import { Invoice } from '../database/entities/invoice.entity';
import { SearchHistory } from '../database/entities/search-history.entity';
import { AdminAuditLog } from '../database/entities/admin-audit-log.entity';
import { AdminSetting } from '../database/entities/admin-setting.entity';
import { CompanyClaimRequest } from '../database/entities/company-claim-request.entity';
import { JobImport } from '../database/entities/job-import.entity';
import { JobSource } from '../database/entities/job-source.entity';
import { JobSourceService } from './job-source.service';
import { JobImportService } from './job-import.service';
import { MailScanService } from './mail-scan.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      CompanyUser,
      JobPosting,
      Application,
      User,
      CandidateProfile,
      Order,
      Payment,
      Invoice,
      SearchHistory,
      AdminAuditLog,
      AdminSetting,
      CompanyClaimRequest,
      JobImport,
      JobSource,
    ]),
    NotificationsModule,
  ],
  controllers: [AdminController, PublicSettingsController, MailScanCronController, SourceScanCronController],
  providers: [AdminService, JobImportService, MailScanService, JobSourceService],
  exports: [AdminService, JobImportService],
})
export class AdminModule {}
