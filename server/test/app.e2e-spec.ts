import { NestExpressApplication } from '@nestjs/platform-express';
import { Workbook } from 'exceljs';
import { existsSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { addDays, parseDate, today } from '../src/common/date.util';
import { uploadRoot } from '../src/common/upload.util';
import { PrismaService } from '../src/prisma/prisma.service';
import { auth, createApp, createUser, login, PASSWORD, resetDb } from './helpers';

/** 距今天 offset 天的公历生日字段 */
function solarBirthdayIn(offset: number) {
  const { month, day } = parseDate(addDays(today(), offset));
  return { birthdayCalendar: 'SOLAR' as const, birthYear: 2004, birthMonth: month, birthDay: day };
}

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('班级通讯录与生日提醒平台 e2e', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    ({ app, prisma } = await createApp());
    http = request(app.getHttpServer());
  });

  beforeEach(() => resetDb(prisma));

  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  describe('注册与登录', () => {
    it('注册后为待审核，审核通过前不能登录，通过后可以登录', async () => {
      const admin = await createUser(prisma, { role: 'ADMIN', username: 'admin', studentNo: null });
      const reg = await http
        .post('/api/auth/register')
        .send({ studentNo: '2022010101', name: '张三', password: 'abc123' });
      expect(reg.status).toBe(201);
      expect(reg.body).toEqual({
        code: 0,
        message: 'success',
        data: { message: '注册成功，请等待管理员审核' },
      });

      const pending = await http
        .post('/api/auth/login')
        .send({ username: '2022010101', password: 'abc123' });
      expect(pending.status).toBe(403);
      expect(pending.body.message).toBe('账号正在等待管理员审核');

      const user = await prisma.user.findUniqueOrThrow({ where: { username: '2022010101' } });
      const adminToken = await login(app, admin.username);
      await http
        .patch(`/api/admin/users/${user.id}/status`)
        .set(auth(adminToken))
        .send({ status: 'ACTIVE' })
        .expect(200);

      const ok = await http
        .post('/api/auth/login')
        .send({ username: '2022010101', password: 'abc123' });
      expect(ok.status).toBe(200);
      expect(ok.body.data.user).toMatchObject({
        name: '张三',
        studentNo: '2022010101',
        status: 'ACTIVE',
      });
      expect(ok.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('重复学号、非法字段被拒绝', async () => {
      await createUser(prisma, { studentNo: '2022010101' });
      const dup = await http
        .post('/api/auth/register')
        .send({ studentNo: '2022010101', name: '张三', password: 'abc123' });
      expect(dup.status).toBe(409);
      expect(dup.body.message).toBe('该学号已注册');

      const cases: [object, string][] = [
        [{ studentNo: 'abc', name: '张三', password: 'abc123' }, '学号应为 4~20 位数字'],
        [
          { studentNo: '2022010102', name: '张', password: 'abc123' },
          '姓名应为 2~20 个中文或英文字符',
        ],
        [
          { studentNo: '2022010102', name: '张三', password: '123456' },
          '密码应为 6~32 位，且同时包含字母和数字',
        ],
        [
          { studentNo: '2022010102', name: '张三', password: 'abc123', phone: '12345' },
          '手机号格式不正确',
        ],
      ];
      for (const [body, message] of cases) {
        const res = await http.post('/api/auth/register').send(body);
        expect({ status: res.status, message: res.body.message }).toEqual({ status: 400, message });
      }
    });

    it('账号不存在与密码错误返回相同提示', async () => {
      await createUser(prisma, { studentNo: '2022010101' });
      const wrong = await http
        .post('/api/auth/login')
        .send({ username: '2022010101', password: 'nope123' });
      const missing = await http
        .post('/api/auth/login')
        .send({ username: '9999999', password: 'nope123' });
      expect(wrong.status).toBe(401);
      expect(missing.status).toBe(401);
      expect(wrong.body.message).toBe(missing.body.message);
    });
  });

  describe('权限与 token 吊销', () => {
    it('未登录 401，学生访问管理接口 403', async () => {
      const student = await createUser(prisma);
      expect((await http.get('/api/users')).status).toBe(401);
      const token = await login(app, student.username);
      const res = await http.get('/api/admin/users').set(auth(token));
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('没有权限执行此操作');
    });

    it('禁用账号后旧 token 立即失效', async () => {
      const admin = await createUser(prisma, { role: 'ADMIN', username: 'admin', studentNo: null });
      const student = await createUser(prisma);
      const token = await login(app, student.username);
      await http.get('/api/auth/me').set(auth(token)).expect(200);

      const adminToken = await login(app, admin.username);
      await http
        .patch(`/api/admin/users/${student.id}/status`)
        .set(auth(adminToken))
        .send({ status: 'DISABLED' })
        .expect(200);

      const res = await http.get('/api/auth/me').set(auth(token));
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('登录已失效，请重新登录');
      const relogin = await http
        .post('/api/auth/login')
        .send({ username: student.username, password: PASSWORD });
      expect(relogin.status).toBe(403);
    });

    it('修改密码后旧 token 失效，返回的新 token 可用', async () => {
      const student = await createUser(prisma);
      const oldToken = await login(app, student.username);
      const res = await http
        .put('/api/auth/password')
        .set(auth(oldToken))
        .send({ oldPassword: PASSWORD, newPassword: 'New12345' })
        .expect(200);
      await http.get('/api/auth/me').set(auth(oldToken)).expect(401);
      await http.get('/api/auth/me').set(auth(res.body.data.token)).expect(200);
      await login(app, student.username, 'New12345');
    });

    it('管理员重置密码后必须先修改初始密码才能使用其他功能', async () => {
      const admin = await createUser(prisma, { role: 'ADMIN', username: 'admin', studentNo: null });
      const student = await createUser(prisma);
      const studentOld = await login(app, student.username);
      const adminToken = await login(app, admin.username);
      await http
        .post(`/api/admin/users/${student.id}/reset-password`)
        .set(auth(adminToken))
        .send({ password: 'Init1234' })
        .expect(200);
      await http.get('/api/auth/me').set(auth(studentOld)).expect(401);

      const token = await login(app, student.username, 'Init1234');
      const blocked = await http.get('/api/users').set(auth(token));
      expect(blocked.status).toBe(403);
      expect(blocked.body.message).toBe('请先修改初始密码');
      const me = await http.get('/api/auth/me').set(auth(token)).expect(200);
      expect(me.body.data.mustChangePassword).toBe(true);

      const changed = await http
        .put('/api/auth/password')
        .set(auth(token))
        .send({ oldPassword: 'Init1234', newPassword: 'Mine1234' })
        .expect(200);
      await http.get('/api/users').set(auth(changed.body.data.token)).expect(200);
    });

    it('管理员不能禁用、删除自己', async () => {
      const admin = await createUser(prisma, { role: 'ADMIN', username: 'admin', studentNo: null });
      const token = await login(app, admin.username);
      await http
        .patch(`/api/admin/users/${admin.id}/status`)
        .set(auth(token))
        .send({ status: 'DISABLED' })
        .expect(403);
      await http.delete(`/api/admin/users/${admin.id}`).set(auth(token)).expect(403);
    });
  });

  describe('个人资料与通讯录', () => {
    it('修改资料：校验格式、清空字段、学生不能改姓名', async () => {
      const student = await createUser(prisma, { name: '李四', qq: '123456' });
      const token = await login(app, student.username);

      const bad = await http.put('/api/profile').set(auth(token)).send({ phone: '123' });
      expect(bad.status).toBe(400);
      expect(bad.body.message).toBe('手机号格式不正确');

      const res = await http
        .put('/api/profile')
        .set(auth(token))
        .send({ phone: '13800138000', qq: '', dorm: ' 3号楼 402 ', name: '王五' })
        .expect(200);
      expect(res.body.data).toMatchObject({
        name: '李四',
        phone: '13800138000',
        qq: null,
        dorm: '3号楼 402',
      });
    });

    it('设置农历生日：合法保存，不存在的日期被拒绝，null 清除', async () => {
      const student = await createUser(prisma);
      const token = await login(app, student.username);

      const ok = await http
        .put('/api/profile')
        .set(auth(token))
        .send({ birthday: { calendar: 'LUNAR', year: 2025, month: 6, day: 3, isLeapMonth: true } })
        .expect(200);
      expect(ok.body.data.birthday).toMatchObject({
        calendar: 'LUNAR',
        isLeapMonth: true,
        text: '农历2025年闰六月初三',
      });

      const bad = await http
        .put('/api/profile')
        .set(auth(token))
        .send({ birthday: { calendar: 'LUNAR', year: 2024, month: 6, day: 3, isLeapMonth: true } });
      expect(bad.status).toBe(400);
      expect(bad.body.message).toBe('农历2024年没有闰六月');

      const cleared = await http
        .put('/api/profile')
        .set(auth(token))
        .send({ birthday: null })
        .expect(200);
      expect(cleared.body.data.birthday).toBeNull();
    });

    it('上传头像：校验文件内容与大小，替换时删除旧文件', async () => {
      const student = await createUser(prisma);
      const token = await login(app, student.username);

      const first = await http
        .post('/api/profile/avatar')
        .set(auth(token))
        .attach('file', PNG_1x1, 'a.png')
        .expect(201);
      const firstPath = join(uploadRoot(), first.body.data.avatar.replace('/uploads/', ''));
      expect(existsSync(firstPath)).toBe(true);
      await http.get(first.body.data.avatar).expect(200);

      const second = await http
        .post('/api/profile/avatar')
        .set(auth(token))
        .attach('file', PNG_1x1, 'b.png')
        .expect(201);
      expect(second.body.data.avatar).not.toBe(first.body.data.avatar);
      expect(existsSync(firstPath)).toBe(false);

      const fake = await http
        .post('/api/profile/avatar')
        .set(auth(token))
        .attach('file', Buffer.from('<script>alert(1)</script>'), {
          filename: 'x.png',
          contentType: 'image/png',
        });
      expect(fake.status).toBe(400);

      const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(2 * 1024 * 1024)]);
      const tooBig = await http
        .post('/api/profile/avatar')
        .set(auth(token))
        .attach('file', big, 'big.jpg');
      expect(tooBig.status).toBe(413);
    });

    it('通讯录只显示正常账号，支持姓名/学号搜索和分页', async () => {
      const group = await prisma.classGroup.create({ data: { name: '第一组' } });
      const me = await createUser(prisma, {
        name: '张三',
        studentNo: '2022010101',
        groupId: group.id,
      });
      await createUser(prisma, { name: '张小明', studentNo: '2022010102' });
      await createUser(prisma, { name: '李四', studentNo: '2022010103', groupId: group.id });
      await createUser(prisma, { name: '张待审', studentNo: '2022010104', status: 'PENDING' });
      await createUser(prisma, { name: '张禁用', studentNo: '2022010105', status: 'DISABLED' });
      const token = await login(app, me.username);

      const byName = await http
        .get('/api/users')
        .query({ keyword: '张' })
        .set(auth(token))
        .expect(200);
      expect(byName.body.data.items.map((u: { name: string }) => u.name)).toEqual([
        '张三',
        '张小明',
      ]);

      const byNo = await http
        .get('/api/users')
        .query({ keyword: '0103' })
        .set(auth(token))
        .expect(200);
      expect(byNo.body.data.items.map((u: { name: string }) => u.name)).toEqual(['李四']);

      const byGroup = await http
        .get('/api/users')
        .query({ groupId: group.id })
        .set(auth(token))
        .expect(200);
      expect(byGroup.body.data.total).toBe(2);

      const page2 = await http
        .get('/api/users')
        .query({ page: 2, pageSize: 2 })
        .set(auth(token))
        .expect(200);
      expect(page2.body.data).toMatchObject({ total: 3, page: 2, pageSize: 2 });
      expect(page2.body.data.items).toHaveLength(1);
    });
  });

  describe('生日查询', () => {
    it('近 7 天按日期排序，包含今天、不含第 7 天之后', async () => {
      const me = await createUser(prisma, { name: '本人', ...solarBirthdayIn(3) });
      await createUser(prisma, { name: '今天', ...solarBirthdayIn(0) });
      await createUser(prisma, { name: '第六天', ...solarBirthdayIn(6) });
      await createUser(prisma, { name: '第七天', ...solarBirthdayIn(7) });
      await createUser(prisma, { name: '待审核', status: 'PENDING', ...solarBirthdayIn(1) });
      const token = await login(app, me.username);

      const res = await http.get('/api/birthdays/upcoming').set(auth(token)).expect(200);
      expect(
        res.body.data.map((e: { user: { name: string }; daysLeft: number }) => [
          e.user.name,
          e.daysLeft,
        ]),
      ).toEqual([
        ['今天', 0],
        ['本人', 3],
        ['第六天', 6],
      ]);
      expect(res.body.data[0]).toMatchObject({
        date: today(),
        age: parseDate(today()).year - 2004,
      });

      const todayList = await http.get('/api/birthdays/today').set(auth(token)).expect(200);
      expect(todayList.body.data.map((e: { user: { name: string } }) => e.user.name)).toEqual([
        '今天',
      ]);

      await http.get('/api/birthdays/upcoming').query({ days: 61 }).set(auth(token)).expect(400);
    });

    it('按月查询：农历生日按当年对应的公历日期归入月份', async () => {
      // 农历 2026 年八月十五 = 公历 2026-09-25
      const me = await createUser(prisma, {
        name: '中秋',
        birthdayCalendar: 'LUNAR',
        birthYear: 2004,
        birthMonth: 8,
        birthDay: 15,
      });
      await createUser(prisma, {
        name: '九月一日',
        birthdayCalendar: 'SOLAR',
        birthMonth: 9,
        birthDay: 1,
      });
      await createUser(prisma, {
        name: '十月',
        birthdayCalendar: 'SOLAR',
        birthMonth: 10,
        birthDay: 1,
      });
      const token = await login(app, me.username);

      const res = await http
        .get('/api/birthdays/month')
        .query({ year: 2026, month: 9 })
        .set(auth(token))
        .expect(200);
      expect(
        res.body.data.map((e: { user: { name: string }; date: string }) => [e.user.name, e.date]),
      ).toEqual([
        ['九月一日', '2026-09-01'],
        ['中秋', '2026-09-25'],
      ]);
    });
  });

  describe('生日提醒与通知', () => {
    it('当天生日通知全班并祝福本人，提前一天提醒，重复执行不重复通知', async () => {
      const admin = await createUser(prisma, { role: 'ADMIN', username: 'admin', studentNo: null });
      const star = await createUser(prisma, { name: '寿星', ...solarBirthdayIn(0) });
      const tomorrow = await createUser(prisma, { name: '明天', ...solarBirthdayIn(1) });
      const other = await createUser(prisma, { name: '其他' });
      await createUser(prisma, { name: '已禁用', status: 'DISABLED' });
      const adminToken = await login(app, admin.username);

      const first = await http
        .post('/api/admin/reminders/run')
        .set(auth(adminToken))
        .send({})
        .expect(200);
      // 今天：admin、明天、其他 3 人收到提醒 + 寿星本人 1 条祝福；明天：admin、寿星、其他 3 人
      expect(first.body.data).toMatchObject({
        date: today(),
        birthdayToday: 1,
        birthdayUpcoming: 1,
        created: 7,
      });

      const again = await http
        .post('/api/admin/reminders/run')
        .set(auth(adminToken))
        .send({})
        .expect(200);
      expect(again.body.data.created).toBe(0);

      const starToken = await login(app, star.username);
      const starList = await http.get('/api/notifications').set(auth(starToken)).expect(200);
      expect(starList.body.data.items.map((n: { title: string }) => n.title).sort()).toEqual(
        ['寿星，生日快乐！', '明天是 明天 的生日'].sort(),
      );

      const otherToken = await login(app, other.username);
      const count = await http
        .get('/api/notifications/unread-count')
        .set(auth(otherToken))
        .expect(200);
      expect(count.body.data.count).toBe(2);
      const list = await http.get('/api/notifications').set(auth(otherToken)).expect(200);
      await http
        .put(`/api/notifications/${list.body.data.items[0].id}/read`)
        .set(auth(otherToken))
        .expect(200);
      const unreadOnly = await http
        .get('/api/notifications')
        .query({ unreadOnly: 'true' })
        .set(auth(otherToken))
        .expect(200);
      expect(unreadOnly.body.data.total).toBe(1);
      await http.put('/api/notifications/read-all').set(auth(otherToken)).expect(200);
      const after = await http
        .get('/api/notifications/unread-count')
        .set(auth(otherToken))
        .expect(200);
      expect(after.body.data.count).toBe(0);

      // 不能把别人的通知标为已读
      const starNotification = starList.body.data.items[0].id;
      await http
        .put(`/api/notifications/${starNotification}/read`)
        .set(auth(otherToken))
        .expect(404);
      void tomorrow;
    });

    it('发布公告通知全班（不含发布者），删除公告同时删除通知', async () => {
      const admin = await createUser(prisma, { role: 'ADMIN', username: 'admin', studentNo: null });
      const student = await createUser(prisma);
      await createUser(prisma, { status: 'PENDING' });
      const adminToken = await login(app, admin.username);

      const created = await http
        .post('/api/admin/announcements')
        .set(auth(adminToken))
        .send({ title: '班会通知', content: '周五下午开班会', pinned: true })
        .expect(201);
      expect(await prisma.notification.count({ where: { type: 'ANNOUNCEMENT' } })).toBe(1);

      const studentToken = await login(app, student.username);
      const list = await http.get('/api/announcements').set(auth(studentToken)).expect(200);
      expect(list.body.data.items[0]).toMatchObject({
        title: '班会通知',
        pinned: true,
        author: { id: admin.id },
      });
      await http
        .post('/api/admin/announcements')
        .set(auth(studentToken))
        .send({ title: 'x', content: 'y' })
        .expect(403);

      await http
        .delete(`/api/admin/announcements/${created.body.data.id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(await prisma.notification.count()).toBe(0);
    });
  });

  describe('管理员', () => {
    it('新建账号：学生必须有学号，学号唯一；编辑学号时同步登录账号', async () => {
      const admin = await createUser(prisma, { role: 'ADMIN', username: 'admin', studentNo: null });
      const token = await login(app, admin.username);

      const noNo = await http
        .post('/api/admin/users')
        .set(auth(token))
        .send({ name: '无学号', password: 'Init1234' });
      expect(noNo.status).toBe(400);

      const created = await http
        .post('/api/admin/users')
        .set(auth(token))
        .send({ name: '新同学', studentNo: '2022010199', password: 'Init1234' })
        .expect(201);
      expect(created.body.data).toMatchObject({
        username: '2022010199',
        status: 'ACTIVE',
        mustChangePassword: true,
      });

      const dup = await http
        .post('/api/admin/users')
        .set(auth(token))
        .send({ name: '重复', studentNo: '2022010199', password: 'Init1234' });
      expect(dup.status).toBe(409);

      const edited = await http
        .put(`/api/admin/users/${created.body.data.id}`)
        .set(auth(token))
        .send({ studentNo: '2022010198', name: '新名字' })
        .expect(200);
      expect(edited.body.data).toMatchObject({
        username: '2022010198',
        studentNo: '2022010198',
        name: '新名字',
      });

      const teacher = await http
        .post('/api/admin/users')
        .set(auth(token))
        .send({ name: '王老师', username: 'teacher', role: 'ADMIN', password: 'Init1234' })
        .expect(201);
      expect(teacher.body.data).toMatchObject({
        username: 'teacher',
        studentNo: null,
        role: 'ADMIN',
      });
    });

    it('删除学生同时清理其生日通知；删除小组后成员变为未分组', async () => {
      const admin = await createUser(prisma, { role: 'ADMIN', username: 'admin', studentNo: null });
      const group = await prisma.classGroup.create({ data: { name: '第一组' } });
      const star = await createUser(prisma, { ...solarBirthdayIn(0), groupId: group.id });
      const token = await login(app, admin.username);
      await http.post('/api/admin/reminders/run').set(auth(token)).send({}).expect(200);
      expect(await prisma.notification.count({ where: { relatedId: star.id } })).toBe(2);

      await http.delete(`/api/admin/groups/${group.id}`).set(auth(token)).expect(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: star.id } })).groupId).toBeNull();

      await http.delete(`/api/admin/users/${star.id}`).set(auth(token)).expect(200);
      expect(await prisma.notification.count()).toBe(0);
    });

    it('统计、生日总览与导出 Excel', async () => {
      const admin = await createUser(prisma, { role: 'ADMIN', username: 'admin', studentNo: null });
      await createUser(prisma, {
        name: '有生日',
        studentNo: '2022010101',
        phone: '13800138000',
        ...solarBirthdayIn(2),
      });
      await createUser(prisma, { name: '没生日', studentNo: '2022010102' });
      await createUser(prisma, { name: '待审核', status: 'PENDING' });
      const token = await login(app, admin.username);

      const stats = await http.get('/api/admin/stats').set(auth(token)).expect(200);
      expect(stats.body.data).toEqual({
        total: 4,
        active: 3,
        pending: 1,
        disabled: 0,
        missingBirthday: 2,
      });

      const overview = await http.get('/api/admin/birthdays').set(auth(token)).expect(200);
      expect(
        overview.body.data.entries.map((e: { user: { name: string } }) => e.user.name),
      ).toEqual(['有生日']);
      expect(overview.body.data.missing.map((u: { name: string }) => u.name).sort()).toEqual(
        ['没生日', '测试用户'].sort(),
      );

      const res = await http
        .get('/api/admin/export/directory')
        .set(auth(token))
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (c: Buffer) => chunks.push(c));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      const workbook = new Workbook();
      await workbook.xlsx.load(res.body);
      const sheet = workbook.getWorksheet('班级通讯录')!;
      expect(sheet.rowCount).toBe(4); // 表头 + 3 个正常账号
      expect(sheet.getRow(1).getCell(2).value).toBe('学号');
      const phones = [2, 3, 4].map((i) => sheet.getRow(i).getCell(6).value);
      expect(phones).toContain('13800138000');
    });
  });
});
