<#
.SYNOPSIS
  在当前窗口启动平台（前台运行，关闭窗口或按 Ctrl+C 即停止）。
  服务进程意外退出时启动器会自动重启。需要长期运行、开机自启时请改用 service.bat。
#>
. (Join-Path $PSScriptRoot 'common.ps1')
trap { Write-UnexpectedError $_; exit 1 }

$port = Get-AppPort
$launcher = Join-Path $PSScriptRoot 'server-launcher.cjs'

if (-not (Test-Path -LiteralPath $EnvFile) -or
    -not (Test-Path -LiteralPath (Join-Path $ServerDir 'dist/main.js')) -or
    -not (Test-Path -LiteralPath (Join-Path $WebDir 'dist/index.html'))) {
  Stop-WithError '尚未部署或构建不完整，请先运行 setup.bat。'
}
if (Test-TcpPort '127.0.0.1' $port) {
  Stop-WithError "端口 $port 已被占用。平台可能已在后台服务中运行（可直接访问 http://localhost:$port），或请关闭占用该端口的程序。"
}
$db = Get-DatabaseConfig
if (-not (Test-TcpPort $db.Host $db.Port)) {
  Stop-WithError "无法连接 MySQL（$($db.Host):$($db.Port)），请先启动 MySQL 服务（services.msc 中的 MySQL80）。"
}

Write-Host '正在启动班级通讯录平台，关闭本窗口即停止服务……' -ForegroundColor Cyan
Write-Host "日志同时写入 server\logs\server.log"
$process = Start-Process -FilePath 'node' -ArgumentList ('"' + $launcher + '"') -WorkingDirectory $ServerDir -NoNewWindow -PassThru
$null = $process.Handle # PowerShell 5.1 需先取得句柄，结束后才能读到 ExitCode

# 等服务端口就绪后自动打开浏览器
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  if ($process.HasExited) { break }
  if (Test-TcpPort '127.0.0.1' $port 500) { $ready = $true; break }
  Start-Sleep -Seconds 1
}
if ($ready) {
  Write-Host ''
  Write-Host "启动成功：http://localhost:$port" -ForegroundColor Green
  foreach ($ip in Get-LanAddresses) { Write-Host "局域网访问：http://${ip}:$port" }
  Open-Browser "http://localhost:$port"
} elseif ($process.HasExited) {
  Stop-WithError '启动器意外退出，请查看上方日志。'
} else {
  Write-Note '60 秒内服务未就绪，请查看上方日志；启动器会自动重试，按 Ctrl+C 可退出。'
}

$process.WaitForExit()
exit $process.ExitCode
