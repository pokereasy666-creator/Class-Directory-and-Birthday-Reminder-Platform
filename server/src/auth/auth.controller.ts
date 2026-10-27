import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AllowInitialPassword } from '../common/decorators/allow-initial-password.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser } from '../common/types';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

// 登录、注册每个 IP 每分钟最多 10 次，防暴力破解；在请求时读取环境变量，便于测试环境放宽
const AUTH_RATE_LIMIT = {
  default: { limit: () => Number(process.env.AUTH_RATE_LIMIT ?? 10), ttl: 60_000 },
};

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(AUTH_RATE_LIMIT)
  @Post('register')
  @ApiOperation({ summary: '学生注册（需管理员审核）' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle(AUTH_RATE_LIMIT)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: '登录，返回 JWT' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @ApiBearerAuth()
  @AllowInitialPassword()
  @Get('me')
  @ApiOperation({ summary: '当前登录用户信息' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @ApiBearerAuth()
  @AllowInitialPassword()
  @Put('password')
  @ApiOperation({ summary: '修改密码，旧 token 失效并返回新 token' })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto);
  }
}
