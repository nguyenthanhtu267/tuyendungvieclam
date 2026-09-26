import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

// Vận hành (đợt 12a, 20/09/2026) — trước đó backend gần như không log gì (chỉ 2 dòng console.*
// rải rác), rất khó truy vết khi có lỗi thật sau khi public. Middleware này log 1 dòng có cấu trúc
// cho mỗi request: phương thức, đường dẫn, mã trạng thái, thời gian xử lý — đủ để tra cứu log trên
// Render mà không cần dịch vụ log ngoài (chưa có ngân sách cho việc đó ở Giai đoạn 1).
const logger = new Logger('HTTP');

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    // Đợt 19 — bỏ log các lô ghi truy cập thành công (mỗi người xem gửi ~6 lô/phút, sẽ làm ngập log Render).
    else if (!req.originalUrl.startsWith('/analytics/collect'))
      logger.log(line);
  });
  next();
}
