import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { text } from 'express';
import { AppModule } from './app.module';
import { resolveCorsOrigins } from './config/env-guard';
import { requestLogger } from './common/request-logger.middleware';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // CORS_ORIGIN cho phép giới hạn domain frontend được gọi API khi triển khai thật (đợt 7,
  // 18/09/2026) — để trống (mặc định) nghĩa là cho phép mọi origin, chỉ chấp nhận được ở môi
  // trường dev. Đợt 12a (20/09/2026): bắt buộc phải khai báo khi NODE_ENV=production, xem
  // resolveCorsOrigins() ở config/env-guard.ts.
  app.enableCors({
    origin: resolveCorsOrigins(process.env.CORS_ORIGIN),
    credentials: true,
  });
  app.use(requestLogger);
  // Đợt 19 (26/09/2026) — bộ ghi truy cập gửi lô dữ liệu bằng navigator.sendBeacon dạng text/plain (loại
  // "simple request" nên không cần preflight CORS, vẫn gửi được lúc người dùng đóng tab).
  app.use('/analytics/collect', text({ type: 'text/plain', limit: '100kb' }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // CV / giấy tờ pháp lý nay lưu trong CSDL (bytea) và phục vụ qua FilesController — không còn
  // dùng ổ đĩa cục bộ (đợt 7, 18/09/2026: máy chủ miễn phí không có ổ đĩa cố định). Kế hoạch dài
  // hạn theo SRS Mục 11 vẫn là Cloudflare R2 khi có tài khoản/API key riêng.
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`API đang chạy tại http://localhost:${port}`);
}

bootstrap().catch((err) => {
  // Đợt 12a (20/09/2026) — báo lỗi cấu hình rõ ràng (JWT_SECRET/CORS_ORIGIN thiếu ở production...)
  // thay vì để crash với stack trace khó đọc, giúp người triển khai biết ngay cần sửa biến môi
  // trường nào trên Render trước khi thử lại.
  logger.error(
    `Không thể khởi động server: ${err instanceof Error ? err.message : err}`,
  );
  process.exit(1);
});
