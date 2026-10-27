<#
.SYNOPSIS
  班级通讯录与生日提醒平台 —— Windows 一键部署 / 更新脚本。

.DESCRIPTION
  首次运行：安装依赖 → 创建数据库和专用账号 → 生成 server\.env → 建表 → 初始化数据 → 构建前后端。
  再次运行（如更新代码后）：保留现有 .env 和数据，只重新安装依赖、执行新的数据库迁移并重新构建。

  通常直接双击 scripts\windows\setup.bat 即可，所需信息会逐项询问。

.EXAMPLE
  .\setup.ps1
  .\setup.ps1 -ChinaMirror -Demo -DbRootPassword 'xxx'
#>
param(
  [string]$DbHost = '127.0.0.1',
  [int]$DbPort = 3306,
  [string]$DbName = 'class_directory',
  [string]$DbUser = 'classbook',
  [string]$DbRootUser = 'root',
  # 不建议在命令行中直接写密码，留空时会以隐藏输入的方式询问
  [string]$DbRootPassword,
  [int]$Port = 3000,
  [string]$AdminPassword,
  # 导入演示数据（13 名示例学生、公告等）
  [switch]$Demo,
  # 使用国内镜像（npmmirror）下载 npm 包和 Prisma 引擎
  [switch]$ChinaMirror,
  # 重新生成 .env 并重置数据库专用账号的密码（数据保留）
  [switch]$Reconfigure
)

. (Join-Path $PSScriptRoot 'common.ps1')

Write-Host '班级通讯录与生日提醒平台 - 部署脚本' -ForegroundColor White
Write-Host "项目目录：$RepoRoot"

$firstTime = $Reconfigure -or -not (Test-Path -LiteralPath $EnvFile)
if (-not $firstTime) { $Port = Get-AppPort }

# ---------------------------------------------------------------- 1. 环境
Write-Step '1/7 检查运行环境'
Assert-Node
if (Test-TcpPort '127.0.0.1' $Port) {
  Stop-WithError ("端口 $Port 已被占用。如果平台的后台服务或 start.bat 正在运行，请先停止" +
    '（双击 service.bat 选择"停止"，或关闭 start.bat 的窗口），部署完成后再启动。')
}
if ($DbName -notmatch '^[A-Za-z0-9_]+$' -or $DbUser -notmatch '^[A-Za-z0-9_]+$') {
  Stop-WithError '数据库名和用户名只能包含字母、数字和下划线'
}

if ($PSBoundParameters.ContainsKey('ChinaMirror')) {
  $useMirror = [bool]$ChinaMirror
} else {
  $useMirror = Read-YesNo '是否使用国内镜像加速下载依赖（在中国大陆建议选是）？' $true
}
if ($useMirror) {
  # npm 会把 package-lock.json 中的 registry.npmjs.org 自动替换为这里配置的镜像
  $env:npm_config_registry = 'https://registry.npmmirror.com'
  $env:PRISMA_ENGINES_MIRROR = 'https://registry.npmmirror.com/-/binary/prisma'
  Write-Ok '已启用 npmmirror 镜像'
}

# ---------------------------------------------------------------- 2. MySQL
Write-Step '2/7 检查 MySQL'
if (-not $firstTime) {
  $envMap = Read-DotEnv $EnvFile
  try {
    $dbUri = [Uri]$envMap['DATABASE_URL']
    $DbHost = $dbUri.Host
    $DbPort = $dbUri.Port
  } catch {
    Stop-WithError 'server\.env 中的 DATABASE_URL 无法解析，请检查，或使用 -Reconfigure 参数重新生成。'
  }
}
if (-not (Test-TcpPort $DbHost $DbPort)) {
  Stop-WithError ("无法连接 MySQL（${DbHost}:${DbPort}）。请确认已安装 MySQL 8 且服务已启动：" +
    '按 Win+R 输入 services.msc，找到 MySQL80 并点击"启动"；或以管理员身份运行 net start MySQL80。')
}
Write-Ok "MySQL ${DbHost}:${DbPort} 可以连接"

