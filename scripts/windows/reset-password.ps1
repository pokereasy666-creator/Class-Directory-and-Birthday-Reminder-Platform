<#
.SYNOPSIS
  重置任意账号的密码（管理员忘记密码时使用）。
  重置后该账号已登录的会话立即失效，下次登录需要修改密码；被禁用的管理员会同时恢复为正常状态。
#>
. (Join-Path $PSScriptRoot 'common.ps1')
trap { Write-UnexpectedError $_; exit 1 }

$tsNode = Join-Path $ServerDir 'node_modules/ts-node/dist/bin.js'
if (-not (Test-Path -LiteralPath $EnvFile) -or -not (Test-Path -LiteralPath $tsNode)) {
  Stop-WithError '尚未部署，请先运行 setup.bat。'
}
Assert-PrismaClient

$username = (Read-Host '要重置密码的账号（学生为学号；直接回车为 admin）').Trim()
if ($username -eq '') { $username = 'admin' }
if ($username -notmatch '^[A-Za-z0-9_]{3,32}$') { Stop-WithError '账号格式不正确' }

while ($true) {
  $password = ConvertTo-PlainText (Read-Host '新密码（6~32 位，含字母和数字）' -AsSecureString)
  $confirm = ConvertTo-PlainText (Read-Host '再次输入新密码' -AsSecureString)
  if ($password -ne $confirm) { Write-Note '两次输入不一致，请重新输入'; continue }
  if ($password -notmatch '^(?=.*[A-Za-z])(?=.*\d).{6,32}$') { Write-Note '密码需为 6~32 位，且同时包含字母和数字'; continue }
  break
}

# 新密码通过环境变量传递，不出现在命令行参数中
$env:NEW_PASSWORD = $password
try {
  Invoke-Native -FilePath 'node' -ArgumentList @($tsNode, '--transpile-only', 'prisma/reset-password.ts', $username) -WorkingDirectory $ServerDir -ErrorMessage '重置密码失败'
} finally {
  Remove-Item Env:\NEW_PASSWORD -ErrorAction SilentlyContinue
}
