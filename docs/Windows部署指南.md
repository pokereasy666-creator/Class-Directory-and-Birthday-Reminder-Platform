# Windows 部署指南

适用于 Windows 10 / 11（64 位），也适用于 Windows Server 2016 及以上。

部署完成后，平台由一个 Node.js 进程同时提供页面和接口，默认地址为 `http://localhost:3000`，不需要安装 Nginx。

| 使用场景 | 做法 |
|---|---|
| 答辩演示、本机试用 | 第 1、2 节 → `start.bat` |
| 宿舍 / 实验室电脑长期运行，同学在局域网内访问 | 第 1、2 节 → `service.bat` 安装后台服务 → 第 4.1 节 |
| 同学在任何地方都能访问 | 部署到云服务器（同样按本指南），或使用内网穿透，见第 4.2 节 |

所有脚本都在 `scripts\windows\` 目录下，双击 `.bat` 文件即可运行：

| 脚本 | 作用 | 需要管理员 |
|---|---|---|
| `setup.bat` | 一键部署；更新代码后再次运行即可升级 | 否 |
| `start.bat` | 在当前窗口启动，关闭窗口即停止 | 否 |
| `service.bat` | 后台服务管理：安装（开机自启）、启动、停止、重启、状态、日志、卸载 | 是（自动请求） |
| `backup.bat` | 备份数据库和头像 | 否 |
| `reset-password.bat` | 重置任意账号密码（忘记管理员密码时用） | 否 |
| `dev.bat` | 开发模式，修改代码时使用 | 否 |

---

## 1. 准备工作

### 1.1 安装 Node.js

1. 打开 <https://nodejs.org/zh-cn>，下载 **22.x LTS**（长期支持版）的 Windows 安装程序（`.msi`）。
2. 双击安装，全部保持默认，确认勾选了 **Add to PATH**。安装程序询问是否安装 "Tools for Native Modules" 时可以不勾选，本项目不需要。
3. 安装完成后，按 `Win + R` 输入 `cmd` 打开命令提示符，执行：

   ```bat
   node -v
   ```

   显示 `v22.12.0` 或更高即可（20.x 需要 20.19 以上）。

> 也可以在命令提示符中运行 `winget install OpenJS.NodeJS.LTS` 安装。安装后需**关闭并重新打开**命令窗口，新的 PATH 才会生效。

### 1.2 安装 MySQL 8.0

1. 打开 <https://dev.mysql.com/downloads/installer/>，下载 **MySQL Installer for Windows**（选较大的那个离线安装包 `mysql-installer-community-8.0.x.msi`）。下载页面提示登录时，点击下方的 "No thanks, just start my download" 即可。
2. 运行安装程序：
   - **Choosing a Setup Type**：选择 **Server only**。
   - **Type and Networking**：Config Type 选 *Development Computer*，端口保持 **3306**。是否勾选 "Open Windows Firewall ports for network access" 均可，本平台不需要别的电脑直接连数据库，建议不勾选。
   - **Authentication Method**：保持默认的 *Use Strong Password Encryption*。
   - **Accounts and Roles**：设置 **root 密码**，务必记住，部署时要用。
   - **Windows Service**：勾选 *Configure MySQL Server as a Windows Service*，服务名保持 **MySQL80**，勾选 *Start the MySQL Server at System Startup*（开机自启）。
   - 之后一路 Next / Execute / Finish。
3. 验证：按 `Win + R` 输入 `services.msc`，在列表中找到 **MySQL80**，状态应为"正在运行"，启动类型为"自动"。

> **其他方式**：
> - 已安装 Docker Desktop：在项目根目录运行 `docker compose up -d`，root 密码为 `root123`（见 `docker-compose.yml`）。
> - phpStudy（小皮面板）、XAMPP 等自带的 MySQL 也可以使用，只要能用 root 账号从本机 3306 端口连接即可。MySQL 5.7 理论上兼容，但未经测试，建议使用 8.0。

### 1.3 获取项目代码

**方式一：Git**（已安装 Git 时）

```bat
cd /d D:\
git clone -b claude/happy-bardeen-piffux https://github.com/pokereasy666-creator/Class-Directory-and-Birthday-Reminder-Platform.git class-directory
```

**方式二：下载 ZIP**

1. 在 GitHub 仓库页面左上角切换到对应分支，点击绿色的 **Code → Download ZIP**。
2. 解压前先**右键 ZIP 文件 → 属性 → 勾选"解除锁定" → 确定**。否则 Windows 会把解压出的脚本标记为"来自网络"，运行时可能弹出安全警告。
3. 解压到例如 `D:\class-directory`。

> 建议放在 **不含空格和中文** 的路径下（如 `D:\class-directory`），可以减少第三方工具出错的概率；不要放在 `C:\Program Files` 等需要管理员权限才能写入的目录。
> 后台服务会直接使用这个目录，部署后不要再移动或重命名它（如需移动，移动后重新运行 `service.bat` 选择"安装"）。

---

## 2. 一键部署

双击 **`scripts\windows\setup.bat`**，按提示回答几个问题：

| 提示 | 说明 |
|---|---|
| 是否使用国内镜像加速下载依赖？ | 在中国大陆直接回车（是）。会通过 npmmirror 下载 npm 包和 Prisma 数据库引擎，否则可能非常慢甚至失败 |
| 请输入 MySQL root 用户的密码 | 1.2 节设置的 root 密码，输入时不显示 |
| 设置平台管理员 admin 的登录密码 | 6~32 位，含字母和数字。直接回车会随机生成，并在最后显示，**请记下** |
| 是否导入演示数据？ | 答辩演示选 `y`（会生成 13 名示例学生和公告）；正式给班级使用选 `n` |

脚本会依次执行 7 个步骤，首次约需 3~10 分钟（主要是下载依赖）：

| 步骤 | 内容 |
|---|---|
| 1/7 检查运行环境 | Node.js 版本、端口 3000 是否空闲 |
| 2/7 检查 MySQL | 能否连接 127.0.0.1:3306 |
| 3/7 安装依赖 | 后端、前端的 npm 依赖（含 Prisma 数据库引擎） |
| 4/7 创建数据库和专用账号 | 用 root 创建数据库 `class_directory` 和账号 `classbook`（只对这个库有权限，密码随机生成），并生成配置文件 `server\.env` |
| 5/7 数据库迁移 | 建表 |
| 6/7 初始化数据 | 创建管理员 `admin` 和 4 个默认小组（以及可选的演示数据） |
| 7/7 构建 | 编译前端页面和后端程序 |

看到"部署完成！"即成功，窗口中会显示访问地址和管理员账号。

**说明**

- root 密码只在第 4 步使用一次，不会保存到任何文件，也不会出现在命令行参数中；平台运行时使用的是专用账号 `classbook`。
- 所有配置保存在 `server\.env`，其中包含数据库密码和 JWT 密钥，**不要发给别人或上传到网上**（该文件已在 `.gitignore` 中排除）。
- **中途失败怎么办**：按窗口中的提示解决问题后，直接重新运行 `setup.bat` 即可，不需要删除任何东西。已生成的配置和数据库会继续使用，不会再要 root 密码；如果上次还没完成初始化，仍会询问是否导入演示数据，并在最后显示管理员账号和初始密码。
- 部署成功后再次运行 `setup.bat` 不会覆盖配置和数据，只会重新安装依赖、执行新的迁移并重新构建，所以更新代码后直接再运行一次即可（见 5.3 节）。
- 项目路径超过 120 个字符时，第 1 步会给出提示，建议移到 `D:\class-directory` 这样的短路径。

**高级用法**：在 PowerShell 中可以带参数运行，跳过提问：

```powershell
cd D:\class-directory\scripts\windows
powershell -ExecutionPolicy Bypass -File .\setup.ps1 -ChinaMirror -Demo -Port 8080
```

| 参数 | 说明 | 默认 |
|---|---|---|
| `-Port` | 平台端口 | 3000 |
| `-DbHost` / `-DbPort` | MySQL 地址 | 127.0.0.1 / 3306 |
| `-DbName` / `-DbUser` | 数据库名 / 平台专用账号 | class_directory / classbook |
| `-DbRootUser` | 有建库权限的 MySQL 账号 | root |
| `-ChinaMirror` | 使用国内镜像 | 询问 |
| `-Demo` | 导入演示数据 | 询问 |
| `-AdminPassword` | 管理员初始密码 | 询问 |
| `-Reconfigure` | 重新生成 `.env` 并重置专用账号密码（数据保留） | — |

---

## 3. 启动平台

### 3.1 临时运行：start.bat

双击 **`scripts\windows\start.bat`**，启动成功后会自动打开浏览器访问 `http://localhost:3000`。

