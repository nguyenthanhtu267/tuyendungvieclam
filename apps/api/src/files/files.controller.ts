import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { CV } from '../database/entities/cv.entity';
import { Company } from '../database/entities/company.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { FileStorageService } from '../storage/file-storage.service';

// Phục vụ tệp CV / giấy tờ pháp lý lưu trong CSDL (bytea) thay vì ổ đĩa máy chủ (đợt 7, 18/09/2026
// — máy chủ miễn phí không có ổ đĩa cố định). Không đặt @UseGuards ở đây: giữ đúng mức truy cập
// công khai-nếu-có-link như cách phục vụ tệp tĩnh /uploads/... trước đây (không thay đổi mô hình
// bảo mật hiện có, chỉ đổi nơi lưu trữ).
@Controller('files')
export class FilesController {
  constructor(
    private readonly storage: FileStorageService,
    @InjectRepository(CV) private readonly cvRepo: Repository<CV>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
  ) {}

  @Get('avatar/:profileId')
  async getAvatar(@Param('profileId') profileId: string, @Res() res: Response) {
    const profile = await this.profileRepo.findOne({
      where: { id: profileId },
      select: {
        id: true,
        avatarData: true,
        avatarStorageKey: true,
        avatarMimeType: true,
      },
    });
    // Đợt 20 — file có thể nằm trong CSDL hoặc trên Google Drive.
    const data = profile
      ? await this.storage.resolve(profile.avatarData, profile.avatarStorageKey)
      : null;
    if (!profile || !data)
      throw new NotFoundException('Không tìm thấy ảnh đại diện');
    res.set({
      'Content-Type': profile.avatarMimeType || 'application/octet-stream',
      'Cache-Control': 'private, max-age=300',
    });
    res.send(data);
  }

  @Get('cv/:id')
  async getCv(@Param('id') id: string, @Res() res: Response) {
    const cv = await this.cvRepo.findOne({
      where: { id },
      select: {
        id: true,
        fileData: true,
        fileStorageKey: true,
        fileMimeType: true,
        originalFileName: true,
      },
    });
    const data = cv
      ? await this.storage.resolve(cv.fileData, cv.fileStorageKey)
      : null;
    if (!cv || !data) throw new NotFoundException('Không tìm thấy tệp CV');
    res.set({
      'Content-Type': cv.fileMimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(cv.originalFileName || 'cv')}"`,
    });
    res.send(data);
  }

  @Get('legal-doc/:companyId')
  async getLegalDoc(
    @Param('companyId') companyId: string,
    @Res() res: Response,
  ) {
    const company = await this.companyRepo.findOne({
      where: { id: companyId },
      select: {
        id: true,
        legalDocData: true,
        legalDocStorageKey: true,
        legalDocMimeType: true,
        legalDocOriginalFileName: true,
      },
    });
    const data = company
      ? await this.storage.resolve(
          company.legalDocData,
          company.legalDocStorageKey,
        )
      : null;
    if (!company || !data)
      throw new NotFoundException('Không tìm thấy tệp giấy tờ pháp lý');
    res.set({
      'Content-Type': company.legalDocMimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(company.legalDocOriginalFileName || 'giay-to-phap-ly')}"`,
    });
    res.send(data);
  }
}
