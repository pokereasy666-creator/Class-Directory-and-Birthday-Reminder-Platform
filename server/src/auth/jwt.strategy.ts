import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, JwtPayload } from '../common/types';

/**
 * JWT 本身无状态，签发后无法撤销。这里每次请求都回查用户：
 * 账号被禁用/删除，或 token_version 与签发时不一致（改过密码、被重置密码、被禁用过），
 * 旧 token 立即失效。班级规模下多一次主键查询的开销可以忽略。
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ACTIVE' || user.tokenVersion !== payload.ver) {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
