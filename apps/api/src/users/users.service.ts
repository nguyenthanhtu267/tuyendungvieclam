import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../database/entities/user.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(CandidateProfile)
    private readonly candidateProfileRepo: Repository<CandidateProfile>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async createCandidate(params: {
    email: string;
    passwordHash: string;
    fullName: string;
    phone?: string;
  }): Promise<User> {
    const user = this.userRepo.create({
      email: params.email,
      passwordHash: params.passwordHash,
      phone: params.phone,
      role: UserRole.CANDIDATE,
    });
    const savedUser = await this.userRepo.save(user);

    const profile = this.candidateProfileRepo.create({
      userId: savedUser.id,
      fullName: params.fullName,
    });
    await this.candidateProfileRepo.save(profile);

    return savedUser;
  }
}
