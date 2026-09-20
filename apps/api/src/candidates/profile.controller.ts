import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProfileService } from './profile.service';
import { UpdatePersonalInfoDto, UpdateCareerInfoDto, QuickFieldsDto } from './dto/profile-sections.dto';

// Đợt 8 — hồ sơ 13 mục. Base path /me/profile, tách khỏi CandidatesController (/me/profile cũ,
// vẫn giữ nguyên cho hồ sơ tóm tắt) bằng các đường dẫn con để không đụng route.
@Controller('me/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('full')
  getFull(@CurrentUser() user: { userId: string }) {
    return this.profileService.getFullProfile(user.userId);
  }

  @Patch('personal')
  updatePersonal(@CurrentUser() user: { userId: string }, @Body() dto: UpdatePersonalInfoDto) {
    return this.profileService.updatePersonalInfo(user.userId, dto);
  }

  @Patch('career')
  updateCareer(@CurrentUser() user: { userId: string }, @Body() dto: UpdateCareerInfoDto) {
    return this.profileService.updateCareerInfo(user.userId, dto);
  }

  @Patch('quick')
  updateQuick(@CurrentUser() user: { userId: string }, @Body() dto: QuickFieldsDto) {
    return this.profileService.updateQuickFields(user.userId, dto);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 1 * 1024 * 1024 } }))
  uploadAvatar(@CurrentUser() user: { userId: string }, @UploadedFile() file: Express.Multer.File) {
    return this.profileService.setAvatar(user.userId, file);
  }

  @Delete('avatar')
  removeAvatar(@CurrentUser() user: { userId: string }) {
    return this.profileService.removeAvatar(user.userId);
  }

  @Get('sections/:section')
  listSection(@CurrentUser() user: { userId: string }, @Param('section') section: string) {
    return this.profileService.listSection(user.userId, section);
  }

  @Post('sections/:section')
  addSectionItem(
    @CurrentUser() user: { userId: string },
    @Param('section') section: string,
    @Body() body: unknown,
  ) {
    return this.profileService.addSectionItem(user.userId, section, body);
  }

  @Patch('sections/:section/:id')
  updateSectionItem(
    @CurrentUser() user: { userId: string },
    @Param('section') section: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.profileService.updateSectionItem(user.userId, section, id, body);
  }

  @Delete('sections/:section/:id')
  removeSectionItem(
    @CurrentUser() user: { userId: string },
    @Param('section') section: string,
    @Param('id') id: string,
  ) {
    return this.profileService.removeSectionItem(user.userId, section, id);
  }
}