- 窗口需要一直开着，**关闭窗口或按 Ctrl+C 即停止服务**。
- 服务进程意外退出时会自动重启，窗口中会显示"服务进程已退出……秒后自动重启"。
- 第一次运行时 Windows 可能弹出"Windows 安全中心警报：Windows Defender 防火墙已阻止此应用的部分功能"。如果需要让同学在局域网访问，勾选"专用网络"后点"允许访问"；只在本机使用可以点"取消"。

### 3.2 长期运行：安装为后台服务（推荐）

双击 **`scripts\windows\service.bat`**，在弹出的"用户账户控制"窗口中点"是"，然后在菜单中输入 `1`：

```
====== 班级通讯录 - 后台服务管理 ======
  1. 安装并启动后台服务（开机自动运行）
  2. 启动
  3. 停止
  4. 重启（修改 .env 或更新代码后使用）
  5. 查看状态
  6. 查看最近日志
  7. 卸载后台服务
  0. 退出
```

安装时会询问"是否允许局域网内其他设备访问"，需要同学访问就回答 `y`，脚本会在防火墙中放行端口。

后台服务的实现方式：使用 Windows 自带的**任务计划程序**，以 SYSTEM 身份运行平台，不需要安装其他工具。

- 开机 30 秒后自动启动（等待 MySQL 先启动），无需登录 Windows；
- 服务进程异常退出（包括开机时 MySQL 还没启动完成）时，由启动器 `server-launcher.cjs` 自动重启，间隔从 5 秒开始逐次加倍，最长 1 分钟；
- 选择"停止"或卸载时，启动器被结束，服务进程会在几秒内自行退出，不会继续占用端口；
- 运行日志写入 `server\logs\server.log`，超过 10MB 自动保留一份旧日志；
- 在"任务计划程序"（`taskschd.msc`）的"任务计划程序库"中可以看到名为 **ClassDirectory** 的任务。

