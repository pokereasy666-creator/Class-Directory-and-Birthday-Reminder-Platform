import { ExecutionContext, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { TokenExpiredError } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/** 全局登录校验，@Public() 标记的接口跳过 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return isPublic ? true : super.canActivate(context);
  }

  handleRequest<TUser>(err: unknown, user: TUser, info: unknown): TUser {
    if (err instanceof HttpException) throw err;
    if (err || !user) {
      throw new UnauthorizedException(
        info instanceof TokenExpiredError ? '登录已过期，请重新登录' : '请先登录',
      );
    }
    return user;
  }
}
