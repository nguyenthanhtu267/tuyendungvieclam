import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { CV } from '../database/entities/cv.entity';
import { Company } from '../database/entities/company.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';

// Phục vụ tệp CV / giấy tờ pháp lý lưu trong CSDL (bytea) thay vì ổ đĩa máy chủ (đợt 7, 18/09/2026
// — máy chủ miễn phí không có ổ đĩa cố định). Không đặt @UseGuards ở đây: giữ đúng mức truy cập
// công khai-nếu-có-link như cách phục vụ tệp tĩnh /uploads/... trước đây (không thay đổi mô hình
// bảo mật hiện có, chỉ đổi nơi lưu trữ).
@Controller('files')
export class FilesController {
  constructor(
    @InjectRepository(CV) private readonly cvRepo: Repository<CV>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(CandidateProfile) private readonly profileRepo: Repository<CandidateProfile>,
  ) {}

  @Get('avatar/:profileId')
  async getAvatar(@Param('profileId') profileId: string, @Res() res: Response) {
    const profile = await this.profileRepo.findOne({
      where: { id: profileId },
      select: { id: true, avatarData: true, avatarMimeType: true },
    });
    if (!profile || !profile.avatarData) throw new NotFoundException('Không tìm thấy ảnh đại diện');
    res.set({ 'Content-Type': profile.avatarMimeType || 'application/octet-stream' });
    res.send(profile.avatarData);
  }

  @Get('cv/:id')
  async getCv(@Param('id') id: string, @Res() res: Response) {
    const cv = await this.cvRepo.findOne({
      where: { id },
      select: { id: true, fileData: true, fileMimeType: true, originalFileName: true },
    });
    if (!cv || !cv.fileData) throw new NotFoundException('Không tìm thấy tệp CV');
    res.set({
      'Content-Type': cv.fileMimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(cv.originalFileName || 'cv')}"`,
    });
    res.send(cv.fileData);
  }

  @Get('legal-doc/:companyId')
  async getLegalDoc(@Param('companyId') companyId: string, @Res() res: Response) {
    const company = await this.companyRepo.findOne({
      where: { id: companyId },
      select: { id: true, legalDocData: true, legalDocMimeType: true, legalDocOriginalFileName: true },
    });
    if (!company || !company.legalDocData) throw new NotFoundException('Không tìm thấy tệp giấy tờ pháp lý');
    res.set({
      'Content-Type': company.legalDocMimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(company.legalDocOriginalFileName || 'giay-to-phap-ly')}"`,
    });
    res.send(company.legalDocData);
  }
}
