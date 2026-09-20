import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../database/entities/company.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [TypeOrmModule.forFeature([Company, JobPosting])],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
