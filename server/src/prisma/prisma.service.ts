import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient<{ omit: { user: { passwordHash: true } } }>
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // 默认查询不返回密码哈希，需要时显式 omit: { passwordHash: false }
    super({ omit: { user: { passwordHash: true } } });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
