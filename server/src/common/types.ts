import { Role } from '@prisma/client';

/** JWT 校验通过后挂在 request.user 上的当前用户 */
export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface JwtPayload {
  sub: number;
  /** 对应 user.token_version，不一致说明 token 已被吊销 */
  ver: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
