import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CV, CvType } from '../database/entities/cv.entity';
import { SavedJob } from '../database/entities/saved-job.entity';
import { BlockedCompany } from '../database/entities/blocked-company.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { BlockCompanyDto } from './dto/block-company.dto';

const CV_MAX_BYTES = 2 * 1024 * 1024; // 2MB — theo Mục 9 SRS

@Injectable()
export class CandidatesService {
  constructor(
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(CV)
    private readonly cvRepo: Repository<CV>,
    @InjectRepository(SavedJob)
    private readonly savedJobRepo: Repository<SavedJob>,
    @InjectRepository(BlockedCompany)
    private readonly blockedCompanyRepo: Repository<BlockedCompany>,
    @InjectRepository(JobPosting)
    private readonly jobRepo: Repository<JobPosting>,
  ) {}

  async getOwnProfile(userId: string): Promise<CandidateProfile> {
    const profile = await this.profileRepo.findOne({ where: { userId }, relations: { cvs: true } });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');
    return profile;
  }

  private computeCompletion(profile: CandidateProfile, hasCv: boolean): number {
    const checks = [
      !!profile.fullName,
      !!profile.desiredPosition,
      !!profile.desiredLevel,
      !!(profile.desiredSalaryMin || profile.desiredSalaryMax),
      hasCv,
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }

  async updateOwnProfile(userId: string, dto: UpdateProfileDto): Promise<CandidateProfile> {
    const profile = await this.getOwnProfile(userId);
    Object.assign(profile, dto);
    const hasCv = (profile.cvs?.length ?? 0) > 0;
    profile.completionPercent = this.computeCompletion(profile, hasCv);
    return this.profileRepo.save(profile);
  }

  async listOwnCvs(userId: string): Promise<CV[]> {
    const profile = await this.getOwnProfile(userId);
    return this.cvRepo.find({ where: { candidateProfileId: profile.id }, order: { createdAt: 'DESC' } });
  }

  async addCvFromUpload(userId: string, file: Express.Multer.File): Promise<CV> {
    if (!file) throw new BadRequestException('Vui lòng chọn tệp CV');
    if (file.size > CV_MAX_BYTES) {
      throw new BadRequestException('Tệp CV vượt quá 2MB — vui lòng dán link Google Drive thay thế');
    }
    const profile = await this.getOwnProfile(userId);
    const isFirst = (profile.cvs?.length ?? 0) === 0;
    const cv = this.cvRepo.create({
      candidateProfileId: profile.id,
      type: CvType.UPLOAD,
      originalFileName: file.originalname,
      fileData: file.buffer,
      fileMimeType: file.mimetype,
      isPrimary: isFirst,
    });
    const saved = await this.cvRepo.save(cv);
    // fileUrl trỏ vào route phục vụ tệp từ CSDL (FilesController) — chỉ đặt được sau khi có id.
    saved.fileUrl = `/files/cv/${saved.id}`;
    await this.cvRepo.save(saved);
    await this.refreshCompletion(profile.id);
    return saved;
  }

  async addCvFromLink(userId: string, externalLinkUrl: string): Promise<CV> {
    const profile = await this.getOwnProfile(userId);
    const isFirst = (profile.cvs?.length ?? 0) === 0;
    const cv = this.cvRepo.create({
      candidateProfileId: profile.id,
      type: CvType.UPLOAD,
      externalLinkUrl,
      isPrimary: isFirst,
    });
    const saved = await this.cvRepo.save(cv);
    await this.refreshCompletion(profile.id);
    return saved;
  }

  private async refreshCompletion(profileId: string) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId }, relations: { cvs: true } });
    if (!profile) return;
    profile.completionPercent = this.computeCompletion(profile, (profile.cvs?.length ?? 0) > 0);
    await this.profileRepo.save(profile);
  }

  async removeCv(userId: string, cvId: string): Promise<void> {
    const profile = await this.getOwnProfile(userId);
    const cv = await this.cvRepo.findOne({ where: { id: cvId } });
    if (!cv || cv.candidateProfileId !== profile.id) throw new NotFoundException('Không tìm thấy CV');
    await this.cvRepo.remove(cv);
    if (cv.isPrimary) {
      const remaining = await this.cvRepo.find({ where: { candidateProfileId: profile.id }, order: { createdAt: 'ASC' } });
      if (remaining[0]) {
        remaining[0].isPrimary = true;
        await this.cvRepo.save(remaining[0]);
      }
    }
    await this.refreshCompletion(profile.id);
  }

  async setPrimaryCv(userId: string, cvId: string): Promise<CV> {
    const profile = await this.getOwnProfile(userId);
    const cvs = await this.cvRepo.find({ where: { candidateProfileId: profile.id } });
    const target = cvs.find((c) => c.id === cvId);
    if (!target) throw new NotFoundException('Không tìm thấy CV');
    for (const c of cvs) {
      c.isPrimary = c.id === cvId;
    }
    await this.cvRepo.save(cvs);
    return target;
  }

  async listSavedJobs(userId: string) {
    const profile = await this.getOwnProfile(userId);
    return this.savedJobRepo.find({
      where: { candidateProfileId: profile.id },
      relations: { jobPosting: { company: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async saveJob(userId: string, jobId: string) {
    const profile = await this.getOwnProfile(userId);
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    const existing = await this.savedJobRepo.findOne({
      where: { candidateProfileId: profile.id, jobPostingId: jobId },
    });
    if (existing) return existing;
    return this.savedJobRepo.save(
      this.savedJobRepo.create({ candidateProfileId: profile.id, jobPostingId: jobId }),
    );
  }

  async unsaveJob(userId: string, jobId: string) {
    const profile = await this.getOwnProfile(userId);
    await this.savedJobRepo.delete({ candidateProfileId: profile.id, jobPostingId: jobId });
  }

  async listBlockedCompanies(userId: string) {
    const profile = await this.getOwnProfile(userId);
    return this.blockedCompanyRepo.find({
      where: { candidateProfileId: profile.id },
      relations: { company: true },
      order: { createdAt: 'DESC' },
    });
  }

  async blockCompany(userId: string, dto: BlockCompanyDto) {
    if (!dto.companyId && !dto.companyNameText) {
      throw new BadRequestException('Cần chọn công ty hoặc nhập tên công ty');
    }
    const profile = await this.getOwnProfile(userId);
    return this.blockedCompanyRepo.save(
      this.blockedCompanyRepo.create({
        candidateProfileId: profile.id,
        companyId: dto.companyId,
        companyNameText: dto.companyNameText,
      }),
    );
  }

  async unblockCompany(userId: string, blockId: string) {
    const profile = await this.getOwnProfile(userId);
    const row = await this.blockedCompanyRepo.findOne({ where: { id: blockId } });
    if (!row || row.candidateProfileId !== profile.id) throw new ForbiddenException();
    await this.blockedCompanyRepo.remove(row);
  }
}
