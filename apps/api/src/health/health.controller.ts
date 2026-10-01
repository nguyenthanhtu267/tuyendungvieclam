import { Controller, Get, Head, HttpCode, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { loadMonitor } from '../common/load-monitor';

// Vận hành (đợt 12a, 20/09/2026) — endpoint kiểm tra sống, quan trọng vì Render free tier tự
// "ngủ" sau ~15 phút không có traffic; dùng để theo dõi uptime hoặc chủ động "đánh thức" server.
// Kiểm tra luôn kết nối CSDL thật (không chỉ trả 200 vô điều kiện) để phát hiện sớm khi Supabase
// tạm dừng/kết nối lỗi.
// Đợt 91 — thêm /health/ping (cực nhẹ, KHÔNG chạm CSDL) để dịch vụ "ping định kỳ" (UptimeRobot/cron-job.org...) giữ máy chủ
// luôn thức; /health (có truy vấn CSDL) nên gọi mỗi vài giờ để Supabase miễn phí không bị tạm dừng vì ít hoạt động. Cả hai bỏ qua
// giới hạn tốc độ và không bị ghi vào log truy cập ồn ào.
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    const t0 = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unreachable' });
    }
    return {
      status: 'ok',
      database: 'connected',
      dbMs: Date.now() - t0,
      uptimeSec: Math.round(process.uptime()),
      time: new Date().toISOString(),
    };
  }

  @Get('ping')
  @Head('ping')
  @HttpCode(200)
  ping() {
    // Đợt 94 — kèm độ trễ vòng lặp (ms) + mức tải 0/1/2 để dễ nhìn máy chủ có đang quá tải không (xem lib common/load-monitor.ts).
    return { ok: true, uptimeSec: Math.round(process.uptime()), lagMs: loadMonitor.lagMs(), load: loadMonitor.level() };
  }
}
