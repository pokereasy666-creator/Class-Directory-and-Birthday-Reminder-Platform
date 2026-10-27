import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

export const PASSWORD = 'Test1234';
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

export async function createApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  setupApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** 清空测试库。只允许操作库名以 _test 结尾的数据库，防止误删开发/生产数据 */
export async function resetDb(prisma: PrismaService) {
  const dbName = new URL(process.env.DATABASE_URL!).pathname.slice(1);
  if (!dbName.endsWith('_test')) throw new Error(`拒绝清空非测试库：${dbName}`);
  await prisma.notification.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.user.deleteMany();
  await prisma.classGroup.deleteMany();
}

let seq = 0;

export function createUser(
  prisma: PrismaService,
  data: Partial<Prisma.UserUncheckedCreateInput> = {},
) {
  seq++;
  const studentNo =
    data.studentNo === undefined ? `20990000${String(seq).padStart(2, '0')}` : data.studentNo;
  return prisma.user.create({
    data: {
      username: data.username ?? studentNo ?? `user${seq}`,
      name: '测试用户',
      status: 'ACTIVE',
      passwordHash,
      ...data,
      studentNo,
    },
  });
}

export async function login(app: NestExpressApplication, username: string, password = PASSWORD) {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ username, password });
  if (res.status !== 200) throw new Error(`登录失败 ${username}: ${JSON.stringify(res.body)}`);
  return res.body.data.token as string;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
