import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Đợt 90 — giới hạn tốc độ THEO NGƯỜI thay vì theo IP: công nhân dùng chung wifi nhà máy / nhiều thuê bao 4G
// chung 1 IP (CGNAT) trước đây dùng chung 1 bộ đếm → bị chặn oan (lỗi 429). Người đã đăng nhập đếm theo tài khoản;
// khách đếm theo IP + trình duyệt. Các API nhạy cảm (đăng nhập, ứng tuyển…) vẫn giữ @Throttle chặt riêng.
@Injectable()
export class SmartThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const auth = String(req.headers?.authorization ?? '');
    if (auth.startsWith('Bearer ')) {
      try {
        const payload = JSON.parse(Buffer.from(auth.slice(7).split('.')[1] ?? '', 'base64url').toString('utf8'));
        if (payload?.sub) return `u:${payload.sub}`;
      } catch {
        /* token hỏng → đếm theo IP */
      }
    }
    const ip = req.ips?.length ? req.ips[0] : req.ip;
    const ua = String(req.headers?.['user-agent'] ?? '').slice(0, 80);
    return `ip:${ip}|${ua}`;
  }
}
