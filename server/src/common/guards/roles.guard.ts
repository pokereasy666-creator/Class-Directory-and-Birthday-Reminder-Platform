import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ALLOW_INITIAL_PASSWORD_KEY } from '../decorators/allow-initial-password.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../types';

/**
 * 全局权限校验：
 * 1. 管理员新建或重置密码的账号，在修改初始密码前只能访问 @AllowInitialPassword() 接口；
 * 2. @Roles() 限定的接口要求当前用户具备对应角色。
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const user: AuthUser | undefined = context.switchToHttp().getRequest().user;
    if (!user) return true; // @Public() 接口

    const targets = [context.getHandler(), context.getClass()];
    if (
      user.mustChangePassword &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_INITIAL_PASSWORD_KEY, targets)
    ) {
      throw new ForbiddenException('请先修改初始密码');
    }

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);
    if (roles?.length && !roles.includes(user.role)) {
      throw new ForbiddenException('没有权限执行此操作');
    }
    return true;
  }
}
