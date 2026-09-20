import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Vận hành (đợt 12a, 20/09/2026) — endpoint kiểm tra sống, quan trọng vì Render free tier tự
// "ngủ" sau ~15 phút không có traffic; dùng để theo dõi uptime hoặc chủ động "đánh thức" server.
// Kiểm tra luôn kết nối CSDL thật (không chỉ trả 200 vô điều kiện) để phát hiện sớm khi Supabase
// tạm dừng/kết nối lỗi.
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unreachable' });
    }
    return { status: 'ok', database: 'connected', time: new Date().toISOString() };
  }
}
