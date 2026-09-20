import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesController } from './files.controller';
import { CV } from '../database/entities/cv.entity';
import { Company } from '../database/entities/company.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CV, Company, CandidateProfile])],
  controllers: [FilesController],
})
export class FilesModule {}
