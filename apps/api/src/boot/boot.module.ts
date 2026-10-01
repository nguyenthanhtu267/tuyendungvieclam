import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { BackgroundModule } from '../background/background.module';
import { AdsModule } from '../ads/ads.module';
import { BootController, VitalsAdminController, VitalsCollectController } from './boot.controller';
import { VitalsService } from './vitals.service';

@Module({
  imports: [AdminModule, BackgroundModule, AdsModule],
  controllers: [BootController, VitalsCollectController, VitalsAdminController],
  providers: [VitalsService],
})
export class BootModule {}
