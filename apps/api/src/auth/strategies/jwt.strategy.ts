import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { resolveJwtSecret } from '../../config/env-guard';
import { UsersService } from '../../users/users.service';
import { UserStatus } from '../../database/entities/user.entity';
import { UserStatusCache } from '../user-status.cache';

const lastTouch = new Map<string, number>();
const TOUCH_EVERY_MS = 10 * 60 * 1000;

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  // Đợt 18e — có mặt khi Admin "Đăng nhập thay" người dùng này (id của Admin).
  imp?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(configService.get<string>('JWT_SECRET')),
    });
  }

  // Đợt 18e (26/09/2026) — kiểm tra trạng thái tài khoản (có bộ nhớ đệm 30 giây): tài khoản bị Admin
  // khoá / đã bị xoá thì token cũ lập tức hết dùng được. Vai trò lấy theo CSDL (Admin có thể đổi vai
  // trò quản trị) thay vì tin hoàn toàn vào token.
  async validate(payload: JwtPayload) {
    let entry = UserStatusCache.get(payload.sub);
    if (!entry) {
      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException('Tài khoản không còn tồn tại');
      UserStatusCache.set(user.id, user.status, user.role);
      entry = { status: user.status, role: user.role, at: Date.now() };
    }
    if (entry.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Tài khoản đã bị khoá — vui lòng liên hệ quản trị viên');
    }
    // Đợt 73 — ghi "lần hoạt động gần nhất" của ứng viên (tối đa 10 phút/lần, bỏ qua khi Admin đăng nhập thay).
    if (entry.role === 'candidate' && !payload.imp) {
      const now = Date.now();
      if (now - (lastTouch.get(payload.sub) ?? 0) > TOUCH_EVERY_MS) {
        if (lastTouch.size > 20_000) lastTouch.clear();
        lastTouch.set(payload.sub, now);
        this.usersService.touchActive(payload.sub).catch(() => undefined);
      }
    }
    return { userId: payload.sub, email: payload.email, role: entry.role, impersonatedBy: payload.imp };
  }
}
