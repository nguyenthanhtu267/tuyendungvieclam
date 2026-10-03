import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

// Đợt 160 — mọi lỗi KHÔNG lường trước (500) đều được ghi log đầy đủ kèm "mã tham chiếu" ngắn và trả mã đó cho người dùng:
// người dùng đọc mã cho admin → tra đúng dòng log trên Render. Lỗi đã biết (400/401/403/404/429…) giữ nguyên như cũ.
const logger = new Logger('Exceptions');

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }
    const ref = randomBytes(3).toString('hex');
    const err = exception as Error;
    logger.error(`[${ref}] ${req?.method} ${req?.originalUrl} → ${err?.message}`, err?.stack);
    if (res.headersSent) return;
    res.status(500).json({ statusCode: 500, message: `Máy chủ gặp lỗi khi xử lý yêu cầu (mã tham chiếu ${ref})`, ref });
  }
}