# ---------------------------------------------------------------- 3. 依赖
Write-Step '3/7 安装依赖（首次约需 2~5 分钟）'
Invoke-Native -FilePath $Npm -ArgumentList @('ci', '--no-audit', '--no-fund') -WorkingDirectory $ServerDir -ErrorMessage '安装后端依赖失败，请检查网络'
Invoke-Native -FilePath $Npm -ArgumentList @('ci', '--no-audit', '--no-fund') -WorkingDirectory $WebDir -ErrorMessage '安装前端依赖失败，请检查网络'
$prismaCli = Join-Path $ServerDir 'node_modules/prisma/build/index.js'
Write-Ok '依赖安装完成'

# ---------------------------------------------------------------- 4. 数据库与 .env
$generatedAdminPassword = $null
if ($firstTime) {
  Write-Step '4/7 创建数据库和专用账号'
  if (-not $DbRootPassword) {
    $DbRootPassword = ConvertTo-PlainText (Read-Host "请输入 MySQL $DbRootUser 用户的密码（输入时不显示）" -AsSecureString)
  }
  $appPassword = New-RandomString 24
  # 平台使用只对本库有权限的专用账号，而不是 root
  $sql = @"
CREATE DATABASE IF NOT EXISTS ``$DbName`` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DbUser'@'localhost' IDENTIFIED BY '$appPassword';
CREATE USER IF NOT EXISTS '$DbUser'@'127.0.0.1' IDENTIFIED BY '$appPassword';
ALTER USER '$DbUser'@'localhost' IDENTIFIED BY '$appPassword';
ALTER USER '$DbUser'@'127.0.0.1' IDENTIFIED BY '$appPassword';
GRANT ALL PRIVILEGES ON ``$DbName``.* TO '$DbUser'@'localhost';
GRANT ALL PRIVILEGES ON ``$DbName``.* TO '$DbUser'@'127.0.0.1';
FLUSH PRIVILEGES;
"@
  # root 连接串通过环境变量 + 临时 schema 传给 Prisma，密码不会出现在命令行参数里
  $tempSchema = Join-Path ([System.IO.Path]::GetTempPath()) ("cd-setup-" + [Guid]::NewGuid().ToString('N') + '.prisma')
  Write-Utf8File $tempSchema "datasource db {`n  provider = `"mysql`"`n  url      = env(`"CD_SETUP_ROOT_URL`")`n}`n"
  $env:CD_SETUP_ROOT_URL = 'mysql://' + [Uri]::EscapeDataString($DbRootUser) + ':' + [Uri]::EscapeDataString($DbRootPassword) + "@${DbHost}:${DbPort}/"
  Push-Location $ServerDir
  try {
    $sql | & node $prismaCli db execute --stdin --schema $tempSchema
    $code = $LASTEXITCODE
  } finally {
    Pop-Location
    Remove-Item -LiteralPath $tempSchema -Force -ErrorAction SilentlyContinue
    Remove-Item Env:\CD_SETUP_ROOT_URL -ErrorAction SilentlyContinue
  }
  if ($code -ne 0) { Stop-WithError "创建数据库失败，请检查 MySQL $DbRootUser 密码是否正确（退出码 $code）" }
  Write-Ok "数据库 $DbName 和账号 $DbUser 已就绪"

  if (-not $AdminPassword) {
    while ($true) {
      $AdminPassword = ConvertTo-PlainText (Read-Host '设置平台管理员 admin 的登录密码（6~32 位，含字母和数字；直接回车则随机生成）' -AsSecureString)
      if ($AdminPassword -eq '') { break }
      if ($AdminPassword -match '^(?=.*[A-Za-z])(?=.*\d)[^\s''"`]{6,32}$') { break }
      Write-Note '密码需为 6~32 位、同时包含字母和数字，且不能包含空格和引号，请重新输入'
    }
  }
  if (-not $AdminPassword) {
    $AdminPassword = New-RandomPassword 10
    $generatedAdminPassword = $AdminPassword
  }

  $jwtSecret = New-RandomString 48
  $envContent = @"
# 由 scripts\windows\setup.ps1 生成。修改后需重启服务生效。

# 服务端口
PORT=$Port

# 由后端直接托管前端页面（相对 server 目录）
WEB_DIST=../web/dist

# 数据库连接（平台专用账号）
DATABASE_URL="mysql://${DbUser}:${appPassword}@${DbHost}:${DbPort}/${DbName}"

# JWT 密钥（随机生成，请勿泄露）与有效期
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=1d

# 初始管理员（仅首次初始化时使用；之后请在平台中修改密码）
ADMIN_USERNAME=admin
ADMIN_PASSWORD='$AdminPassword'
ADMIN_NAME=班主任

# 每日生日提醒时间（北京时间）与提前提醒天数
REMINDER_CRON="0 8 * * *"
REMINDER_ADVANCE_DAYS=1

# 登录、注册每个 IP 每分钟次数上限
AUTH_RATE_LIMIT=10

# 邮件提醒（可选），SMTP_HOST 留空则不发送邮件
SMTP_HOST=
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
"@
  Write-Utf8File $EnvFile $envContent
  Write-Ok '已生成 server\.env'
} else {
  Write-Step '4/7 使用现有配置 server\.env'
  $envMap = Read-DotEnv $EnvFile
  if (-not $envMap.ContainsKey('WEB_DIST') -or $envMap['WEB_DIST'] -eq '') {
    # 旧版本生成的 .env 没有这一项
    Add-Content -LiteralPath $EnvFile -Value "`nWEB_DIST=../web/dist" -Encoding Ascii
    Write-Ok '已在 .env 中补充 WEB_DIST'
  }
  Write-Ok '保留现有数据库与账号配置'
}

# ---------------------------------------------------------------- 5. 建表
Write-Step '5/7 执行数据库迁移'
Invoke-Native -FilePath 'node' -ArgumentList @($prismaCli, 'migrate', 'deploy') -WorkingDirectory $ServerDir -ErrorMessage '数据库迁移失败'

# ---------------------------------------------------------------- 6. 初始数据
Write-Step '6/7 初始化数据'
if ($firstTime -and -not $PSBoundParameters.ContainsKey('Demo')) {
  $Demo = Read-YesNo '是否导入演示数据（13 名示例学生、公告，适合答辩演示；正式使用请选否）？' $false
}
if ($Demo) { $seedScript = 'seed:demo' } else { $seedScript = 'seed' }
Invoke-Native -FilePath $Npm -ArgumentList @('run', $seedScript) -WorkingDirectory $ServerDir -ErrorMessage '初始化数据失败'

# ---------------------------------------------------------------- 7. 构建
Write-Step '7/7 构建前端与后端'
Invoke-Native -FilePath $Npm -ArgumentList @('run', 'build') -WorkingDirectory $WebDir -ErrorMessage '前端构建失败'
Invoke-Native -FilePath $Npm -ArgumentList @('run', 'build') -WorkingDirectory $ServerDir -ErrorMessage '后端构建失败'

# ---------------------------------------------------------------- 完成
Write-Host ''
Write-Host '部署完成！' -ForegroundColor Green
Write-Host "  本机访问：      http://localhost:$Port"
foreach ($ip in Get-LanAddresses) { Write-Host "  局域网访问：    http://${ip}:$Port（需在 service.bat 中放行防火墙）" }
if ($firstTime) {
  Write-Host '  管理员账号：    admin'
  if ($generatedAdminPassword) {
    Write-Host "  管理员密码：    $generatedAdminPassword  （随机生成，请记下；登录后可在「修改密码」中更改）" -ForegroundColor Yellow
  } else {
    Write-Host '  管理员密码：    你刚才设置的密码'
  }
  if ($Demo) { Write-Host '  演示学生账号：  2022010101 ~ 2022010111，密码 Student123' }
}
Write-Host ''
Write-Host '下一步：'
Write-Host '  双击 scripts\windows\start.bat 启动（关闭窗口即停止）；'
Write-Host '  或双击 scripts\windows\service.bat 安装为后台服务（开机自动运行）。'
