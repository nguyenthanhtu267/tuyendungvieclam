import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { Company } from '../database/entities/company.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { User } from '../database/entities/user.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { Order } from '../database/entities/order.entity';
import { Payment } from '../database/entities/payment.entity';
import { Invoice } from '../database/entities/invoice.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, JobPosting, User, CandidateProfile, Order, Payment, Invoice]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
