import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { resolveJwtSecret } from '../config/env-guard';
import { AdminSetting } from '../database/entities/admin-setting.entity';
import { StoredFile } from '../database/entities/stored-file.entity';
import { AdminAuditLog } from '../database/entities/admin-audit-log.entity';
import { FileStorageService } from './file-storage.service';
import {
  StorageAdminController,
  StorageCallbackController,
} from './storage.controller';

// Đợt 20 (27/09/2026) — nơi lưu file (Google Drive, dự phòng CSDL). @Global để mọi module ghi/đọc file
// (ứng viên, NTD, Kho CV, Admin...) dùng chung 1 FileStorageService mà không phải import lại.
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AdminSetting, StoredFile, AdminAuditLog]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: resolveJwtSecret(configService.get<string>('JWT_SECRET')),
      }),
    }),
  ],
  providers: [FileStorageService],
  controllers: [StorageAdminController, StorageCallbackController],
  exports: [FileStorageService],
})
export class StorageModule {}
