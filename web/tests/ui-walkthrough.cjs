/**
 * 界面自动化走查：用真实浏览器走完主要业务流程并截图。
 *
 * 前置条件：后端已启动并执行过 npm run seed:demo，前端已启动（dev 或 preview）。
 * 运行：node tests/ui-walkthrough.cjs [截图输出目录]
 *   WEB_URL         前端地址，默认 http://localhost:5173
 *   ADMIN_PASSWORD  管理员密码，默认 Admin@123456
 * 需要 Playwright：npm i -D playwright && npx playwright install chromium
 * 走查结束后会删除本次创建的测试账号和公告。出现页面脚本错误时以非 0 退出。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.WEB_URL ?? 'http://localhost:5173';
const API = `${BASE}/api`;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@123456';
const OUT = path.resolve(process.argv[2] ?? path.join(__dirname, 'output'));
const AVATAR = path.join(OUT, 'avatar.png');
fs.mkdirSync(OUT, { recursive: true });
// 1×1 像素 PNG，用于测试头像上传
fs.writeFileSync(
  AVATAR,
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
);

const errors = [];
let step = 0;

async function shot(page, name) {
  step++;
  const file = path.join(OUT, `${String(step).padStart(2, '0')}-${name}.png`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: file, fullPage: false });
  console.log('screenshot', file);
}

function watch(page, label) {
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      errors.push(`[${label}] console.${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 500) errors.push(`[${label}] HTTP ${r.status()} ${r.url()}`);
  });
}

async function login(page, username, password) {
  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder('学号 / 管理员账号').fill(username);
  await page.getByPlaceholder('密码').fill(password);
  await page.getByRole('button', { name: '登录' }).click();
}

async function logout(page) {
  await page.locator('.header .user').click();
  await page.getByText('退出登录').click();
  await page.waitForURL('**/login');
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 }, locale: 'zh-CN' });
  const page = await ctx.newPage();
  watch(page, 'desktop');

  // 1. 登录页 + 注册
  await page.goto(`${BASE}/`);
  await page.waitForURL('**/login**');
  await shot(page, 'login');
  await page.getByText('注册', { exact: true }).click();
  await page.getByPlaceholder('如 2022010101').fill('2022010150');
  await page.getByPlaceholder('请填写真实姓名，便于审核').fill('测试同学');
  await page.locator('input[type=password]').nth(0).fill('Test1234');
  await page.locator('input[type=password]').nth(1).fill('Test1234');
  await shot(page, 'register-form');
  await page.getByRole('button', { name: '提交注册' }).click();
  await page.getByText('注册成功').waitFor();
  await shot(page, 'register-done');

  // 待审核账号无法登录
  await login(page, '2022010150', 'Test1234');
  await page.getByText('账号正在等待管理员审核').waitFor();
  await shot(page, 'login-pending');

  // 2. 管理员：首页、审核
  await login(page, 'admin', ADMIN_PASSWORD);
  await page.waitForURL(`${BASE}/`);
  await page.getByText('近 7 天生日').waitFor();
  await shot(page, 'admin-dashboard');
  await page.goto(`${BASE}/admin/users?status=PENDING`);
  await page.getByText('测试同学').waitFor();
  await shot(page, 'admin-users-pending');
  await page
    .locator('tr', { hasText: '测试同学' })
    .getByRole('button', { name: '通过' })
    .last()
    .click();
  await page.getByText('已通过 测试同学 的注册申请').waitFor();

  // 新增账号（首次登录需改密码）
  await page.goto(`${BASE}/admin/users`);
  await page.getByRole('button', { name: '新增账号' }).click();
  const dialog = page.locator('.el-dialog');
  await dialog.getByLabel('姓名').fill('新来的');
  await dialog.getByLabel('学号').fill('2022010160');
  await dialog.getByLabel('初始密码').fill('Init1234');
  await shot(page, 'admin-create-user');
  await dialog.getByRole('button', { name: '保存' }).click();
  await page.getByText('账号已创建').waitFor();
  await shot(page, 'admin-create-user-done');
  await page
    .getByRole('button', { name: 'OK' })
    .or(page.getByRole('button', { name: '确定' }))
    .click();

  // 生日总览 + 手动提醒
  await page.goto(`${BASE}/admin/birthdays`);
  await page.getByText('全部生日记录').waitFor();
  await page.locator('.el-table__row').first().waitFor();
  await shot(page, 'admin-birthdays');
  await page.getByRole('button', { name: '立即执行生日提醒' }).click();
  await page.getByText('生日提醒已执行').waitFor();
  await shot(page, 'admin-reminder-run');
  await page
    .getByRole('button', { name: 'OK' })
    .or(page.getByRole('button', { name: '确定' }))
    .click();

  // 导出 Excel
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出通讯录 Excel' }).click(),
  ]);
  console.log('download filename:', download.suggestedFilename());
  await download.saveAs(path.join(OUT, 'export.xlsx'));

  // 发布公告
  await page.goto(`${BASE}/admin/announcements`);
  await page.getByRole('button', { name: '发布公告' }).click();
  await page.locator('.el-dialog').getByLabel('标题').fill('期中考试安排');
  await page
    .locator('.el-dialog textarea')
    .fill('期中考试将于下周三开始，请大家做好复习。\n考场安排另行通知。');
  await page.locator('.el-dialog').getByRole('button', { name: '发布' }).click();
  await page.getByText('已发布，全班同学会收到通知').waitFor();
  await shot(page, 'admin-announcements');

  // 分组管理
  await page.goto(`${BASE}/admin/groups`);
  await page.getByText('第一组').waitFor();
  await shot(page, 'admin-groups');
  await logout(page);

  // 3. 学生端
  await login(page, '2022010102', 'Student123');
  await page.waitForURL(`${BASE}/`);
  await page.getByText('近 7 天生日').waitFor();
  await page.locator('.birthday-list .item').first().waitFor();
  await shot(page, 'student-dashboard');

  await page.goto(`${BASE}/directory`);
  await page.locator('.el-table__row').first().waitFor();
  await shot(page, 'directory');
  await page.getByPlaceholder('搜索姓名或学号').fill('张');
  await page.waitForTimeout(800);
  await shot(page, 'directory-search');
  await page.locator('.el-table__row').first().click();
  await page.locator('.el-drawer').getByText('同学信息').waitFor();
  await shot(page, 'directory-detail');
  await page.keyboard.press('Escape');

  await page.goto(`${BASE}/birthdays`);
  await page.locator('.birthday-list .item').first().waitFor();
  await shot(page, 'birthdays-upcoming');
  await page.getByRole('tab', { name: '生日月历' }).click();
  await page.locator('.who').first().waitFor();
  await shot(page, 'birthdays-calendar');

  // 个人中心：设置农历生日、上传头像
  await page.goto(`${BASE}/profile`);
  await page.getByText('个人资料').waitFor();
  await page.getByText('农历', { exact: true }).click();
  // 2004 年没有闰十月：前端允许勾选，由后端按出生年份校验并拒绝
  await page.getByText('闰月', { exact: true }).click();
  await page.getByRole('button', { name: '保存' }).click();
  await page.getByText(/农历2004年没有闰/).waitFor();
  await shot(page, 'profile-invalid-lunar');
  await page.getByText('闰月', { exact: true }).click();
  await page.locator('.el-upload input[type=file]').setInputFiles(AVATAR);
  await page.getByText('头像已更新').waitFor();
  await page.getByRole('button', { name: '保存' }).click();
  await page.getByText('资料已保存').waitFor();
  await shot(page, 'profile');
  // 非法手机号被前端拦截
  await page.getByLabel('手机号').fill('12345');
  await page.getByRole('button', { name: '保存' }).click();
  await page.getByText('手机号格式不正确').waitFor();

  await page.goto(`${BASE}/notifications`);
  await page.locator('.item').first().waitFor();
  await shot(page, 'notifications');

  await page.goto(`${BASE}/announcements`);
  await page.getByText('期中考试安排').first().click();
  await page.locator('.el-dialog').getByText('考场安排另行通知').waitFor();
  await shot(page, 'announcement-detail');
  await page.keyboard.press('Escape');

  // 学生访问管理页被重定向
  await page.goto(`${BASE}/admin/users`);
  await page.waitForURL(`${BASE}/`);
  console.log('student redirected from admin page: ok');

  // 4. 管理员禁用后学生被踢下线
  const adminCtx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const adminPage = await adminCtx.newPage();
  watch(adminPage, 'admin2');
  await login(adminPage, 'admin', ADMIN_PASSWORD);
  await adminPage.waitForURL(`${BASE}/`);
  const token = await adminPage.evaluate(() => localStorage.getItem('class-directory-token'));
  const users = await (
    await fetch(`${API}/admin/users?keyword=2022010102`, {
      headers: { authorization: `Bearer ${token}` },
    })
  ).json();
  const id = users.data.items[0].id;
  await fetch(`${API}/admin/users/${id}/status`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'DISABLED' }),
  });
  await page.goto(`${BASE}/directory`);
  await page.waitForURL('**/login**');
  console.log('disabled student kicked to login: ok');
  await fetch(`${API}/admin/users/${id}/status`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'ACTIVE' }),
  });

  // 5. 管理员新建的账号首次登录强制改密码
  await login(page, '2022010160', 'Init1234');
  await page.waitForURL('**/password');
  await shot(page, 'force-change-password');
  await page.getByLabel('原密码').fill('Init1234');
  await page.getByLabel('新密码', { exact: true }).fill('Mine1234');
  await page.getByLabel('确认新密码').fill('Mine1234');
  await page.getByRole('button', { name: '确认修改' }).click();
  await page.waitForURL(`${BASE}/`);
  console.log('forced password change: ok');

  // 6. 手机端
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const m = await mobile.newPage();
  watch(m, 'mobile');
  await login(m, '2022010101', 'Student123');
  await m.waitForURL(`${BASE}/`);
  await m.locator('.birthday-list .item').first().waitFor();
  await shot(m, 'mobile-dashboard');
  await m.goto(`${BASE}/directory`);
  await m.locator('.cards .card').first().waitFor();
  await shot(m, 'mobile-directory');
  await m.getByRole('button', { name: '打开菜单' }).click();
  await m.locator('.el-drawer').getByText('班级通讯录').first().waitFor();
  await shot(m, 'mobile-menu');

  // 清理本次走查创建的测试账号与公告
  for (const kw of ['2022010150', '2022010160']) {
    const res = await (
      await fetch(`${API}/admin/users?keyword=${kw}`, {
        headers: { authorization: `Bearer ${token}` },
      })
    ).json();
    for (const u of res.data.items) {
      await fetch(`${API}/admin/users/${u.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      });
    }
  }
  const anns = await (
    await fetch(`${API}/announcements`, { headers: { authorization: `Bearer ${token}` } })
  ).json();
  for (const a of anns.data.items.filter((x) => x.title === '期中考试安排')) {
    await fetch(`${API}/admin/announcements/${a.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
  }

  await browser.close();
  // 预期内的 4xx（待审核登录、非法生日、被踢下线等）浏览器会记一条 "Failed to load resource"，不算错误
  const unexpected = errors.filter((e) => !e.includes('Failed to load resource'));
  console.log(`\n走查完成，截图 ${step} 张，输出目录 ${OUT}`);
  if (unexpected.length) {
    console.error('页面错误：\n' + unexpected.join('\n'));
    process.exit(1);
  }
})().catch((e) => {
  console.error('走查失败，步骤', step, e);
  if (errors.length) console.error(errors.join('\n'));
  process.exit(1);
});
