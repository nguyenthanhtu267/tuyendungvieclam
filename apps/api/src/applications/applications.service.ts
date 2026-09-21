import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from '../database/entities/application.entity';
import { ApplicationStatusHistory } from '../database/entities/application-status-history.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CV } from '../database/entities/cv.entity';
import { JobPosting, JobApprovalStatus } from '../database/entities/job-posting.entity';
import { ApplyJobDto } from './dto/apply-job.dto';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application) private readonly applicationRepo: Repository<Application>,
    @InjectRepository(ApplicationStatusHistory)
    private readonly historyRepo: Repository<ApplicationStatusHistory>,
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
    const saved = await this.applicationRepo.save(application);
    // Đợt 12o (21/09/2026) — ghi dòng đầu tiên của "Nhật ký trạng thái ứng tuyển" ngay khi nộp hồ
    // sơ (status mặc định 'new'), để ứng viên thấy đủ dòng thời gian ngay từ lúc ứng tuyển.
    await this.historyRepo.save(this.historyRepo.create({ applicationId: saved.id, status: saved.status }));
    return saved;
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

  // Đợt 12o (21/09/2026) — "Nhật ký trạng thái ứng tuyển": ứng viên xem dòng thời gian xử lý đơn
  // ứng tuyển của chính mình (mỗi lần NTD đổi trạng thái đều được ghi lại, xem
  // EmployerService.updateApplicationStatus()).
  async getHistory(userId: string, applicationId: string): Promise<ApplicationStatusHistory[]> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');
    const application = await this.applicationRepo
      .createQueryBuilder('application')
      .withDeleted()
      .leftJoinAndSelect('application.cv', 'cv')
      .where('application.id = :applicationId', { applicationId })
      .getOne();
    if (!application || application.cv?.candidateProfileId !== profile.id) {
      throw new ForbiddenException('Bạn không có quyền xem đơn ứng tuyển này');
    }
    return this.historyRepo.find({ where: { applicationId }, order: { createdAt: 'ASC' } });
  }
}
