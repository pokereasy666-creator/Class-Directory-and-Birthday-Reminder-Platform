<#
.SYNOPSIS
  开发模式：分别在两个新窗口中启动后端（自动重启）和前端（热更新），用于修改代码。
  需要先运行过一次 setup.bat。
#>
. (Join-Path $PSScriptRoot 'common.ps1')

if (-not (Test-Path -LiteralPath $EnvFile) -or
    -not (Test-Path -LiteralPath (Join-Path $ServerDir 'node_modules')) -or
    -not (Test-Path -LiteralPath (Join-Path $WebDir 'node_modules'))) {
  Stop-WithError '尚未部署，请先运行 setup.bat。'
}
$port = Get-AppPort
if (Test-TcpPort '127.0.0.1' $port) { Stop-WithError "端口 $port 已被占用，请先停止正在运行的平台（start.bat 窗口或后台服务）。" }
if (Test-TcpPort '127.0.0.1' 5173) { Stop-WithError '端口 5173 已被占用，开发模式可能已经在运行。' }

Start-Process -FilePath 'powershell.exe' -WorkingDirectory $ServerDir -ArgumentList @('-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'npm.cmd run dev')
Start-Process -FilePath 'powershell.exe' -WorkingDirectory $WebDir -ArgumentList @('-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'npm.cmd run dev')
Write-Host '已打开后端、前端两个窗口，等待前端就绪……'

for ($i = 0; $i -lt 60; $i++) {
  if (Test-TcpPort '127.0.0.1' 5173 500) {
    Start-Process 'http://localhost:5173'
    Write-Host '开发地址：http://localhost:5173（修改代码后自动刷新）；接口文档：http://localhost:3000/api/docs' -ForegroundColor Green
    exit 0
  }
  Start-Sleep -Seconds 1
}
Write-Note '前端在 60 秒内未就绪，请查看新打开的窗口中的报错。'
