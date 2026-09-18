import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, CandidateProfile])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
