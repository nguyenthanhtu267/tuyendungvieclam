import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { resolveJwtSecret } from '../../config/env-guard';
import { UsersService } from '../../users/users.service';
import { UserStatus } from '../../database/entities/user.entity';
import { UserStatusCache } from '../user-status.cache';

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
    return { userId: payload.sub, email: payload.email, role: entry.role, impersonatedBy: payload.imp };
  }
}
