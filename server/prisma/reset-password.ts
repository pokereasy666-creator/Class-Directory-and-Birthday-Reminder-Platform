/**
 * 命令行重置密码（管理员忘记密码时使用）：
 *   npm run reset-password -- <账号> <新密码>
 * 也可以通过环境变量 NEW_PASSWORD 传入新密码，避免密码出现在命令行参数中。
 * 重置后该账号已登录的会话全部失效，下次登录需要修改密码。
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{6,32}$/;

async function main() {
  const [username, argPassword] = process.argv.slice(2);
  const password = argPassword ?? process.env.NEW_PASSWORD;
  if (!username || !password) {
    console.error('用法：npm run reset-password -- <账号> <新密码>');
    process.exitCode = 1;
    return;
  }
  if (!PASSWORD_RULE.test(password)) {
    console.error('密码应为 6~32 位，且同时包含字母和数字');
    process.exitCode = 1;
    return;
  }
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      console.error(`账号不存在：${username}`);
      process.exitCode = 1;
      return;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        mustChangePassword: true,
        tokenVersion: { increment: 1 },
        // 被禁用的管理员也一并恢复，避免唯一的管理员把自己锁在外面
        ...(user.role === 'ADMIN' ? { status: 'ACTIVE' as const } : {}),
      },
    });
    console.log(`已重置 ${user.name}（${username}）的密码，下次登录后需要修改密码`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