> 后台服务和 `start.bat` 不能同时运行（都要使用 3000 端口）。

### 3.3 首次登录后

1. 用 `admin` 登录，进入右上角头像 → **修改密码**，把初始密码改掉；
2. **分组管理**：按需修改或新增小组；
3. **用户管理**：可以直接"新增账号"，也可以把网址发给同学，让大家自行注册后在"待审核"中逐个通过；
4. 如果班长也需要管理权限：在用户管理中编辑班长，把身份改为"管理员"；
5. **公告管理**：发布一条欢迎公告，提醒大家完善资料和生日。

---

## 4. 让同学访问

### 4.1 同一局域网（同一 Wi-Fi / 路由器）

1. 按 3.2 节安装后台服务，并同意放行防火墙；
2. 把当前网络设为**专用网络**：设置 → 网络和 Internet → 点击当前连接 → 网络配置文件类型选"专用网络"。（公用网络下防火墙规则不生效）
3. 查本机 IP：`service.bat` 菜单 `5. 查看状态` 或安装完成时都会显示局域网地址；也可以在命令提示符中运行 `ipconfig`，找到当前网卡的"IPv4 地址"，如 `192.168.1.23`；
4. 同学在手机或电脑浏览器中打开 `http://192.168.1.23:3000`。

注意：

