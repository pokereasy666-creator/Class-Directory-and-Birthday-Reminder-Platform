# 班级通讯录与生日提醒平台

面向一个班级的通讯录 + 生日提醒 Web 应用。学生注册（经管理员审核）后可以浏览全班通讯录、维护个人资料、查看近期生日；系统每天自动给全班发送生日提醒。管理员（班长 / 班主任）负责账号审核、通讯录维护、分组、公告和导出。

![学生首页](docs/screenshots/student-dashboard.png)

## 功能

**学生端**

- 注册 / 登录（账号密码 + JWT）；注册后需管理员审核才能登录
- 班级通讯录：姓名、学号、电话、QQ、邮箱、宿舍、生日、备注；按姓名 / 学号搜索，按小组筛选；手机上为卡片视图，可一键拨号
- 个人信息维护：修改联系方式、宿舍、备注，上传头像，设置生日（公历 / 农历、可不公开年份、农历闰月）
- 生日：今日寿星横幅、近 7 / 14 / 30 天生日、本月生日、生日月历
- 主动提醒：每天 8:00 站内通知"今天 / 明天是 XX 的生日"，寿星本人收到祝福；可选邮件提醒
- 班级公告、消息通知（未读角标）、修改密码

**管理员端**

- 用户管理：审核注册（通过 / 驳回）、新增账号（首次登录强制改密）、启用 / 禁用（立即踢下线）、重置密码、删除
- 通讯录管理：编辑任一学生的全部信息（包括姓名、学号、小组、身份）
- 班级分组、公告管理（发布即通知全班）
- 生日总览（含未填写生日名单）、导出通讯录 Excel、手动执行生日提醒（可指定日期，便于演示）

## 技术栈

| 层 | 选型 |
|---|---|
| 后端 | NestJS 11 · Prisma 6 · MySQL 8 · Passport-JWT · class-validator · @nestjs/schedule · exceljs · nodemailer |
| 生日算法 | 自研 `nextOccurrence`（公历 / 农历统一），农历换算基于 lunar-javascript |
| 前端 | Vue 3 · Vite 7 · TypeScript · Element Plus · Pinia · Vue Router · Axios |
| 测试 | Jest（单元 + e2e，supertest）· Playwright（界面走查） |

## 目录结构

```
├── server/                 后端（NestJS）
│   ├── prisma/             数据模型、迁移、初始化数据
│   ├── src/
│   │   ├── birthdays/      生日核心算法 birthday.util.ts 及接口
│   │   ├── auth/ users/ groups/ announcements/ notifications/ admin/
│   │   └── common/         统一响应、异常过滤、守卫、校验规则、日期工具
│   └── test/               e2e 测试
├── web/                    前端（Vue 3）
│   └── src/  api/ stores/ router/ layouts/ components/ views/
├── docs/                   需求分析、系统设计、接口文档、测试报告、截图
└── docker-compose.yml      本地 MySQL
```

## 快速开始

环境要求：Node.js 20+（开发使用 22），MySQL 8。

### 1. 数据库

有 Docker 时：

```bash
docker compose up -d
```

或使用已有的 MySQL 8，创建数据库和用户：

```sql
CREATE DATABASE class_directory DEFAULT CHARACTER SET utf8mb4;
CREATE USER 'classbook'@'%' IDENTIFIED BY 'classbook123';
GRANT ALL PRIVILEGES ON *.* TO 'classbook'@'%';  -- prisma migrate dev 需要创建影子库的权限
```

### 2. 后端

```bash
cd server
npm install
cp .env.example .env          # 按需修改数据库连接、JWT_SECRET
npx prisma migrate deploy     # 建表
npm run seed:demo             # 管理员 + 默认小组 + 演示数据（只要管理员用 npm run seed）
npm run dev                   # http://localhost:3000/api ，接口文档 http://localhost:3000/api/docs
```

### 3. 前端

```bash
cd web
npm install
npm run dev                   # http://localhost:5173 ，/api 与 /uploads 自动代理到 3000 端口
```

### 默认账号

| 身份 | 账号 | 密码 |
|---|---|---|
| 管理员（班主任） | `admin` | `Admin@123456`（`.env` 中 `ADMIN_PASSWORD`） |
| 演示学生 / 班长 | 学号 `2022010101` ~ `2022010111` | `Student123` |
| 待审核演示账号 | `2022010112`、`2022010113` | `Student123`（审核通过前无法登录） |

演示数据中的生日按"今天"生成，任何时候启动都能看到今日寿星和近期生日。

## 测试

```bash
cd server
npm test              # 单元测试：生日算法（含 600 组随机用例与逐日扫描结果交叉验证）
npm run test:e2e      # 接口 e2e 测试，使用独立测试库 class_directory_test
npm run lint

cd ../web
npm run type-check && npm run lint && npm run build

# 界面走查（需先启动前后端并导入演示数据；需要 Playwright）
node tests/ui-walkthrough.cjs
```

e2e 测试默认连接 `mysql://classbook:classbook123@127.0.0.1:3306/class_directory_test`，可用环境变量 `TEST_DATABASE_URL` 覆盖。测试会清空该库，为防误删，库名必须以 `_test` 结尾。

## 部署

1. 后端：`npm ci && npx prisma migrate deploy && npm run build && npm run start:prod`（建议用 pm2 / systemd 守护）。生产环境务必设置随机的 `JWT_SECRET`、修改 `ADMIN_PASSWORD`。
2. 前端：`npm ci && npm run build`，把 `web/dist` 交给 Nginx 托管，并将 `/api`、`/uploads` 反向代理到后端：

```nginx
server {
  listen 80;
  root /var/www/class-directory/dist;
  location / { try_files $uri $uri/ /index.html; }
  location /api/ { proxy_pass http://127.0.0.1:3000; client_max_body_size 3m; }
  location /uploads/ { proxy_pass http://127.0.0.1:3000; }
}
```

3. 头像保存在 `server/uploads/`（可用 `UPLOAD_DIR` 修改），需要随数据库一起备份。

## 环境变量（server/.env）

| 变量 | 说明 | 默认 |
|---|---|---|
| `DATABASE_URL` | MySQL 连接串 | — |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | JWT 密钥 / 有效期 | — / `1d` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_NAME` | seed 创建的管理员 | `admin` / `Admin@123456` / `班主任` |
| `REMINDER_CRON` | 每日提醒时间（Asia/Shanghai），`off` 关闭 | `0 8 * * *` |
| `REMINDER_ADVANCE_DAYS` | 提前几天提醒，`0` 不提前 | `1` |
| `AUTH_RATE_LIMIT` | 登录 / 注册每 IP 每分钟次数上限 | `10` |
| `UPLOAD_DIR` | 上传文件目录 | `server/uploads` |
| `SMTP_HOST` 等 | 邮件提醒，`SMTP_HOST` 为空则不发邮件 | 空 |

## 文档

- [需求分析](docs/需求分析.md)
- [系统设计](docs/系统设计.md)（架构、E-R 图、生日算法、安全设计）
- [接口文档](docs/接口文档.md)（运行后也可访问 Swagger：`/api/docs`）
- [测试报告](docs/测试报告.md)
