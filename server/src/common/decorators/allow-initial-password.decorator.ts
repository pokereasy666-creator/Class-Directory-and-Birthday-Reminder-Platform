import { SetMetadata } from '@nestjs/common';

export const ALLOW_INITIAL_PASSWORD_KEY = 'allowInitialPassword';

/** 标记"仍在使用初始密码"的用户也能访问的接口（获取当前用户、修改密码） */
export const AllowInitialPassword = () => SetMetadata(ALLOW_INITIAL_PASSWORD_KEY, true);