- 电脑必须保持开机，并关闭自动睡眠：设置 → 系统 → 电源和睡眠 → 睡眠选"从不"；
- 路由器重启后本机 IP 可能变化，可以在路由器后台为这台电脑绑定固定 IP；
- 很多**校园网 / 公共 Wi-Fi 开启了"设备隔离"**，同一 Wi-Fi 下的设备也无法互相访问，这种情况只能用 4.2 节的方法。

### 4.2 外网访问

**方式一：云服务器（推荐用于正式使用）**

在 Windows Server 云服务器上按本指南同样部署，然后在云厂商控制台的**安全组**中放行 TCP 3000 端口（或把 `server\.env` 中的 `PORT` 改为 80）。不要在安全组中放行 MySQL 的 3306 端口。

**方式二：内网穿透**

使用 cpolar、natapp、frp 等内网穿透工具，把本机的 `3000` 端口映射为一个公网地址，按所用工具的说明操作即可。

**安全提醒**：通讯录包含全班手机号和宿舍，公开到外网前务必修改管理员初始密码；平台本身只提供 HTTP，优先选择能提供 HTTPS 地址的穿透服务或在云服务器上配置 HTTPS。

---

## 5. 日常维护

### 5.1 备份

双击 **`scripts\windows\backup.bat`**，会在项目根目录的 `backups\` 下生成 `class-directory-年月日-时分秒.zip`，内含数据库导出文件（`.sql`）和所有头像。默认保留最近 30 份，更早的自动删除。

- 脚本会自动在 `C:\Program Files\MySQL\MySQL Server *\bin\` 中查找 `mysqldump.exe`；
- 建议定期把备份文件复制到 U 盘或网盘，电脑硬盘损坏时备份放在同一块硬盘上并不安全。

**设置每天自动备份**（可选）：打开"任务计划程序" → 右侧"创建基本任务" → 名称填"班级通讯录备份" → 触发器选"每天"，时间如凌晨 3:00 → 操作选"启动程序"：

- 程序或脚本：`powershell.exe`
- 添加参数：`-NoProfile -ExecutionPolicy Bypass -File "D:\class-directory\scripts\windows\backup.ps1"`（换成实际路径）

完成后在任务属性中勾选"不管用户是否登录都要运行"。

### 5.2 从备份恢复

> 恢复会用备份中的数据**覆盖**当前数据库，操作前先运行一次 `backup.bat` 备份当前数据。

1. `service.bat` → `3. 停止`（或关闭 `start.bat` 窗口）；
2. 解压备份 ZIP，得到 `class_directory.sql` 和 `uploads` 文件夹；
3. 打开开始菜单中的 **MySQL 8.0 Command Line Client**，输入 root 密码后执行（路径换成实际位置，注意使用正斜杠 `/`）：

   ```sql
   USE class_directory;
   SOURCE D:/backup/class_directory.sql;
   ```

4. 用解压出的 `uploads` 文件夹替换项目中的 `server\uploads`；
5. `service.bat` → `2. 启动`。

### 5.3 更新代码

1. 先运行 `backup.bat` 备份；
2. `service.bat` → `3. 停止`；
3. 获取新代码：
   - Git：在项目目录运行 `git pull`；
   - ZIP：把新版本解压到**新文件夹**，再把旧目录中的 `server\.env` 和 `server\uploads\` 复制到新目录的相同位置；
4. 在（新）目录中双击 `setup.bat`，它会保留配置和数据，自动执行数据库迁移并重新构建；
5. 启动服务：在原目录更新的选 `service.bat` → `2. 启动`；换了新目录的选 `1. 安装`（让后台服务指向新目录）。

### 5.4 修改配置

用记事本打开 `server\.env` 修改后保存（保持 UTF-8 编码），然后 `service.bat` → `4. 重启` 生效。常用配置：

| 配置 | 说明 |
|---|---|
| `PORT=3000` | 端口。修改后需在 `service.bat` 中重新选择 `1. 安装`，以更新防火墙规则 |
| `REMINDER_CRON="0 8 * * *"` | 每日生日提醒时间（北京时间），例如 `"30 7 * * *"` 为每天 7:30 |
| `REMINDER_ADVANCE_DAYS=1` | 提前几天提醒，`0` 为只在当天提醒 |
| `JWT_EXPIRES_IN=1d` | 登录有效期，如 `7d` |
| `SMTP_*` | 邮件提醒，见下 |

**开启邮件提醒（以 QQ 邮箱为例）**：在 QQ 邮箱网页版"设置 → 账号"中开启 SMTP 服务并获取**授权码**，然后填写：

```ini
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=你的QQ号@qq.com
SMTP_PASS=授权码（不是QQ密码）
SMTP_FROM=你的QQ号@qq.com
```

同学需在个人中心填写邮箱并打开"邮件提醒"才会收到邮件。

### 5.5 忘记管理员密码

双击 **`scripts\windows\reset-password.bat`**，输入账号（直接回车为 `admin`）和新密码。重置后该账号下次登录需要再修改一次密码；如果管理员账号被禁用，会同时恢复。

### 5.6 查看日志

`service.bat` → `6. 查看最近日志`，或直接用记事本打开 `server\logs\server.log`。

### 5.7 卸载

1. `service.bat` → `7. 卸载后台服务`（同时删除防火墙规则）；
2. 删除项目文件夹（如需保留数据，先运行 `backup.bat` 并把备份复制出来）；
3. 如需删除数据库（**不可恢复**），在 MySQL 8.0 Command Line Client 中执行：

   ```sql
   DROP DATABASE class_directory;
   DROP USER 'classbook'@'localhost';
   DROP USER 'classbook'@'127.0.0.1';
   ```

---

## 6. 开发模式

修改代码时双击 **`scripts\windows\dev.bat`**（需先运行过 `setup.bat`），会打开两个窗口：

- 后端：`http://localhost:3000/api`，修改 `server\src` 下的代码后自动重启；接口文档 `http://localhost:3000/api/docs`；
- 前端：`http://localhost:5173`，修改 `web\src` 下的代码后页面自动刷新。

