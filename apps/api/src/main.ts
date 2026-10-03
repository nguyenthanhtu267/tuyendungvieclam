import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, text } from 'express';
import { AppModule } from './app.module';
import { resolveCorsOrigins } from './config/env-guard';
import { requestLogger } from './common/request-logger.middleware';
import { httpCache } from './common/http-cache.middleware';
import compression = require('compression');

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
    // Đợt 90 — trình duyệt nhớ kết quả "hỏi trước" (preflight OPTIONS) 24 giờ, không hỏi lại trước MỖI lần gọi API.
    maxAge: 86400,
  });
  // Đợt 90 — nén gzip/br mọi phản hồi > 1 KB (danh sách tin ~20 KB → ~4 KB).
  app.use(compression({ threshold: 1024 }));
  // Đợt 22 (29/09/2026) — API chạy sau proxy của Render: nếu không khai báo "trust proxy" thì req.ip luôn là
  // địa chỉ proxy nội bộ → mọi khách dùng CHUNG 1 bộ đếm giới hạn tốc độ (ứng tuyển không đăng nhập, đăng nhập...)
  // và bị chặn oan. Tin 1 lớp proxy (đổi bằng biến TRUST_PROXY_HOPS nếu hạ tầng thay đổi; 0 = tắt, dùng khi chạy
  // trực tiếp ở máy dev).
  const hops = Number(
    process.env.TRUST_PROXY_HOPS ??
      (process.env.NODE_ENV === 'production' ? 1 : 0),
  );
  if (hops > 0) app.set('trust proxy', hops);
  app.use(requestLogger);
  app.use(httpCache);
  // Đợt 19 (26/09/2026) — bộ ghi truy cập gửi lô dữ liệu bằng navigator.sendBeacon dạng text/plain (loại
  // "simple request" nên không cần preflight CORS, vẫn gửi được lúc người dùng đóng tab).
  // Đợt 153 — ảnh nền chia sẻ tự tải lên (base64, tối đa ~650KB) cần giới hạn thân lớn hơn mặc định 100KB.
  // (bọc trong hàm riêng: Nest nhận ra middleware tên "jsonParser" và sẽ KHÔNG đăng ký bộ đọc JSON mặc định cho cả API.)
  const bigJson = json({ limit: '1.5mb' });
  app.use('/admin/share-bg/custom', (req: any, res: any, next: any) => bigJson(req, res, next));
  app.use('/analytics/collect', text({ type: 'text/plain', limit: '100kb' }));
  // Đợt 93 — số đo tốc độ thật (Web Vitals) cũng gửi bằng sendBeacon text/plain.
  app.use('/analytics/vitals', text({ type: 'text/plain', limit: '4kb' }));
  // Đợt 24 — lượt hiển thị/bấm banner quảng cáo cũng gửi bằng sendBeacon dạng text/plain.
  app.use('/public/ads/events', text({ type: 'text/plain', limit: '20kb' }));
  app.use('/public/promos/events', text({ type: 'text/plain', limit: '20kb' }));
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
