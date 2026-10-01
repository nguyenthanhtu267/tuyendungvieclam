import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../database/entities/company.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { CompanyFollow } from '../database/entities/company-follow.entity';
import { CompanyClaimRequest } from '../database/entities/company-claim-request.entity';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyLogoFinder } from './company-logo-finder.service';
import { CompanyLogoController } from './company-logo.controller';
import { LogoProxyController } from './logo-proxy.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Company, JobPosting, CompanyFollow, CompanyClaimRequest])],
  controllers: [CompaniesController, CompanyLogoController, LogoProxyController],
  providers: [CompaniesService, CompanyLogoFinder],
})
export class CompaniesModule {}
