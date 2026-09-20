import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterEmployerDto } from './dto/register-employer.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { UsersService } from '../users/users.service';

// Bảo mật (đợt 12a, 20/09/2026): giới hạn chặt hơn mức mặc định toàn cục (100/60s) riêng cho các
// endpoint nhạy cảm với dò mật khẩu hàng loạt — 8 lần/60 giây theo IP.
const AUTH_THROTTLE = { default: { limit: 8, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register-employer')
  @Throttle(AUTH_THROTTLE)
  registerEmployer(@Body() dto: RegisterEmployerDto) {
    return this.authService.registerEmployer(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() currentUser: { userId: string }) {
    const user = await this.usersService.findById(currentUser.userId);
    if (!user) return null;
    return { id: user.id, email: user.email, role: user.role, status: user.status };
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser() currentUser: { userId: string }, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(currentUser.userId, dto.currentPassword, dto.newPassword);
  }
}
