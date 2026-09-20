import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from '../database/entities/application.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CV } from '../database/entities/cv.entity';
import { JobPosting, JobApprovalStatus } from '../database/entities/job-posting.entity';
import { ApplyJobDto } from './dto/apply-job.dto';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application) private readonly applicationRepo: Repository<Application>,
    @InjectRepository(CandidateProfile) private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(CV) private readonly cvRepo: Repository<CV>,
    @InjectRepository(JobPosting) private readonly jobRepo: Repository<JobPosting>,
  ) {}

  async apply(userId: string, jobId: string, dto: ApplyJobDto): Promise<Application> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');

    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job || job.approvalStatus !== JobApprovalStatus.APPROVED) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }

    const cv = await this.cvRepo.findOne({ where: { id: dto.cvId } });
    if (!cv || cv.candidateProfileId !== profile.id) {
      throw new BadRequestException('CV không hợp lệ — vui lòng chọn CV trong hồ sơ của bạn');
    }

    const existing = await this.applicationRepo.findOne({
      where: { jobPostingId: jobId, cv: { candidateProfileId: profile.id } },
      relations: { cv: true },
    });
    if (existing) {
      throw new ConflictException('Bạn đã ứng tuyển vào vị trí này rồi');
    }

    const application = this.applicationRepo.create({
      jobPostingId: jobId,
      cvId: cv.id,
      coverLetter: dto.coverLetter,
    });
    return this.applicationRepo.save(application);
  }

  async listOwn(userId: string) {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) return [];
    // Đợt 11b — .withDeleted(): NTD "chuyển vào thùng rác" ở ATS của họ (mục #4) chỉ là cách họ tự
    // sắp xếp hồ sơ ứng tuyển nhận được, KHÔNG được làm mất lịch sử ứng tuyển thật của ứng viên —
    // ứng viên phải luôn thấy đơn mình đã nộp trong "Việc làm của tôi" dù NTD có xoá mềm phía họ.
    return this.applicationRepo
      .createQueryBuilder('application')
      .withDeleted()
      .leftJoinAndSelect('application.jobPosting', 'job')
      .leftJoinAndSelect('job.company', 'company')
      .leftJoinAndSelect('application.cv', 'cv')
      .where('cv.candidateProfileId = :profileId', { profileId: profile.id })
      .orderBy('application.appliedAt', 'DESC')
      .getMany();
  }
}
