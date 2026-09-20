import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PresenceService } from './presence.service';
import { PingDto } from './dto/ping.dto';

// Công khai, không cần đăng nhập — banner "đang online" hiển thị cho mọi khách truy cập trang chủ.
// Bỏ giới hạn throttle mặc định vì frontend gọi định kỳ (heartbeat ~20s + đọc số hiển thị), tần
// suất thấp và vô hại, không nên vô tình bị chặn khi nhiều tab cùng NAT/IP công ty.
@Controller('presence')
@SkipThrottle()
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Post('ping')
  @HttpCode(HttpStatus.OK)
  ping(@Body() dto: PingDto) {
    return this.presenceService.ping(dto.sessionId);
  }

  @Get('count')
  getCount() {
    return this.presenceService.getCount();
  }
}
