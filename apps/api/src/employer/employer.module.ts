import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployerService } from './employer.service';
import { EmployerController } from './employer.controller';
import { Company } from '../database/entities/company.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { Application } from '../database/entities/application.entity';
import { ApplicationStatusHistory } from '../database/entities/application-status-history.entity';
import { User } from '../database/entities/user.entity';
import { ServicePackage } from '../database/entities/service-package.entity';
import { Order } from '../database/entities/order.entity';
import { WorkLocation } from '../database/entities/work-location.entity';
import { NotificationsModule } from '../notifications/notifications.module';
// Đợt 21 (27/09/2026) — NTD xem "Hồ sơ trực tuyến" của ứng viên đã ứng tuyển thẳng vào tin của họ.
import { AdminModule } from '../admin/admin.module';
import { CvSearchModule } from '../cv-search/cv-search.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      CompanyUser,
      JobPosting,
      Application,
      ApplicationStatusHistory,
      User,
      ServicePackage,
      Order,
      WorkLocation,
    ]),
    NotificationsModule,
    CvSearchModule,
    AdminModule,
  ],
  controllers: [EmployerController],
  providers: [EmployerService],
})
export class EmployerModule {}