关闭两个窗口即停止。修改代码后，正式运行前需重新运行 `setup.bat`（重新构建）并重启服务。

运行测试（在 PowerShell 中）：

```powershell
cd D:\class-directory\server
npm test              # 单元测试，不需要数据库
```

接口测试 `npm run test:e2e` 需要单独的测试库：先用 root 执行
`CREATE DATABASE class_directory_test; GRANT ALL PRIVILEGES ON class_directory_test.* TO 'classbook'@'localhost', 'classbook'@'127.0.0.1';`，
再设置环境变量 `$env:TEST_DATABASE_URL = "mysql://classbook:<.env 中的密码>@127.0.0.1:3306/class_directory_test"` 后运行。

---

## 7. 常见问题

**双击 .bat 后窗口里全是乱码 / 提示语法错误**
脚本文件必须是"UTF-8 with BOM"编码（Windows 自带的 PowerShell 5.1 才能正确识别中文）。如果用某些编辑器修改过 `.ps1` 文件并另存为了其他编码，请重新获取原文件。

**提示"无法加载文件 ……，因为在此系统上禁止运行脚本"**
请通过 `.bat` 文件运行，它会为本次运行临时放开执行策略（不修改系统设置）。如果公司 / 学校电脑通过组策略禁止了 PowerShell 脚本，需要联系管理员或换一台电脑。

