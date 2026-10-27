<#
.SYNOPSIS
  备份数据库和上传的头像，生成 backups\class-directory-日期时间.zip。

.DESCRIPTION
  使用 MySQL 自带的 mysqldump 导出数据库（自动在 PATH 和默认安装目录中查找），
  连同 server\uploads 一起打包。默认只保留最近 30 份备份。

.EXAMPLE
  .\backup.ps1
  .\backup.ps1 -OutputDir D:\备份 -Keep 60
#>
param(
  [string]$OutputDir,
  [int]$Keep = 30
)

. (Join-Path $PSScriptRoot 'common.ps1')

if (-not $OutputDir) { $OutputDir = Join-Path $RepoRoot 'backups' }
$envMap = Read-DotEnv $EnvFile
if (-not $envMap.ContainsKey('DATABASE_URL')) { Stop-WithError '未找到 server\.env 或其中没有 DATABASE_URL，请先运行 setup.bat。' }

$uri = [Uri]$envMap['DATABASE_URL']
$userInfo = $uri.UserInfo.Split(':', 2)
$dbUser = [Uri]::UnescapeDataString($userInfo[0])
$dbPassword = ''
if ($userInfo.Length -gt 1) { $dbPassword = [Uri]::UnescapeDataString($userInfo[1]) }
$dbName = $uri.AbsolutePath.Trim('/')

# 查找 mysqldump：先找 PATH，再找 MySQL 默认安装目录
$mysqldump = $null
$cmd = Get-Command mysqldump -ErrorAction SilentlyContinue
if ($cmd) {
  $mysqldump = $cmd.Source
} else {
  $candidates = @()
  foreach ($root in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
    if ($root) { $candidates += Get-ChildItem -Path (Join-Path $root 'MySQL\MySQL Server *\bin\mysqldump.exe') -ErrorAction SilentlyContinue }
  }
  if ($candidates.Count -gt 0) { $mysqldump = ($candidates | Sort-Object FullName -Descending | Select-Object -First 1).FullName }
}
if (-not $mysqldump) {
  Stop-WithError '未找到 mysqldump.exe。请确认已安装 MySQL，或把 MySQL 的 bin 目录加入 PATH 环境变量。'
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$workDir = Join-Path ([System.IO.Path]::GetTempPath()) "class-directory-backup-$stamp"
New-Item -ItemType Directory -Path $workDir -Force | Out-Null
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
$zipFile = Join-Path $OutputDir "class-directory-$stamp.zip"

try {
  Write-Step '导出数据库'
  # 账号密码写入临时配置文件传给 mysqldump，不出现在命令行参数中
  $escape = { param($s) $s.Replace('\', '\\').Replace('"', '\"') }
  $optionFile = Join-Path $workDir 'client.cnf'
  Write-Utf8File $optionFile ("[client]`nuser=`"" + (& $escape $dbUser) + "`"`npassword=`"" + (& $escape $dbPassword) +
    "`"`nhost=`"" + $uri.Host + "`"`nport=" + $uri.Port + "`n")
  $sqlFile = Join-Path $workDir "$dbName.sql"
  # --no-tablespaces：普通账号没有导出表空间所需的 PROCESS 权限
  & $mysqldump "--defaults-extra-file=$optionFile" '--single-transaction' '--no-tablespaces' '--set-gtid-purged=OFF' `
    '--default-character-set=utf8mb4' "--result-file=$sqlFile" $dbName
  $code = $LASTEXITCODE
  Remove-Item -LiteralPath $optionFile -Force # 含密码的临时文件用完立即删除
  if ($code -ne 0) { Stop-WithError "mysqldump 执行失败（退出码 $code）" }
  Write-Ok "数据库已导出（$([math]::Round((Get-Item -LiteralPath $sqlFile).Length / 1KB)) KB）"

  Write-Step '打包备份'
  $paths = @($sqlFile)
  $uploads = Join-Path $ServerDir 'uploads'
  if (Test-Path -LiteralPath $uploads) { $paths += $uploads }
  Compress-Archive -LiteralPath $paths -DestinationPath $zipFile -Force
  Write-Ok "备份文件：$zipFile"
} finally {
  Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue
}

$old = Get-ChildItem -Path $OutputDir -Filter 'class-directory-*.zip' | Sort-Object Name -Descending | Select-Object -Skip $Keep
foreach ($file in $old) {
  Remove-Item -LiteralPath $file.FullName -Force
  Write-Ok "已删除过期备份 $($file.Name)"
}
