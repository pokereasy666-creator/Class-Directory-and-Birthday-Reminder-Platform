/**
 * 初始化数据：
 *   npm run seed        创建管理员账号（班主任）和默认小组
 *   npm run seed:demo   额外创建演示用的班级数据（生日相对今天生成，任何时候演示都有"近期生日"）
 * 重复执行是安全的：已存在的账号、小组不会被修改。
 */
import 'dotenv/config';
import { CalendarType, Prisma, PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Solar } from 'lunar-javascript';
import { validateBirthday } from '../src/birthdays/birthday.util';
import { addDays, parseDate, today } from '../src/common/date.util';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Student123';

async function upsertUser(data: Prisma.UserCreateInput) {
  return prisma.user.upsert({ where: { username: data.username }, update: {}, create: data });
}

/** 生成"距今天 offset 天"的生日；lunar=true 时换算为农历月日 */
function birthdayIn(offset: number, birthYear: number, lunar = false) {
  const { year, month, day } = parseDate(addDays(today(), offset));
  if (!lunar) {
    return { birthdayCalendar: CalendarType.SOLAR, birthYear, birthMonth: month, birthDay: day };
  }
  const l = Solar.fromYmd(year, month, day).getLunar();
  const lunarBirthday = { month: Math.abs(l.getMonth()), day: l.getDay() };
  // 出生那年的农历月份可能没有三十，不合法时不填年份
  const valid = !validateBirthday(
    { calendar: 'LUNAR', year: birthYear, ...lunarBirthday },
    today(),
  );
  return {
    birthdayCalendar: CalendarType.LUNAR,
    birthYear: valid ? birthYear : null,
    birthMonth: lunarBirthday.month,
    birthDay: lunarBirthday.day,
    birthIsLeapMonth: false,
  };
}

async function seedBase() {
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'Admin@123456';
  await upsertUser({
    username,
    name: process.env.ADMIN_NAME ?? '班主任',
    role: 'ADMIN',
    status: 'ACTIVE',
    passwordHash: await bcrypt.hash(password, 10),
  });
  console.log(`管理员账号：${username}`);

  for (const [i, name] of ['第一组', '第二组', '第三组', '第四组'].entries()) {
    await prisma.classGroup.upsert({ where: { name }, update: {}, create: { name, sort: i + 1 } });
  }
  console.log('默认小组已创建');
}

async function seedDemo() {
  const groups = await prisma.classGroup.findMany({ orderBy: { sort: 'asc' } });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const students: {
    name: string;
    birthday?: ReturnType<typeof birthdayIn> | Record<string, unknown>;
    status?: UserStatus;
    admin?: boolean;
  }[] = [
    { name: '李明', birthday: birthdayIn(0, 2004), admin: true },
    { name: '王芳', birthday: birthdayIn(1, 2004) },
    { name: '张伟', birthday: birthdayIn(3, 2003, true) },
    { name: '刘洋', birthday: birthdayIn(6, 2004) },
    { name: '陈静', birthday: birthdayIn(12, 2005, true) },
    { name: '杨磊', birthday: birthdayIn(20, 2004) },
    { name: '赵丽', birthday: birthdayIn(45, 2004) },
    { name: '黄强', birthday: birthdayIn(90, 2003) },
    {
      name: '周敏',
      birthday: { birthdayCalendar: 'SOLAR', birthYear: 2004, birthMonth: 2, birthDay: 29 },
    },
    {
      name: '吴昊',
      birthday: { birthdayCalendar: 'LUNAR', birthYear: null, birthMonth: 12, birthDay: 30 },
    },
    { name: '郑佳' },
    { name: '孙悦', birthday: birthdayIn(2, 2004), status: 'PENDING' },
    { name: '马超', status: 'PENDING' },
  ];

  for (const [i, s] of students.entries()) {
    const studentNo = `20220101${String(i + 1).padStart(2, '0')}`;
    await upsertUser({
      username: studentNo,
      studentNo,
      name: s.name,
      role: s.admin ? 'ADMIN' : 'STUDENT',
      status: s.status ?? 'ACTIVE',
      passwordHash,
      phone: `1380013${String(8000 + i).padStart(4, '0')}`,
      qq: String(100000 + i * 137),
      email: `${studentNo}@example.com`,
      dorm: `${(i % 3) + 1}号楼 ${300 + (i % 6) + 1}`,
      remark: s.admin ? '班长' : null,
      group: groups.length ? { connect: { id: groups[i % groups.length].id } } : undefined,
      ...(s.birthday as object),
    });
  }

  const existing = await prisma.announcement.count();
  if (!existing) {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { id: 'asc' } });
    await prisma.announcement.createMany({
      data: [
        {
          title: '欢迎使用班级通讯录',
          content: '请大家尽快完善个人资料，填写手机号、宿舍和生日，方便同学之间联系。',
          pinned: true,
          authorId: admin?.id,
        },
        {
          title: '本周五班会通知',
          content: '本周五下午 4 点在 A101 召开班会，请准时参加。',
          authorId: admin?.id,
        },
      ],
    });
  }
  console.log(`演示数据已创建，学生账号为学号（2022010101 起），密码 ${DEMO_PASSWORD}`);
}

async function main() {
  await seedBase();
  if (process.argv.includes('--demo')) await seedDemo();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