**安装依赖时很慢、报 `ETIMEDOUT`、`ECONNRESET`**
重新运行 `setup.bat` 并在第一个问题选择使用国内镜像。

**报错 `Failed to fetch the engine file` 或 `prisma` 相关下载失败**
同上，使用国内镜像（会同时设置 Prisma 引擎镜像）。

**初始化数据时报 `Module '"@prisma/client"' has no exported member 'CalendarType'`（或 `UserStatus`、`UserCreateInput`）**
这是数据库访问代码（Prisma Client）没有生成成功。早期版本的部署脚本依赖 npm 安装时自动生成，而这一步在 Windows 上可能静默失败（文件被占用等原因）。现在的脚本会在安装依赖后检查并重新生成，失败时会给出具体原因。获取最新代码后直接重新运行 `setup.bat` 即可，已创建的数据库和配置会继续使用。

**"生成 Prisma Client 失败"**
按提示处理：报 `EPERM` / `EBUSY` / `operation not permitted` 时，暂时关闭杀毒软件的实时防护（或把项目目录加入白名单），并关闭打开了本项目的编辑器；报下载失败时选择使用国内镜像；路径过长时把项目移动到短路径。处理后重新运行 `setup.bat`。

**"无法连接 MySQL"**
在 `services.msc` 中确认 MySQL80 正在运行；若是停止状态，右键 → 启动，并把启动类型设为"自动"。

**"创建数据库失败，请检查 MySQL root 密码是否正确"**
root 密码输错，或该账号没有建库、建用户的权限。可以在 MySQL 8.0 Command Line Client 中确认密码能否登录。

**"端口 3000 已被占用"**
可能是平台已经在后台运行（直接访问 `http://localhost:3000` 试试），或被其他程序占用。在命令提示符中运行 `netstat -ano | findstr :3000` 查看占用进程的 PID，再在任务管理器"详细信息"中找到该 PID 结束；或者在 `server\.env` 中换一个端口。

**重新运行 setup.bat 时报 `EPERM` / `EBUSY`（文件被占用）**
平台正在运行时，部分文件被锁定无法更新。先停止服务（`service.bat` → `3`）再运行。

**电脑重启后平台没有自动启动**
`service.bat` → `5. 查看状态` 查看上次运行结果，`6. 查看最近日志` 查看报错；确认 MySQL80 服务的启动类型为"自动"。

**同学访问不了**
依次检查：后台服务安装时是否同意了放行防火墙；当前网络是否为"专用网络"；IP 是否变了；是否处于开启了设备隔离的校园网（见 4.1 节）。

**杀毒软件拦截 node.exe 或脚本**
将项目目录和 `C:\Program Files\nodejs\node.exe` 加入信任列表。

**生日提醒的时间和电脑时间不一致**
平台统一按北京时间（Asia/Shanghai）判断"今天"和执行提醒，与电脑的时区设置无关。

---

## 8. 验证说明

- **真实 Windows**：第一版脚本在真实的 Windows 电脑上运行时，在"初始化数据"一步失败（即上文常见问题中的 `has no exported member`），已修复。
- **PowerShell 实际运行**：修复后的脚本在 Linux 上用 PowerShell 7 实际运行过——`setup`（含中途失败后重跑、部署成功后再次运行）、`start`、`backup`（并验证可恢复）、`reset-password`。
- **兼容性检查**：用 PSScriptAnalyzer 按 Windows 10 / Windows Server 2016 上 PowerShell 5.1 的语法、命令和 .NET 类型做了兼容性检查，没有发现问题。
- **后台服务**：用模拟的任务计划程序和防火墙命令跑通了安装、启动、状态、重启、停止、卸载流程。启动器的自动重启和防止孤儿进程也做了实际测试。
- **尚未在真实 Windows 上验证**：任务计划程序、防火墙规则、UAC 提权本身的行为。

如遇报错，请保留窗口中的完整输出以便排查。
